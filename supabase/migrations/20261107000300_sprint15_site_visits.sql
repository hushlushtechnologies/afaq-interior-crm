-- Approved Sprint 15 site visits. Additive; no role, Storage or notification changes.
begin;
create table crm_sales.site_visits (
 id uuid primary key,
 lead_id uuid not null references crm_sales.leads(id) on delete restrict,
 scheduled_at timestamptz not null check(isfinite(scheduled_at)),
 assigned_user_id uuid,
 location text check(length(location)<=300),
 notes text check(length(notes)<=4000),
 measurements text check(length(measurements)<=4000),
 observations text check(length(observations)<=4000),
 status text not null default 'planned' check(status in ('planned','completed','cancelled')),
 actual_at timestamptz check(isfinite(actual_at)),
 outcome text check(length(btrim(outcome)) between 1 and 4000 and outcome ~ '[[:alnum:]]'),
 cancellation_reason text check(length(btrim(cancellation_reason)) between 1 and 2000 and cancellation_reason ~ '[[:alnum:]]'),
 finalized_by uuid,
 finalized_at timestamptz,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_by uuid not null,
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version between 1 and 9007199254740991),
 unique(lead_id,id),
 check((status='planned' and actual_at is null and outcome is null and cancellation_reason is null and finalized_by is null and finalized_at is null)
   or (status='completed' and actual_at is not null and outcome is not null and cancellation_reason is null and finalized_by is not null and finalized_at is not null)
   or (status='cancelled' and actual_at is null and outcome is null and cancellation_reason is not null and finalized_by is not null and finalized_at is not null))
);
create index site_visits_page on crm_sales.site_visits(lead_id,scheduled_at desc,id);
create table crm_sales.visit_events (
 id bigint generated always as identity primary key,
 lead_id uuid not null,
 visit_id uuid not null,
 actor_id uuid not null,
 actions text[] not null check(cardinality(actions) between 1 and 3 and actions <@ array['created','scheduled','assigned','updated','status_changed','completed','cancelled']),
 before_data jsonb,
 after_data jsonb not null,
 occurred_at timestamptz not null default now(),
 foreign key(lead_id,visit_id) references crm_sales.site_visits(lead_id,id) on delete restrict
);
create index visit_events_page on crm_sales.visit_events(lead_id,id desc);
create table crm_sales.visit_requests (
 actor_id uuid not null,
 request_id uuid not null,
 lead_id uuid not null,
 visit_id uuid not null,
 input jsonb not null,
 result jsonb not null,
 primary key(actor_id,request_id),
 foreign key(lead_id,visit_id) references crm_sales.site_visits(lead_id,id) on delete restrict
);
create function crm_sales.guard_visit()
returns trigger language plpgsql set search_path='' as $$
begin
 if (new.id,new.lead_id,new.created_by,new.created_at) is distinct from (old.id,old.lead_id,old.created_by,old.created_at)
   or (old.status<>'planned' and new is distinct from old) then
   raise exception using errcode='42501',message='Visit identity and finalized visits are immutable.'; end if;
 return new;
end;
$$;
create trigger guard_visit before update on crm_sales.site_visits for each row execute function crm_sales.guard_visit();
alter table crm_sales.site_visits enable row level security;
alter table crm_sales.visit_events enable row level security;
alter table crm_sales.visit_requests enable row level security;
create policy visit_read on crm_sales.site_visits for select to authenticated using(
 exists(select 1 from crm_sales.leads l where l.id=lead_id and crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by))
);
create policy visit_event_read on crm_sales.visit_events for select to authenticated using(
 exists(select 1 from crm_sales.site_visits v where v.lead_id=visit_events.lead_id and v.id=visit_id)
);
revoke all on crm_sales.site_visits,crm_sales.visit_events,crm_sales.visit_requests from public,anon,authenticated,service_role;
revoke all on sequence crm_sales.visit_events_id_seq from public,anon,authenticated,service_role;
revoke all on function crm_sales.guard_visit() from public,anon,authenticated,service_role;
grant select on crm_sales.site_visits,crm_sales.visit_events to authenticated;

create function crm_sales.visit_time(p_value text)
returns timestamptz language plpgsql stable set search_path='' as $$
declare result timestamptz;
begin
 if p_value is null or p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-5][0-9])$' then
   raise exception using errcode='22023',message='Explicit ISO timestamp and timezone required.'; end if;
 result:=p_value::timestamptz;
 if not isfinite(result) then raise exception using errcode='22023',message='Finite timestamp required.'; end if;
 return result;
