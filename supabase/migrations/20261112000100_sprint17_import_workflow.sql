-- Approved DEC-011 import staging and atomic confirmation. No raw CSV storage.
begin;
create table crm_sales.import_batches (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null,
 filename text not null,
 file_hash text not null check(file_hash ~ '^[0-9a-f]{64}$'),
 payload_hash text not null,
 source_code text not null references crm_sales.sources(code),
 assigned_user_id uuid references auth.users(id) on delete restrict,
 mapping jsonb not null,
 default_inquiry_on date not null,
 version integer not null default 1 check(version>0),
 status text not null default 'staged' check(status in ('staged','completed')),
 completed_at timestamptz,
 check((status='completed')=(completed_at is not null)),
 created_at timestamptz not null default now(),
 unique(actor_id,payload_hash)
);
create index import_batches_actor_page on crm_sales.import_batches(actor_id,created_at desc,id);
create table crm_sales.import_rows (
 batch_id uuid not null references crm_sales.import_batches(id) on delete restrict,
 row_number integer not null check(row_number between 2 and 1048576),
 data jsonb,
 errors jsonb not null,
 status text not null check(status in ('ready','invalid','review','applied','skipped')),
 duplicate_rows integer[] not null default '{}',
 database_match boolean not null default false,
 primary key(batch_id,row_number),
 resulting_lead_id uuid references crm_sales.leads(id) on delete restrict,
 check((status='applied')=(resulting_lead_id is not null)),
 check(data is not null or status in ('invalid','skipped'))
);
create table crm_sales.import_events (
 id bigint generated always as identity primary key,
 batch_id uuid not null references crm_sales.import_batches(id) on delete restrict,
 actor_id uuid not null,
 action text not null check(action in ('staged','duplicates_detected','confirmed')),
 detail jsonb not null default '{}',
 occurred_at timestamptz not null default now()
);
create table crm_sales.import_requests (
 actor_id uuid not null,
 request_id uuid not null,
 payload_hash text not null,
 kind text not null default 'stage' check(kind in ('stage','confirm')),
 result jsonb,
 batch_id uuid not null references crm_sales.import_batches(id) on delete restrict,
 created_at timestamptz not null default now(),
 primary key(actor_id,request_id)
);
create index import_requests_actor_time on crm_sales.import_requests(actor_id,created_at);

