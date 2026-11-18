-- Internal image references only. No AI provider, jobs, billing or client sharing.
begin;
create table crm_quotes.concept_references (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null,
  revision integer not null,
  attachment_id uuid not null references crm_sales.attachments(id) on delete restrict,
  room_id uuid,
  title text not null check(length(btrim(title)) between 2 and 160),
  prompt_notes text check(prompt_notes is null or length(prompt_notes)<=2000),
  origin text not null default 'existing_reference' check(origin='existing_reference'),
  generation_state text not null default 'not_requested' check(generation_state='not_requested'),
  selected boolean not null default false,
  version integer not null default 1 check(version between 1 and 2147483647),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  archived_by uuid,
  archived_at timestamptz,
  foreign key(quotation_id,revision) references crm_quotes.revisions(quotation_id,revision) on delete restrict,
  check((archived_at is null)=(archived_by is null)),
  check(archived_at is null or not selected)
);
create unique index concept_active_image on crm_quotes.concept_references(quotation_id,revision,attachment_id)
  where archived_at is null;
create index concept_page on crm_quotes.concept_references(quotation_id,revision,created_at desc,id);
create table crm_quotes.concept_events (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid not null references crm_quotes.concept_references(id) on delete restrict,
  actor_id uuid not null,
  action text not null check(action in ('registered','selected','deselected','archived')),
  version integer not null,
  occurred_at timestamptz not null default now()
);
create table crm_quotes.concept_requests (
  actor_id uuid not null,
  request_id uuid not null,
  input jsonb not null,
  result jsonb not null,
  primary key(actor_id,request_id)
);
alter table crm_quotes.concept_references enable row level security;
alter table crm_quotes.concept_events enable row level security;
alter table crm_quotes.concept_requests enable row level security;
revoke all on crm_quotes.concept_references,crm_quotes.concept_events,crm_quotes.concept_requests
  from public,anon,authenticated,service_role;
create trigger immutable_concept_event before update or delete on crm_quotes.concept_events
  for each row execute function crm_quotes.reject_evidence_update();

create function crm_quotes.concept_access(p_id uuid,p_write boolean,p_revision integer)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from crm_quotes.quotations q
    join crm_sales.leads l on l.id=q.lead_id join crm_quotes.drafts d on d.quotation_id=q.id
    where q.id=p_id and crm_quotes.allowed('quotations.view',q.lead_id,q.created_by)
      and crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by)
      and (not p_write or (
        crm_quotes.allowed('quotations.update',q.lead_id,q.created_by)
        and d.status='draft' and d.revision=p_revision and l.archived_at is null
        and l.stage in ('new','assigned','contacted','requirements','site-visit')
        and (l.assigned_user_id is null or crm_sales.eligible_owner(l.assigned_user_id))
      )));
$$;
revoke all on function crm_quotes.concept_access(uuid,boolean,integer) from public,anon,authenticated,service_role;

create function public.crm_save_quotation_concept(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); request_uuid uuid; qid uuid; rev integer; op text; data jsonb;
  source_id uuid; room_uuid uuid; target uuid; expected integer; lead_uuid uuid;
  item crm_quotes.concept_references%rowtype; receipt crm_quotes.concept_requests%rowtype;
  result jsonb; event_action text;