end;
$$;
revoke all on function crm_sales.visit_time(text) from public,anon,authenticated,service_role;

create function public.crm_save_site_visit(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); command text; request_uuid uuid; visit_uuid uuid; expected bigint;
 l crm_sales.leads%rowtype; v crm_sales.site_visits%rowtype; receipt crm_sales.visit_requests%rowtype;
 data jsonb; before_value jsonb; result jsonb; owner_uuid uuid; schedule timestamptz; actual timestamptz;
 field text; keys text[]; actions text[]:=array[]::text[];
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 if actor is null or auth.role() is distinct from 'authenticated' or crm_access.is_eligible_user(actor) is not true then
   raise exception using errcode='42501',message='Active authenticated employee required.'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object'
   or not(p_input ?& array['command','requestId','leadId','visitId','version','data'])
   or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('command','requestId','leadId','visitId','version','data')) then
   raise exception using errcode='22023',message='Invalid visit command.'; end if;
 foreach field in array array['command','requestId','leadId','visitId'] loop
   if jsonb_typeof(p_input->field)<>'string' then raise exception using errcode='22023',message='Invalid visit identity.'; end if;
 end loop;
 command:=p_input->>'command'; data:=p_input->'data';
 if command not in ('create','update','complete','cancel') or jsonb_typeof(data)<>'object' then
   raise exception using errcode='22023',message='Invalid visit operation.'; end if;
 request_uuid:=(p_input->>'requestId')::uuid; visit_uuid:=(p_input->>'visitId')::uuid;
 if command='create' then
   if jsonb_typeof(p_input->'version')<>'null' then raise exception using errcode='22023',message='Creation requires a null version.'; end if;
 else
   if jsonb_typeof(p_input->'version')<>'number' or p_input->>'version' !~ '^[1-9][0-9]{0,15}$'
     or (p_input->>'version')::numeric>9007199254740991 then raise exception using errcode='22023',message='Invalid visit version.'; end if;
   expected:=(p_input->>'version')::bigint;
 end if;
 select * into l from crm_sales.leads where id=(p_input->>'leadId')::uuid for update;
 if not found or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true
   or crm_sales.allowed('leads.update',l.assigned_user_id,l.created_by) is not true then
   raise exception using errcode='42501',message='Lead visit update is not permitted.'; end if;
 select * into v from crm_sales.site_visits where id=visit_uuid for update;
 if v.id is not null and v.lead_id<>l.id then raise exception using errcode='42501',message='Visit is unavailable.'; end if;
 select * into receipt from crm_sales.visit_requests where actor_id=actor and request_id=request_uuid;
 if found then
   if receipt.input<>p_input then raise exception using errcode='22023',message='Request ID was used for different input.'; end if;
   return receipt.result||jsonb_build_object('replayed',true);
 end if;
 if l.archived_at is not null or l.stage='lost' or (command='create' and v.id is not null)
   or (command<>'create' and (v.id is null or v.version<>expected or v.status<>'planned')) then
   raise exception using errcode='40001',message='Visit changed, is finalized or its lead is read-only.'; end if;
 keys:=case when command in ('create','update') then array['scheduled_at','assigned_user_id','location','notes','measurements','observations']
   when command='complete' then array['actual_at','outcome'] else array['reason'] end;
 if not(data ?& keys) or exists(select 1 from jsonb_object_keys(data) k where not(k=any(keys))) then
   raise exception using errcode='22023',message='Unexpected or missing visit fields.'; end if;
 foreach field in array keys loop
   if jsonb_typeof(data->field) not in ('string','null') or length(data->>field)>(case when field='location' then 300 when field='reason' then 2000 else 4000 end) then
     raise exception using errcode='22023',message='Invalid visit field.'; end if;
 end loop;
 before_value:=case when v.id is null then null else to_jsonb(v) end;
 if command in ('create','update') then
   schedule:=crm_sales.visit_time(data->>'scheduled_at'); owner_uuid:=(data->>'assigned_user_id')::uuid;
   if owner_uuid is not null and (command='create' or owner_uuid is distinct from v.assigned_user_id)
     and (owner_uuid is distinct from l.assigned_user_id or crm_sales.eligible_owner(owner_uuid) is not true) then
     raise exception using errcode='22023',message='Assign only the current active Sales owner or leave unassigned.'; end if;
   if command='create' then
     insert into crm_sales.site_visits(id,lead_id,scheduled_at,assigned_user_id,created_by,updated_by)
       values(visit_uuid,l.id,schedule,owner_uuid,actor,actor) returning * into v;
     actions:=array['created'];
   else
     if schedule is distinct from v.scheduled_at then actions:=array_append(actions,'scheduled'); end if;
     if owner_uuid is distinct from v.assigned_user_id then actions:=array_append(actions,'assigned'); end if;
     if (nullif(btrim(data->>'location'),''),nullif(btrim(data->>'notes'),''),nullif(btrim(data->>'measurements'),''),nullif(btrim(data->>'observations'),''))
       is distinct from (v.location,v.notes,v.measurements,v.observations) then actions:=array_append(actions,'updated'); end if;
   end if;
   if command='create' or cardinality(actions)>0 then
     update crm_sales.site_visits set scheduled_at=schedule,assigned_user_id=owner_uuid,
       location=nullif(btrim(data->>'location'),''),notes=nullif(btrim(data->>'notes'),''),
       measurements=nullif(btrim(data->>'measurements'),''),observations=nullif(btrim(data->>'observations'),''),
       version=case when command='create' then 1 else version+1 end,updated_by=actor,updated_at=now()
       where id=v.id returning * into v;
   end if;
 elsif command='complete' then
   actual:=crm_sales.visit_time(data->>'actual_at');
   if actual>now() or coalesce(btrim(data->>'outcome'),'') !~ '[[:alnum:]]' then
     raise exception using errcode='22023',message='Completion requires a nonfuture actual time and meaningful outcome.'; end if;
   update crm_sales.site_visits set status='completed',actual_at=actual,outcome=btrim(data->>'outcome'),
     finalized_by=actor,finalized_at=now(),updated_by=actor,updated_at=now(),version=version+1 where id=v.id returning * into v;
   actions:=array['status_changed','completed'];
 else
   if coalesce(btrim(data->>'reason'),'') !~ '[[:alnum:]]' then raise exception using errcode='22023',message='Cancellation reason required.'; end if;
   update crm_sales.site_visits set status='cancelled',cancellation_reason=btrim(data->>'reason'),finalized_by=actor,
     finalized_at=now(),updated_by=actor,updated_at=now(),version=version+1 where id=v.id returning * into v;
   actions:=array['status_changed','cancelled'];
 end if;
 if cardinality(actions)>0 then
   insert into crm_sales.visit_events(lead_id,visit_id,actor_id,actions,before_data,after_data)
     values(l.id,v.id,actor,actions,before_value,to_jsonb(v));
 end if;
 result:=jsonb_build_object('visit',to_jsonb(v),'replayed',false);
 insert into crm_sales.visit_requests(actor_id,request_id,lead_id,visit_id,input,result) values(actor,request_uuid,l.id,v.id,p_input,result);
 return result;
