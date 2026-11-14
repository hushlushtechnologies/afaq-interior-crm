-- Additive draft-only workflow. Requires Part 3A. No commercial approval or delivery.
begin;
create table crm_quotes.counters (
  year integer primary key check(year between 1 and 9999),
  value bigint not null check(value between 1 and 999999999999)
);
create table crm_quotes.quotations (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  lead_id uuid not null references crm_sales.leads(id) on delete restrict,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  customer_snapshot jsonb not null check(jsonb_typeof(customer_snapshot)='object')
);
create index quotation_lead on crm_quotes.quotations(lead_id,created_at desc,id);
create table crm_quotes.drafts (
  quotation_id uuid primary key references crm_quotes.quotations(id) on delete restrict,
  revision integer not null default 1 check(revision=1),
  status text not null default 'draft' check(status='draft'),
  version integer not null check(version between 1 and 2147483647),
  document jsonb not null check(jsonb_typeof(document)='object'),
  calculation jsonb not null check(jsonb_typeof(calculation)='object'),
  updated_by uuid not null,
  updated_at timestamptz not null default now()
);
create table crm_quotes.saves (
  quotation_id uuid not null references crm_quotes.quotations(id) on delete restrict,
  version integer not null check(version>0),
  actor_id uuid not null,
  occurred_at timestamptz not null default now(),
  document jsonb not null,
  calculation jsonb not null,
  primary key(quotation_id,version)
);
create table crm_quotes.requests (
  actor_id uuid not null,
  request_id uuid not null,
  quotation_id uuid not null references crm_quotes.quotations(id) on delete restrict,
  input jsonb not null,
  result jsonb not null,
  primary key(actor_id,request_id)
);