begin
  perform crm_quotes.exact_keys(p_input,array['requestId','quotationId','revision','command','data']);
  request_uuid:=crm_quotes.uuid_value(p_input->'requestId');
  qid:=crm_quotes.uuid_value(p_input->'quotationId');
  if jsonb_typeof(p_input->'revision') is distinct from 'number'
    or p_input->>'revision' !~ '^[1-9][0-9]{0,9}$' or (p_input->>'revision')::numeric>2147483647 then
    raise exception using errcode='22023',message='Invalid concept revision.';
  end if;
  rev:=(p_input->>'revision')::integer;
  if crm_quotes.concept_access(qid,true,rev) is not true then
    raise exception using errcode='42501',message='Concept changes are not permitted.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('quotation-concept:'||actor::text,0));
  select lead_id into lead_uuid from crm_quotes.quotations where id=qid;
  perform 1 from crm_sales.leads where id=lead_uuid for share;
  perform 1 from crm_quotes.drafts where quotation_id=qid for update;
  if crm_quotes.concept_access(qid,true,rev) is not true then
    raise exception using errcode='42501',message='Concept changes are not permitted.';
  end if;
  select * into receipt from crm_quotes.concept_requests where actor_id=actor and request_id=request_uuid;
  if found then
    if receipt.input<>p_input then
      raise exception using errcode='22023',message='Retry input differs from the original request.';
    end if;
    return receipt.result||'{"replayed":true}'::jsonb;
  end if;
  op:=p_input->>'command'; data:=p_input->'data';
  if op='register' then
    perform crm_quotes.exact_keys(data,array['attachmentId','roomId','title','promptNotes']);
    source_id:=crm_quotes.uuid_value(data->'attachmentId');
    room_uuid:=crm_quotes.uuid_value(data->'roomId',true);
    if not exists(select 1 from crm_sales.attachments where id=source_id and lead_id=lead_uuid
      and state='ready' and mime in ('image/png','image/jpeg','image/webp')) then
      raise exception using errcode='22023',message='Choose a ready image belonging to this lead.';
    end if;
    if room_uuid is not null and not exists(select 1 from crm_sales.detail_records
      where lead_id=lead_uuid and id=room_uuid and kind='room' and archived_at is null) then
      raise exception using errcode='22023',message='Choose an active room belonging to this lead.';
    end if;
    insert into crm_quotes.concept_references(quotation_id,revision,attachment_id,room_id,title,
      prompt_notes,created_by,updated_by)
    values(qid,rev,source_id,room_uuid,crm_quotes.text_value(data->'title',160,2),
      crm_quotes.text_value(data->'promptNotes',2000),actor,actor) returning * into item;
    event_action:='registered';
  elsif op in ('select','archive') then
    perform crm_quotes.exact_keys(data,case when op='select' then array['id','version','selected'] else array['id','version'] end);
    target:=crm_quotes.uuid_value(data->'id');
    if jsonb_typeof(data->'version') is distinct from 'number'
      or data->>'version' !~ '^[1-9][0-9]{0,9}$' or (data->>'version')::numeric>2147483647 then
      raise exception using errcode='22023',message='Invalid concept version.';
    end if;
    expected:=(data->>'version')::integer;
    select * into item from crm_quotes.concept_references where id=target and quotation_id=qid and revision=rev for update;
    if not found or item.archived_at is not null or item.version<>expected or item.version=2147483647 then
      raise exception using errcode='40001',message='Concept changed or is read-only. Reload.';
    end if;
    if op='select' then
      if jsonb_typeof(data->'selected') is distinct from 'boolean' then
        raise exception using errcode='22023',message='Selection must be boolean.';
      end if;
      if (data->>'selected')::boolean and (
        not exists(select 1 from crm_sales.attachments where id=item.attachment_id and lead_id=lead_uuid
          and state='ready' and mime in ('image/png','image/jpeg','image/webp'))
        or (item.room_id is not null and not exists(select 1 from crm_sales.detail_records
          where lead_id=lead_uuid and id=item.room_id and kind='room' and archived_at is null))
      ) then raise exception using errcode='22023',message='The source image or room is no longer available.'; end if;
      update crm_quotes.concept_references set selected=(data->>'selected')::boolean,
        version=version+1,updated_by=actor,updated_at=now() where id=item.id returning * into item;
      event_action:=case when item.selected then 'selected' else 'deselected' end;
    else
      update crm_quotes.concept_references set selected=false,archived_at=now(),archived_by=actor,
        version=version+1,updated_by=actor,updated_at=now() where id=item.id returning * into item;
      event_action:='archived';
    end if;
  else raise exception using errcode='22023',message='Unsupported concept operation.';
  end if;
  insert into crm_quotes.concept_events(reference_id,actor_id,action,version)
    values(item.id,actor,event_action,item.version);
  result:=jsonb_build_object('id',item.id,'version',item.version,'selected',item.selected,
    'archived',item.archived_at is not null,'replayed',false);
  insert into crm_quotes.concept_requests(actor_id,request_id,input,result) values(actor,request_uuid,p_input,result);
  return result;
end;
$$;

create function public.crm_quotation_concepts(p_id uuid,p_revision integer,p_page integer default 0,p_archived boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if crm_quotes.concept_access(p_id,false,p_revision) is not true then
    raise exception using errcode='42501',message='Concept access is unavailable.';
  end if;
  if p_revision is null or p_revision<1 or p_page is null or p_page not between 0 and 10000 or p_archived is null then
    raise exception using errcode='22023',message='Invalid concept page.';
  end if;
  if not exists(select 1 from crm_quotes.revisions where quotation_id=p_id and revision=p_revision) then
    raise exception using errcode='22023',message='Choose an existing quotation revision.';
  end if;
  select jsonb_build_object('page',p_page,'pageSize',20,'canEdit',crm_quotes.concept_access(p_id,true,p_revision),
    'total',(select count(*) from crm_quotes.concept_references where quotation_id=p_id and revision=p_revision
      and (archived_at is not null)=p_archived),
    'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x."createdAt" desc,x.id) from (
      select c.id,c.revision,c.version,c.title,c.prompt_notes as "promptNotes",c.attachment_id as "attachmentId",
        c.room_id as "roomId",c.origin,c.generation_state as "generationState",c.selected,
        c.created_by as "createdBy",c.created_at as "createdAt",c.archived_at as "archivedAt",
        (a.state='ready' and (c.room_id is null or exists(select 1 from crm_sales.detail_records r
          where r.lead_id=a.lead_id and r.id=c.room_id and r.kind='room' and r.archived_at is null))) as available,
        a.filename,a.mime
      from crm_quotes.concept_references c join crm_sales.attachments a on a.id=c.attachment_id
      where c.quotation_id=p_id and c.revision=p_revision and (c.archived_at is not null)=p_archived
      order by c.created_at desc,c.id limit 20 offset p_page*20
    ) x),'[]'::jsonb),
    'generation',jsonb_build_object('enabled',false,'status','blocked_unconfigured','provider',null,
      'recordedGeneratedImages',0,'confirmedCost',null)) into result;
  return result;
end;
$$;
revoke all on function public.crm_save_quotation_concept(jsonb),public.crm_quotation_concepts(uuid,integer,integer,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.crm_save_quotation_concept(jsonb),public.crm_quotation_concepts(uuid,integer,integer,boolean)
  to authenticated;
comment on table crm_quotes.concept_references is 'Internal existing-image references; not provider-generated assets or sharing approval.';
notify pgrst,'reload schema';
commit;