end;
$$;

create function public.crm_site_visits(p_lead_id uuid,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l crm_sales.leads%rowtype; result jsonb;
begin
 if auth.uid() is null or auth.role() is distinct from 'authenticated' or crm_access.is_eligible_user(auth.uid()) is not true then
   raise exception using errcode='42501',message='Active authenticated employee required.'; end if;
 if p_lead_id is null or p_page is null or p_page not between 0 and 10000 then raise exception using errcode='22023',message='Invalid visit page.'; end if;
 select * into l from crm_sales.leads where id=p_lead_id;
 if not found or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true then
   raise exception using errcode='42501',message='Lead visit visibility required.'; end if;
 with selected as(select * from crm_sales.site_visits where lead_id=l.id order by scheduled_at desc,id limit 20 offset p_page*20)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object(
   'needs_assignment_review',v.status='planned' and v.assigned_user_id is not null and
     (v.assigned_user_id is distinct from l.assigned_user_id or crm_sales.eligible_owner(v.assigned_user_id) is not true)) order by v.scheduled_at desc,v.id) from selected v),'[]'::jsonb),
   'total',(select count(*) from crm_sales.site_visits where lead_id=l.id),'page',p_page,'pageSize',20,
   'readOnly',l.archived_at is not null or l.stage='lost' or crm_sales.allowed('leads.update',l.assigned_user_id,l.created_by) is not true,
   'owner',case when crm_sales.eligible_owner(l.assigned_user_id) then (select jsonb_build_object('id',u.id,'name',coalesce(e.display_name,u.email,u.id::text))
     from auth.users u left join crm_employees.employees e on e.auth_user_id=u.id where u.id=l.assigned_user_id) else null end,
   'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.id desc) from (select * from crm_sales.visit_events where lead_id=l.id order by id desc limit 50)e),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.crm_save_site_visit(jsonb),public.crm_site_visits(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.crm_save_site_visit(jsonb),public.crm_site_visits(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;