-- Additive lead-linked requirements, rooms and internal notes. No role/Storage changes.
begin;

create function crm_sales.valid_detail(p_kind text,p_data jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare keys text[]; k text; v text; cap integer;
begin
 if p_kind is null or p_kind not in ('requirements','room','note') or p_data is null or jsonb_typeof(p_data)<>'object' then return false; end if;
 keys:=case p_kind
 when 'requirements' then array['project_type','property_type','location_description','style_preferences','material_preferences','furniture_preferences','color_preferences','budget_estimate','currency','desired_start_date','desired_completion_date','special_instructions','completion_state']
 when 'room' then array['name','room_type','sort_order','requirements_notes','measurement_notes','deliverables_notes']
 else array['body'] end;
 if not (p_data ?& keys) or exists(select 1 from jsonb_object_keys(p_data) key where not (key=any(keys))) then return false; end if;
 foreach k in array keys loop
   v:=p_data->>k;
   if k='sort_order' then
     if jsonb_typeof(p_data->k)<>'number' or v !~ '^[0-9]{1,5}$' or v::integer>10000 then return false; end if;
   else
     if jsonb_typeof(p_data->k) not in ('string','null') then return false; end if;
     if k in ('name','body','currency','completion_state') and (v is null or btrim(v)='') then return false; end if;
     cap:=case when k in ('project_type','property_type','room_type') then 100
       when k='name' then 160 when k='location_description' then 300
       when k in ('style_preferences','material_preferences','furniture_preferences','color_preferences') then 2000 else 4000 end;
     if length(v)>cap then return false; end if;
     if k='currency' and v<>'AED' then return false; end if;
     if k='completion_state' and v not in ('not_started','in_progress','completed','needs_clarification') then return false; end if;
     if k='budget_estimate' and v is not null and v !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' then return false; end if;
     if k in ('desired_start_date','desired_completion_date') and v is not null then
       if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or v::date::text<>v then return false; end if;
     end if;
   end if;
 end loop;
 if p_kind='requirements' and p_data->>'desired_start_date'>p_data->>'desired_completion_date' then return false; end if;
 return true;
exception when invalid_datetime_format or datetime_field_overflow then return false;
end;
$$;

create table crm_sales.detail_records (
 lead_id uuid not null references crm_sales.leads(id) on delete restrict,
 id uuid not null,
 kind text not null check(kind in ('requirements','room','note')),
 data jsonb not null,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_by uuid not null,
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version between 1 and 9007199254740991),
 primary key(lead_id,id),
 check(crm_sales.valid_detail(kind,data)),
 check((kind='requirements')=(id=lead_id))
);
create unique index detail_requirements_one_per_lead on crm_sales.detail_records(lead_id) where kind='requirements';
create index detail_records_page on crm_sales.detail_records(lead_id,kind,created_at,id);

create table crm_sales.detail_events (
 id bigint generated always as identity primary key,
 lead_id uuid not null,
 record_id uuid not null,
 actor_id uuid not null,
 action text not null check(action in ('created','updated')),
 before_data jsonb,
 after_data jsonb not null,
 occurred_at timestamptz not null default now(),
 foreign key(lead_id,record_id) references crm_sales.detail_records(lead_id,id) on delete restrict
);
create index detail_events_page on crm_sales.detail_events(lead_id,id desc);
create table crm_sales.detail_requests (
 actor_id uuid not null,
 request_id uuid not null,
 lead_id uuid not null,
 record_id uuid not null,
 input jsonb not null,
 result jsonb not null,
 primary key(actor_id,request_id),
 foreign key(lead_id,record_id) references crm_sales.detail_records(lead_id,id) on delete restrict
);

alter table crm_sales.detail_records enable row level security;
alter table crm_sales.detail_events enable row level security;
alter table crm_sales.detail_requests enable row level security;
create policy detail_read on crm_sales.detail_records for select to authenticated using (
 exists(select 1 from crm_sales.leads l where l.id=lead_id
   and crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by))
);
create policy detail_event_read on crm_sales.detail_events for select to authenticated using (
 exists(select 1 from crm_sales.detail_records r where r.lead_id=detail_events.lead_id and r.id=record_id)
);
revoke all on crm_sales.detail_records,crm_sales.detail_events,crm_sales.detail_requests from public,anon,authenticated,service_role;
revoke all on sequence crm_sales.detail_events_id_seq from public,anon,authenticated,service_role;
revoke all on function crm_sales.valid_detail(text,jsonb) from public,anon,authenticated,service_role;
grant select on crm_sales.detail_records,crm_sales.detail_events to authenticated;