create function crm_sales.import_access(p_actor uuid,p_owner uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.role()='authenticated' and auth.uid()=p_actor
 and crm_access.is_eligible_user(auth.uid())
 and public.crm_has_permission('leads.create')
 and crm_sales.allowed('leads.view',p_owner,p_actor);
$$;
create function crm_sales.import_date(p_value text)
returns boolean language plpgsql immutable set search_path='' as $$
begin
 return p_value is not null and p_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 and left(p_value,4)<>'0000' and to_char(p_value::date,'YYYY-MM-DD')=p_value;
exception when others then return false;
end;
$$;
create function crm_sales.check_import_fields(p_data jsonb)
returns void language plpgsql set search_path='' as $$
declare k text; expected text[]:=array['customer_name','email','phone','alternate_phone',
 'source_code','assigned_user_id','priority','property_type','location','budget',
 'expected_start_on','inquiry_on','follow_up_on','description','initial_note'];
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' then
  raise exception using errcode='22023',message='Invalid normalized import fields.'; end if;
 if not p_data ?& expected or exists(select 1 from jsonb_object_keys(p_data) f where not f=any(expected)) then
  raise exception using errcode='22023',message='Unexpected normalized import fields.'; end if;
 foreach k in array expected loop
  if jsonb_typeof(p_data->k) not in ('string','null') then
   raise exception using errcode='22023',message='Import fields must be text or null.'; end if;
 end loop;
 if length(coalesce(p_data->>'customer_name','')) not between 2 and 160
 or p_data->>'customer_name' ~ '^[[:space:]]*$'
 or coalesce(p_data->>'priority','') not in ('low','normal','high','urgent')
 or coalesce(p_data->>'source_code','') !~ '^[a-z][a-z0-9_]{0,39}$'
 or crm_sales.import_date(p_data->>'inquiry_on') is not true
 or (p_data->>'email' is not null and (length(p_data->>'email')>254
   or p_data->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
 or (p_data->>'budget' is not null and p_data->>'budget' !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$')
 or length(p_data->>'property_type')>100 or length(p_data->>'location')>300
 or length(p_data->>'description')>4000 or length(p_data->>'initial_note')>2000 then
  raise exception using errcode='22023',message='Invalid normalized lead values.'; end if;
 foreach k in array array['phone','alternate_phone'] loop
  if p_data->>k is not null and p_data->>k !~ '^\+[1-9][0-9]{6,14}$' then
   raise exception using errcode='22023',message='Invalid international phone.'; end if;
 end loop;
 foreach k in array array['expected_start_on','follow_up_on'] loop
  if p_data->>k is not null and crm_sales.import_date(p_data->>k) is not true then
   raise exception using errcode='22023',message='Invalid import date.'; end if;
 end loop;
 if p_data->>'assigned_user_id' is not null then perform (p_data->>'assigned_user_id')::uuid; end if;
end;
$$;
create function crm_sales.import_summary(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',b.id,'filename',b.filename,'sourceCode',b.source_code,
 'assignedUserId',b.assigned_user_id,'createdAt',b.created_at,'confirmationEnabled',true,
 'version',b.version,'status',b.status,'completedAt',b.completed_at,
 'counts',jsonb_build_object('total',count(r.*),'ready',count(*) filter(where r.status='ready'),
 'invalid',count(*) filter(where r.status='invalid'),'review',count(*) filter(where r.status='review'),
 'applied',count(*) filter(where r.status='applied'),'skipped',count(*) filter(where r.status='skipped')))
 from crm_sales.import_batches b join crm_sales.import_rows r on r.batch_id=b.id
 where b.id=p_id group by b.id;
$$;

alter table crm_sales.import_batches enable row level security;
alter table crm_sales.import_rows enable row level security;
alter table crm_sales.import_events enable row level security;
alter table crm_sales.import_requests enable row level security;
revoke all on crm_sales.import_batches,crm_sales.import_rows,crm_sales.import_events,
 crm_sales.import_requests from public,anon,authenticated,service_role;
revoke all on sequence crm_sales.import_events_id_seq from public,anon,authenticated,service_role;
revoke all on function crm_sales.import_access(uuid,uuid),crm_sales.import_date(text),
 crm_sales.check_import_fields(jsonb),crm_sales.import_summary(uuid)
 from public,anon,authenticated,service_role;
grant execute on function crm_sales.import_access(uuid,uuid) to authenticated;
grant select on crm_sales.import_batches,crm_sales.import_rows,crm_sales.import_events to authenticated;
create policy import_batch_read on crm_sales.import_batches for select to authenticated
 using(crm_sales.import_access(actor_id,assigned_user_id));
create policy import_row_read on crm_sales.import_rows for select to authenticated
 using(exists(select 1 from crm_sales.import_batches b where b.id=batch_id)
 and (resulting_lead_id is null or exists(select 1 from crm_sales.leads l where l.id=resulting_lead_id)));
create policy import_event_read on crm_sales.import_events for select to authenticated
 using(exists(select 1 from crm_sales.import_batches b where b.id=batch_id));

create function public.crm_stage_lead_import(p_request_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); fingerprint text; v_batch_id uuid; owner_id uuid;
 receipt crm_sales.import_requests%rowtype; b crm_sales.import_batches%rowtype;
 item jsonb; d jsonb; rn integer; seen integer[]:='{}'; field text; idx integer;
 used integer[]:='{}'; candidate crm_sales.import_rows%rowtype; matches integer[];
 exists_in_database boolean; valid_fields text[]:=array['customer_name','email','phone','alternate_phone',
 'property_type','location','budget','expected_start_on','inquiry_on','follow_up_on','description','initial_note','priority'];
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 if auth.role() is distinct from 'authenticated' or actor is null
 or crm_access.is_eligible_user(actor) is not true
 or public.crm_has_permission('leads.create') is not true
 or public.crm_has_permission('leads.view') is not true then
  raise exception using errcode='42501',message='Active lead creation and visibility required.'; end if;
 if p_request_id is null or p_input is null or jsonb_typeof(p_input)<>'object'
 or octet_length(p_input::text)>4194304 then
  raise exception using errcode='22023',message='Invalid import request.'; end if;
 fingerprint:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
 select * into receipt from crm_sales.import_requests r where r.actor_id=actor and r.request_id=p_request_id;
 if found then
  if receipt.kind<>'stage' or receipt.payload_hash<>fingerprint then
   raise exception using errcode='22023',message='Request ID reused with different import input.'; end if;
  select * into b from crm_sales.import_batches where id=receipt.batch_id;
  if crm_sales.import_access(b.actor_id,b.assigned_user_id) is not true then
   raise exception using errcode='42501',message='Import access unavailable.'; end if;
  return jsonb_build_object('batch',crm_sales.import_summary(b.id),'replayed',true);
 end if;
 if not p_input ?& array['filename','fileHash','sourceCode','assignedUserId','defaultInquiryOn','mapping','columnCount','rows']
 or exists(select 1 from jsonb_object_keys(p_input) k where k not in
 ('filename','fileHash','sourceCode','assignedUserId','defaultInquiryOn','mapping','columnCount','rows')) then
  raise exception using errcode='22023',message='Unexpected import field.'; end if;
 foreach field in array array['filename','fileHash','sourceCode','defaultInquiryOn'] loop
  if jsonb_typeof(p_input->field)<>'string' then
   raise exception using errcode='22023',message='Invalid import metadata.'; end if;
 end loop;
 if jsonb_typeof(p_input->'assignedUserId') not in ('string','null')
 or jsonb_typeof(p_input->'columnCount')<>'number'
 or jsonb_typeof(p_input->'mapping')<>'object' or jsonb_typeof(p_input->'rows')<>'array' then
  raise exception using errcode='22023',message='Invalid import structure.'; end if;
 owner_id:=(p_input->>'assignedUserId')::uuid;
 if crm_sales.import_access(actor,owner_id) is not true then
  raise exception using errcode='42501',message='Import visibility unavailable.'; end if;
 if length(p_input->>'filename') not between 5 and 180
 or p_input->>'filename' !~* '^.+[.]csv$' or p_input->>'filename' ~ '[[:cntrl:]/]'
 or position(chr(92) in p_input->>'filename')>0
 or p_input->>'fileHash' !~ '^[0-9a-f]{64}$'
 or crm_sales.import_date(p_input->>'defaultInquiryOn') is not true
 or p_input->>'columnCount' !~ '^[0-9]+$' or (p_input->>'columnCount')::integer not between 1 and 40
 or jsonb_array_length(p_input->'rows') not between 1 and 500 then
  raise exception using errcode='22023',message='Import limits or metadata are invalid.'; end if;
 if not (p_input->'mapping') ? 'customer_name' then
  raise exception using errcode='22023',message='Customer name mapping required.'; end if;
 for field,item in select key,value from jsonb_each(p_input->'mapping') loop
  if not field=any(valid_fields) or jsonb_typeof(item)<>'number' or item::text !~ '^[0-9]+$' then
   raise exception using errcode='22023',message='Invalid import mapping.'; end if;
  idx:=item::text::integer;
  if idx<0 or idx>=(p_input->>'columnCount')::integer or idx=any(used) then
   raise exception using errcode='22023',message='Invalid or repeated mapping column.'; end if;
  used:=array_append(used,idx);
 end loop;
 if (select count(*) from crm_sales.import_requests r where r.actor_id=actor
 and r.created_at>statement_timestamp()-interval '1 minute')>=50 then
  raise exception using errcode='P0001',message='Import staging rate limit reached.'; end if;
 select * into b from crm_sales.import_batches where actor_id=actor and payload_hash=fingerprint;
 if found then
  insert into crm_sales.import_requests(actor_id,request_id,payload_hash,batch_id) values(actor,p_request_id,fingerprint,b.id);
  return jsonb_build_object('batch',crm_sales.import_summary(b.id),'replayed',true);
 end if;
 if public.crm_has_permission('leads.assign','company') is not true and owner_id is distinct from actor then
  raise exception using errcode='42501',message='New leads must be assigned to yourself.'; end if;
 if owner_id is not null and crm_sales.eligible_owner(owner_id) is not true then
  raise exception using errcode='22023',message='Choose an eligible active Sales owner.'; end if;
 if not exists(select 1 from crm_sales.sources where code=p_input->>'sourceCode' and active) then
  raise exception using errcode='22023',message='Choose an active source.'; end if;
 if (select count(*) from crm_sales.import_batches where actor_id=actor
 and created_at>statement_timestamp()-interval '1 minute')>=5 then
  raise exception using errcode='P0001',message='Import staging rate limit reached.'; end if;
 insert into crm_sales.import_batches(actor_id,filename,file_hash,payload_hash,source_code,assigned_user_id,mapping,default_inquiry_on)
 values(actor,p_input->>'filename',p_input->>'fileHash',fingerprint,p_input->>'sourceCode',owner_id,
 p_input->'mapping',(p_input->>'defaultInquiryOn')::date) returning id into v_batch_id;
 for item in select value from jsonb_array_elements(p_input->'rows') loop
  if jsonb_typeof(item)<>'object' or not item ?& array['rowNumber','data','errors']
  or exists(select 1 from jsonb_object_keys(item) k where k not in ('rowNumber','data','errors'))
  or jsonb_typeof(item->'rowNumber')<>'number' or item->>'rowNumber' !~ '^[0-9]+$'
  or jsonb_typeof(item->'errors')<>'array' then
   raise exception using errcode='22023',message='Invalid import row envelope.'; end if;
  rn:=(item->>'rowNumber')::integer;
  if rn not between 2 and 1048576 or rn=any(seen) or jsonb_array_length(item->'errors')>20
  or exists(select 1 from jsonb_array_elements(item->'errors') e
    where jsonb_typeof(e)<>'string' or not (e#>>'{}'=any(valid_fields||array['row']))) then
   raise exception using errcode='22023',message='Invalid row number or error field.'; end if;
  seen:=array_append(seen,rn);
  d:=item->'data';
  if d='null'::jsonb then
   if jsonb_array_length(item->'errors')=0 then
    raise exception using errcode='22023',message='Invalid row requires error fields.'; end if;
  else
   perform crm_sales.check_import_fields(d);
   if jsonb_array_length(item->'errors')<>0 or d->>'source_code'<>p_input->>'sourceCode'
   or (d->>'assigned_user_id')::uuid is distinct from owner_id then
    raise exception using errcode='22023',message='Row provenance differs from the batch.'; end if;
   d:=jsonb_set(d,'{email}',coalesce(to_jsonb(lower(d->>'email')),'null'::jsonb));
  end if;
  insert into crm_sales.import_rows(batch_id,row_number,data,errors,status)
  values(v_batch_id,rn,nullif(d,'null'::jsonb),item->'errors',case when d='null'::jsonb then 'invalid' else 'ready' end);
 end loop;
 for candidate in select * from crm_sales.import_rows r where r.batch_id=v_batch_id and r.data is not null loop
  d:=candidate.data;
  select coalesce(array_agg(r.row_number order by r.row_number),'{}') into matches
  from crm_sales.import_rows r where r.batch_id=v_batch_id and r.row_number<>candidate.row_number and r.data is not null
  and ((d->>'email' is not null and r.data->>'email'=d->>'email')
   or exists(select 1 from unnest(array[d->>'phone',d->>'alternate_phone']) p
    where p is not null and p=any(array[r.data->>'phone',r.data->>'alternate_phone'])));
  select exists(select 1 from crm_sales.leads l
   where crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by)
   and ((d->>'email' is not null and l.email=d->>'email')
    or exists(select 1 from unnest(array[d->>'phone',d->>'alternate_phone']) p
     where p is not null and p=any(array[l.phone,l.alternate_phone])))) into exists_in_database;
  update crm_sales.import_rows r set duplicate_rows=matches,database_match=exists_in_database,
   status=case when cardinality(matches)>0 or exists_in_database then 'review' else 'ready' end
   where r.batch_id=v_batch_id and r.row_number=candidate.row_number;
 end loop;
 insert into crm_sales.import_events(batch_id,actor_id,action) values(v_batch_id,actor,'staged');
 insert into crm_sales.import_requests(actor_id,request_id,payload_hash,batch_id) values(actor,p_request_id,fingerprint,v_batch_id);
 return jsonb_build_object('batch',crm_sales.import_summary(v_batch_id),'replayed',false);
end;
$$;
create function public.crm_lead_import_page(p_batch_id uuid,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b crm_sales.import_batches%rowtype; result jsonb;
begin
 select * into b from crm_sales.import_batches where id=p_batch_id;
 if not found or crm_sales.import_access(b.actor_id,b.assigned_user_id) is not true then
  raise exception using errcode='42501',message='Import access unavailable.'; end if;
 if p_page is null or p_page not between 0 and 10000 then
  raise exception using errcode='22023',message='Invalid import page.'; end if;
 select jsonb_build_object('batch',crm_sales.import_summary(b.id),'page',p_page,'pageSize',20,
 'rows',coalesce((select jsonb_agg((to_jsonb(r)-'batch_id')||case when r.resulting_lead_id is not null
 and crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true
 then jsonb_build_object('data',null,'resulting_lead_id',null,'redacted',true)
 else jsonb_build_object('redacted',false) end order by r.row_number) from
  (select * from crm_sales.import_rows where batch_id=b.id order by row_number limit 20 offset p_page*20) r left join crm_sales.leads l on l.id=r.resulting_lead_id),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.id desc) from
  (select id,actor_id,action,detail,occurred_at from crm_sales.import_events where batch_id=b.id order by id desc limit 50) e),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.crm_stage_lead_import(uuid,jsonb),public.crm_lead_import_page(uuid,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.crm_stage_lead_import(uuid,jsonb),public.crm_lead_import_page(uuid,integer) to authenticated;

create function public.crm_confirm_lead_import(
 p_request_id uuid,p_batch_id uuid,p_version integer,p_skips integer[]
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); b crm_sales.import_batches%rowtype;
 receipt crm_sales.import_requests%rowtype; r crm_sales.import_rows%rowtype;
 fingerprint text; skips integer[]; changed integer[]:='{}'; saved jsonb; result jsonb;
 applied integer:=0; skipped integer:=0;
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 select * into b from crm_sales.import_batches where id=p_batch_id for update;
 if not found or crm_sales.import_access(b.actor_id,b.assigned_user_id) is not true then
  raise exception using errcode='42501',message='Import confirmation unavailable.'; end if;
 if p_request_id is null or p_version is null or p_version<1 or p_skips is null
 or cardinality(p_skips)>500 or array_position(p_skips,null) is not null
 or (select count(distinct n) from unnest(p_skips) n)<>cardinality(p_skips)
 or exists(select 1 from unnest(p_skips) n where not exists(
   select 1 from crm_sales.import_rows x where x.batch_id=b.id and x.row_number=n)) then
  raise exception using errcode='22023',message='Invalid explicit skip selection.'; end if;
 select coalesce(array_agg(n order by n),'{}') into skips from unnest(p_skips) n;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('batch',b.id,'version',p_version,'skips',skips)::text,'UTF8')),'hex');
 select * into receipt from crm_sales.import_requests x where x.actor_id=actor and x.request_id=p_request_id;
 if found then
  if receipt.kind<>'confirm' or receipt.payload_hash<>fingerprint then
   raise exception using errcode='22023',message='Request ID reused with different confirmation.'; end if;
  return receipt.result||jsonb_build_object('replayed',true);
 end if;
 if b.version<>p_version or b.status<>'staged' then
  raise exception using errcode='40001',message='Reload the current import batch.'; end if;
 if public.crm_has_permission('leads.assign','company') is not true and b.assigned_user_id is distinct from actor then
  raise exception using errcode='42501',message='New leads must be assigned to yourself.'; end if;
 if (b.assigned_user_id is not null and crm_sales.eligible_owner(b.assigned_user_id) is not true)
 or not exists(select 1 from crm_sales.sources where code=b.source_code and active) then
  raise exception using errcode='22023',message='Source or assignee is no longer eligible.'; end if;
 if exists(select 1 from crm_sales.import_rows x where x.batch_id=b.id
 and x.status in ('invalid','review') and not x.row_number=any(skips)) then
  raise exception using errcode='22023',message='Explicitly skip every invalid or review row.'; end if;
 -- Check all selected rows before creating any lead. Current visibility limits
 -- duplicate detection; no inaccessible customer IDs or details are disclosed.
 for r in select * from crm_sales.import_rows x where x.batch_id=b.id
 and not x.row_number=any(skips) order by x.row_number loop
  perform crm_sales.check_import_fields(r.data);
  if exists(select 1 from crm_sales.leads l
   where crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by)
   and ((r.data->>'email' is not null and l.email=r.data->>'email')
    or exists(select 1 from unnest(array[r.data->>'phone',r.data->>'alternate_phone']) p
     where p is not null and p=any(array[l.phone,l.alternate_phone])))) then
   changed:=array_append(changed,r.row_number);
  end if;
 end loop;
 if cardinality(changed)>0 then
  update crm_sales.import_rows set status='review',database_match=true
   where batch_id=b.id and row_number=any(changed);
  update crm_sales.import_batches set version=version+1 where id=b.id;
  insert into crm_sales.import_events(batch_id,actor_id,action,detail)
   values(b.id,actor,'duplicates_detected',jsonb_build_object('rows',changed));
  result:=jsonb_build_object('batch',crm_sales.import_summary(b.id),'applied',0,'skipped',0,'requiresReview',true,'replayed',false);
 else
  for r in select * from crm_sales.import_rows x where x.batch_id=b.id order by x.row_number loop
   if r.row_number=any(skips) then
    update crm_sales.import_rows set status='skipped' where batch_id=b.id and row_number=r.row_number;
    skipped:=skipped+1;
   else
    saved:=public.crm_save_lead(md5('s17-import:'||b.id::text||':'||r.row_number::text)::uuid,
      'create',null,null,r.data);
    update crm_sales.import_rows set status='applied',resulting_lead_id=(saved->'lead'->>'id')::uuid
     where batch_id=b.id and row_number=r.row_number;
    applied:=applied+1;
   end if;
  end loop;
  update crm_sales.import_batches set status='completed',completed_at=now(),version=version+1 where id=b.id;
  insert into crm_sales.import_events(batch_id,actor_id,action,detail)
   values(b.id,actor,'confirmed',jsonb_build_object('applied',applied,'skippedRows',skips));
  result:=jsonb_build_object('batch',crm_sales.import_summary(b.id),'applied',applied,'skipped',skipped,'requiresReview',false,'replayed',false);
 end if;
 insert into crm_sales.import_requests(actor_id,request_id,payload_hash,kind,result,batch_id)
 values(actor,p_request_id,fingerprint,'confirm',result,b.id);
 return result;
end;
$$;
revoke all on function public.crm_confirm_lead_import(uuid,uuid,integer,integer[])
 from public,anon,authenticated,service_role;
grant execute on function public.crm_confirm_lead_import(uuid,uuid,integer,integer[]) to authenticated;
notify pgrst,'reload schema';
commit;