create function crm_quotes.allowed(p_permission text,p_lead uuid,p_creator uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.role()='authenticated' and crm_access.is_eligible_user(auth.uid())
    and exists(select 1 from crm_sales.leads l where l.id=p_lead and
      (public.crm_has_permission(p_permission,'company')
       or (l.assigned_user_id=auth.uid() and crm_sales.eligible_owner(auth.uid())
         and public.crm_has_permission(p_permission,'assigned'))
       or (p_creator=auth.uid() and public.crm_has_permission(p_permission,'own'))));
$$;
create function public.crm_can_view_quotation(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from crm_quotes.quotations q where q.id=p_id
    and crm_quotes.allowed('quotations.view',q.lead_id,q.created_by));
$$;

alter table crm_quotes.counters enable row level security;
alter table crm_quotes.quotations enable row level security;
alter table crm_quotes.drafts enable row level security;
alter table crm_quotes.saves enable row level security;
alter table crm_quotes.requests enable row level security;
create policy quotation_read on crm_quotes.quotations for select to authenticated
  using(public.crm_can_view_quotation(id));
create policy draft_read on crm_quotes.drafts for select to authenticated
  using(public.crm_can_view_quotation(quotation_id));
create policy save_read on crm_quotes.saves for select to authenticated
  using(public.crm_can_view_quotation(quotation_id));
-- No direct table grants. RLS also protects accidental future read grants.
revoke all on all tables in schema crm_quotes from public,anon,authenticated,service_role;

create function crm_quotes.uuid_value(p_value jsonb,p_nullable boolean default false)
returns uuid language plpgsql immutable set search_path='' as $$
declare v text:=lower(p_value#>>'{}');
begin
  if p_nullable and p_value='null'::jsonb then return null; end if;
  if jsonb_typeof(p_value) is distinct from 'string' or v !~
    '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$' then
    raise exception using errcode='22023',message='Invalid UUID field.';
  end if;
  return v::uuid;
end;
$$;
create function crm_quotes.text_value(p_value jsonb,p_cap integer,p_min integer default 0)
returns text language plpgsql immutable set search_path='' as $$
declare v text;
begin
  if p_min=0 and p_value='null'::jsonb then return null; end if;
  if jsonb_typeof(p_value) is distinct from 'string' then
    raise exception using errcode='22023',message='Invalid text field.';
  end if;
  v:=btrim(p_value#>>'{}');
  if length(v) not between p_min and p_cap then
    raise exception using errcode='22023',message='Text field exceeds its limits.';
  end if;
  return nullif(v,'');
end;
$$;
create function crm_quotes.date_value(p_value jsonb,p_nullable boolean default false)
returns date language plpgsql immutable set search_path='' as $$
declare v text:=p_value#>>'{}'; d date;
begin
  if p_nullable and p_value='null'::jsonb then return null; end if;
  if jsonb_typeof(p_value) is distinct from 'string' or length(v)<>10
    or v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or left(v,4)='0000' then
    raise exception using errcode='22023',message='Invalid calendar date.';
  end if;
  d:=v::date;
  if to_char(d,'YYYY-MM-DD')<>v then
    raise exception using errcode='22023',message='Invalid calendar date.';
  end if;
  return d;
exception when invalid_datetime_format or datetime_field_overflow then
  raise exception using errcode='22023',message='Invalid calendar date.';
end;
$$;

create function public.crm_save_quotation_draft(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); request_id uuid; quote_id uuid; lead_id uuid; expected integer;
  l crm_sales.leads%rowtype; q crm_quotes.quotations%rowtype; d crm_quotes.drafts%rowtype;
  receipt crm_quotes.requests%rowtype; document jsonb; calculation jsonb; result jsonb;
  section jsonb; section_id uuid; room_id uuid; section_ids uuid[]:=array[]::uuid[];
  k text; cap integer; text_result text; issue_date date; valid_until date;
  y integer; counter bigint; creator uuid; operation text;
begin
  -- Use the existing eligibility/role mutation lock before request/resource locks.
  perform pg_advisory_xact_lock(90310001::bigint);
  if actor is null or auth.role() is distinct from 'authenticated'
     or crm_access.is_eligible_user(actor) is not true then
    raise exception using errcode='42501',message='Active authenticated employee required.';
  end if;
  perform crm_quotes.exact_keys(p_input,array['requestId','quotationId','expectedVersion','leadId',
    'title','quotationDate','validUntil','companyVatNumber','clientNotes','internalNotes',
    'terms','paymentTerms','sections','pricing']);
  if octet_length(p_input::text)>2000000 then
    raise exception using errcode='22023',message='Draft request is too large.';
  end if;
  request_id:=crm_quotes.uuid_value(p_input->'requestId');
  quote_id:=crm_quotes.uuid_value(p_input->'quotationId',true);
  lead_id:=crm_quotes.uuid_value(p_input->'leadId');
  if quote_id is null then
    if p_input->'expectedVersion'<>'null'::jsonb then
      raise exception using errcode='22023',message='Create must not supply a version.';
    end if;
  else
    if jsonb_typeof(p_input->'expectedVersion') is distinct from 'number'
       or (p_input->>'expectedVersion') !~ '^[1-9][0-9]{0,9}$'
       or (p_input->>'expectedVersion')::numeric>2147483647 then
      raise exception using errcode='22023',message='Update requires a valid version.';
    end if;
    expected:=(p_input->>'expectedVersion')::integer;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||request_id::text,1803));
  select * into l from crm_sales.leads where id=lead_id for update;
  if not found or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true then
    raise exception using errcode='42501',message='Lead access is required.';
  end if;
  creator:=actor;
  operation:=case when quote_id is null then 'quotations.create' else 'quotations.update' end;
  if quote_id is not null then
    select * into q from crm_quotes.quotations where id=quote_id for update;
    if not found or q.lead_id<>lead_id then
      raise exception using errcode='42501',message='Quotation operation is not permitted.';
    end if;
    creator:=q.created_by;
  end if;
  if crm_quotes.allowed(operation,lead_id,creator) is not true
     or crm_quotes.allowed('quotations.view',lead_id,creator) is not true then
    raise exception using errcode='42501',message='Quotation operation is not permitted.';
  end if;
  if l.archived_at is not null or l.stage not in ('new','assigned','contacted','requirements','site-visit')
     or (l.assigned_user_id is not null and crm_sales.eligible_owner(l.assigned_user_id) is not true) then
    raise exception using errcode='22023',message='An active pre-quotation lead with an eligible owner is required.';
  end if;
  select * into receipt from crm_quotes.requests r
    where r.actor_id=actor and r.request_id=crm_save_quotation_draft.request_id;
  if found then
    if receipt.input<>p_input then
      raise exception using errcode='22023',message='Request ID already used for different input.';
    end if;
    if public.crm_can_view_quotation(receipt.quotation_id) is not true then
      raise exception using errcode='42501',message='Quotation is no longer accessible.';
    end if;
    return receipt.result||jsonb_build_object('replayed',true);
  end if;
  if quote_id is not null then
    select * into d from crm_quotes.drafts where quotation_id=quote_id for update;
    if not found or d.status<>'draft' or d.revision<>1 or d.version<>expected
       or d.version=2147483647 then
      raise exception using errcode='40001',message='Draft changed. Reload and review before saving.';
    end if;
  end if;
  document:=p_input-array['requestId','quotationId','expectedVersion','leadId'];
  foreach k in array array['title','companyVatNumber','clientNotes','internalNotes','terms','paymentTerms'] loop
    cap:=case k when 'title' then 160 when 'companyVatNumber' then 32 when 'terms' then 8000 else 4000 end;
    text_result:=crm_quotes.text_value(p_input->k,cap,case when k='title' then 2 else 0 end);
    document:=jsonb_set(document,array[k],coalesce(to_jsonb(text_result),'null'::jsonb));
  end loop;
  issue_date:=crm_quotes.date_value(p_input->'quotationDate');
  valid_until:=crm_quotes.date_value(p_input->'validUntil',true);
  if valid_until<issue_date then
    raise exception using errcode='22023',message='Validity cannot precede the quotation date.';
  end if;
  if jsonb_typeof(p_input->'sections') is distinct from 'array' then
    raise exception using errcode='22023',message='Sections must be an array.';
  end if;
  if jsonb_array_length(p_input->'sections')>50 then
    raise exception using errcode='22023',message='Maximum 50 sections.';
  end if;
  for section in select value from jsonb_array_elements(p_input->'sections') loop
    perform crm_quotes.exact_keys(section,array['id','name','roomId']);
    section_id:=crm_quotes.uuid_value(section->'id');
    room_id:=crm_quotes.uuid_value(section->'roomId',true);
    perform crm_quotes.text_value(section->'name',160,1);
    if section_id=any(section_ids) then
      raise exception using errcode='22023',message='Section IDs must be unique.';
    end if;
    section_ids:=array_append(section_ids,section_id);
    if room_id is not null and not exists(select 1 from crm_sales.detail_records r
      where r.lead_id=crm_save_quotation_draft.lead_id and r.id=room_id and r.kind='room' and r.archived_at is null) then
      raise exception using errcode='22023',message='Choose an active room from this lead.';
    end if;
  end loop;
  calculation:=crm_quotes.calculate(p_input->'pricing');
  for section in select value from jsonb_array_elements(p_input->'pricing'->'items') loop
    section_id:=crm_quotes.uuid_value(section->'sectionId',true);
    if section_id is not null and not (section_id=any(section_ids)) then
      raise exception using errcode='22023',message='Item section must belong to this draft.';
    end if;
  end loop;
  if quote_id is null then
    y:=extract(year from now() at time zone 'Asia/Dubai')::integer;
    insert into crm_quotes.counters(year,value) values(y,1)
      on conflict(year) do update set value=crm_quotes.counters.value+1 returning value into counter;
    insert into crm_quotes.quotations(number,lead_id,created_by,customer_snapshot)
      values('AFAQ-Q-'||y||'-'||lpad(counter::text,greatest(6,length(counter::text)),'0'),lead_id,actor,
        jsonb_build_object('leadReference',l.reference::text,'customerName',l.customer_name,
          'email',l.email,'phone',l.phone,'propertyType',l.property_type,'location',l.location)) returning * into q;
    quote_id:=q.id;
    insert into crm_quotes.drafts(quotation_id,version,document,calculation,updated_by)
      values(quote_id,1,document,calculation,actor) returning * into d;
  else
    update crm_quotes.drafts set document=crm_save_quotation_draft.document,
      calculation=crm_save_quotation_draft.calculation,version=version+1,updated_by=actor,updated_at=now()
      where quotation_id=quote_id returning * into d;
  end if;
  insert into crm_quotes.saves(quotation_id,version,actor_id,document,calculation)
    values(quote_id,d.version,actor,document,calculation);
  result:=jsonb_build_object('id',quote_id,'number',q.number,'version',d.version,
    'revision',1,'status','draft','calculation',calculation,'replayed',false);
  insert into crm_quotes.requests(actor_id,request_id,quotation_id,input,result)
    values(actor,request_id,quote_id,p_input,result);
  return result;
end;
$$;

create function public.crm_get_quotation(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if public.crm_can_view_quotation(p_id) is not true then
    raise exception using errcode='42501',message='Quotation is unavailable or not permitted.';
  end if;
  select jsonb_build_object('id',q.id,'number',q.number,'leadId',q.lead_id,
    'createdBy',q.created_by,'createdAt',q.created_at,'customer',q.customer_snapshot,
    'revision',d.revision,'status',d.status,'version',d.version,'document',d.document,
    'calculation',d.calculation,'updatedBy',d.updated_by,'updatedAt',d.updated_at)
  into result from crm_quotes.quotations q join crm_quotes.drafts d on d.quotation_id=q.id where q.id=p_id;
  if result is null then
    raise exception using errcode='42501',message='Quotation is unavailable or not permitted.';
  end if;
  return result;
end;
$$;

revoke all on all functions in schema crm_quotes from public,anon,authenticated,service_role;
revoke all on function public.crm_can_view_quotation(uuid),public.crm_save_quotation_draft(jsonb),
  public.crm_get_quotation(uuid) from public,anon,authenticated,service_role;
grant execute on function public.crm_can_view_quotation(uuid),public.crm_save_quotation_draft(jsonb),
  public.crm_get_quotation(uuid) to authenticated;
comment on table crm_quotes.saves is 'Private business snapshots for each saved draft; not application logs.';
notify pgrst,'reload schema';
commit;