create function public.crm_save_lead_detail(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); lead_uuid uuid; record_uuid uuid; request_uuid uuid; expected bigint;
 kind_key text; l crm_sales.leads%rowtype; r crm_sales.detail_records%rowtype;
 receipt crm_sales.detail_requests%rowtype; previous jsonb; result jsonb;
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 if actor is null or auth.role() is distinct from 'authenticated' or crm_access.is_eligible_user(actor) is not true then
   raise exception using errcode='42501',message='Active authenticated employee required.'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object'
   or not (p_input ?& array['command','requestId','leadId','version','data'])
   or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('command','requestId','leadId','version','data','recordId'))
   or jsonb_typeof(p_input->'command')<>'string' or jsonb_typeof(p_input->'requestId')<>'string'
   or jsonb_typeof(p_input->'leadId')<>'string' then
   raise exception using errcode='22023',message='Invalid detail command.'; end if;
 kind_key:=case p_input->>'command' when 'save_requirements' then 'requirements' when 'save_room' then 'room' when 'save_note' then 'note' end;
 if kind_key is null or crm_sales.valid_detail(kind_key,p_input->'data') is not true
   or (kind_key='requirements' and p_input ? 'recordId')
   or (kind_key<>'requirements' and (not (p_input ? 'recordId') or jsonb_typeof(p_input->'recordId')<>'string')) then
   raise exception using errcode='22023',message='Invalid detail fields.'; end if;
 request_uuid:=(p_input->>'requestId')::uuid; lead_uuid:=(p_input->>'leadId')::uuid;
 record_uuid:=case when kind_key='requirements' then lead_uuid else (p_input->>'recordId')::uuid end;
 if jsonb_typeof(p_input->'version')='null' then expected:=null;
 elsif jsonb_typeof(p_input->'version')='number' and p_input->>'version' ~ '^[1-9][0-9]{0,15}$'
   and (p_input->>'version')::numeric<=9007199254740991 then expected:=(p_input->>'version')::bigint;
 else raise exception using errcode='22023',message='Invalid record version.'; end if;
 if kind_key<>'requirements' and record_uuid=lead_uuid then
   raise exception using errcode='22023',message='Room/note identity must differ from its lead.'; end if;
 select * into l from crm_sales.leads where id=lead_uuid for update;
 if not found or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true
   or crm_sales.allowed('leads.update',l.assigned_user_id,l.created_by) is not true then
   raise exception using errcode='42501',message='Lead detail update is not permitted.'; end if;
 select * into r from crm_sales.detail_records where lead_id=lead_uuid and id=record_uuid for update;
 if r.id is not null and (r.kind<>kind_key or (kind_key='note' and r.created_by<>actor
   and public.crm_has_permission('leads.update','company') is not true)) then
   raise exception using errcode='42501',message='Record update is not permitted.'; end if;
 select * into receipt from crm_sales.detail_requests where actor_id=actor and request_id=request_uuid;
 if found then
   if receipt.input<>p_input then raise exception using errcode='22023',message='Request ID was used for different input.'; end if;
   return receipt.result||jsonb_build_object('replayed',true);
 end if;
 if l.archived_at is not null or l.stage='lost' or (r.id is null and expected is not null)
   or (r.id is not null and (expected is null or r.version<>expected)) then
   raise exception using errcode='40001',message='Record changed or lead is read-only. Reload before retrying.'; end if;
 previous:=case when r.id is null then null else to_jsonb(r) end;
 if r.id is null then
   insert into crm_sales.detail_records(lead_id,id,kind,data,created_by,updated_by)
     values(lead_uuid,record_uuid,kind_key,p_input->'data',actor,actor) returning * into r;
 elsif r.data is distinct from p_input->'data' then
   update crm_sales.detail_records set data=p_input->'data',version=version+1,updated_by=actor,updated_at=now()
     where lead_id=lead_uuid and id=record_uuid returning * into r;
 end if;
 if previous is distinct from to_jsonb(r) then
   insert into crm_sales.detail_events(lead_id,record_id,actor_id,action,before_data,after_data)
     values(lead_uuid,record_uuid,actor,case when previous is null then 'created' else 'updated' end,previous,to_jsonb(r));
 end if;
 result:=jsonb_build_object('record',to_jsonb(r),'replayed',false);
 insert into crm_sales.detail_requests(actor_id,request_id,lead_id,record_id,input,result)
   values(actor,request_uuid,lead_uuid,record_uuid,p_input,result);
 return result;
end;
$$;

create function public.crm_lead_details(p_lead_id uuid,p_kind text,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l crm_sales.leads%rowtype; result jsonb;
begin
 if auth.uid() is null or auth.role() is distinct from 'authenticated' or crm_access.is_eligible_user(auth.uid()) is not true then
   raise exception using errcode='42501',message='Active authenticated employee required.'; end if;
 if p_lead_id is null or p_kind is null or p_kind not in ('requirements','room','note') or p_page is null or p_page not between 0 and 10000 then
   raise exception using errcode='22023',message='Invalid detail page.'; end if;
 select * into l from crm_sales.leads where id=p_lead_id;
 if not found or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true then
   raise exception using errcode='42501',message='Lead detail visibility required.'; end if;
 with selected as (
   select * from crm_sales.detail_records where lead_id=p_lead_id and kind=p_kind
   order by case when p_kind='room' then (data->>'sort_order')::integer end,created_at,id limit 20 offset p_page*20
 ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(s) order by
   case when p_kind='room' then (s.data->>'sort_order')::integer end,s.created_at,s.id) from selected s),'[]'::jsonb),
   'total',(select count(*) from crm_sales.detail_records where lead_id=p_lead_id and kind=p_kind),
   'page',p_page,'pageSize',20,'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.id desc) from (
     select e.* from crm_sales.detail_events e join crm_sales.detail_records r on r.lead_id=e.lead_id and r.id=e.record_id
     where e.lead_id=p_lead_id and r.kind=p_kind order by e.id desc limit 50) e),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.crm_save_lead_detail(jsonb),public.crm_lead_details(uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.crm_save_lead_detail(jsonb),public.crm_lead_details(uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;