-- Sprint 16 local lead activities/follow-ups. No roles, scheduler or delivery changes.
begin;

create function crm_sales.sales_evidence(p_value text,p_max integer)
returns boolean language sql immutable set search_path='' as $$
 select p_value is not null
   and length(btrim(p_value)) between 1 and p_max
   and p_value ~ '[[:alnum:]]';
$$;

create table crm_sales.follow_ups (
 id uuid primary key,
 lead_id uuid not null references crm_sales.leads(id) on delete restrict,
 title text not null check(crm_sales.sales_evidence(title,160)),
 description text check(length(description)<=4000),
 kind text not null check(
   kind in ('call','meeting','site_visit','whatsapp','email','follow_up')
 ),
 priority text not null check(priority in ('low','normal','high','urgent')),
 assigned_user_id uuid not null,
 due_at timestamptz not null check(isfinite(due_at)),
 status text not null default 'open'
   check(status in ('open','completed','cancelled')),
 actual_at timestamptz check(isfinite(actual_at)),
 outcome text check(
   outcome is null or crm_sales.sales_evidence(outcome,4000)
 ),
 cancellation_reason text check(
   cancellation_reason is null
   or crm_sales.sales_evidence(cancellation_reason,2000)
 ),
 completed_activity_id uuid,
 finalized_by uuid,
 finalized_at timestamptz,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_by uuid not null,
 updated_at timestamptz not null default now(),
 version bigint not null default 1
   check(version between 1 and 9007199254740991),
 unique(lead_id,id),
 check(
   (
     status='open'
     and actual_at is null
     and outcome is null
     and cancellation_reason is null
     and completed_activity_id is null
     and finalized_by is null
     and finalized_at is null
   )
   or (
     status='completed'
     and actual_at is not null
     and outcome is not null
     and cancellation_reason is null
     and completed_activity_id is not null
     and finalized_by is not null
     and finalized_at is not null
   )
   or (
     status='cancelled'
     and actual_at is null
     and outcome is null
     and cancellation_reason is not null
     and completed_activity_id is null
     and finalized_by is not null
     and finalized_at is not null
   )
 )
);

create index follow_ups_owner_due
 on crm_sales.follow_ups(assigned_user_id,status,due_at,id);

create index follow_ups_lead_due
 on crm_sales.follow_ups(lead_id,status,due_at,id);

create table crm_sales.manual_activities (
 id uuid primary key,
 lead_id uuid not null references crm_sales.leads(id) on delete restrict,
 kind text not null check(
   kind in ('call','meeting','whatsapp','email','follow_up')
 ),
 summary text not null check(crm_sales.sales_evidence(summary,160)),
 occurred_at timestamptz not null check(isfinite(occurred_at)),
 outcome text check(length(outcome)<=4000),
 notes text check(length(notes)<=4000),
 follow_up_id uuid,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 unique(lead_id,id),
 unique(lead_id,follow_up_id,id),
 unique(follow_up_id),
 check((kind='follow_up')=(follow_up_id is not null)),
 check(
   kind<>'follow_up'
   or crm_sales.sales_evidence(outcome,4000)
 ),
 foreign key(lead_id,follow_up_id)
   references crm_sales.follow_ups(lead_id,id) on delete restrict
);

alter table crm_sales.follow_ups
 add foreign key(lead_id,id,completed_activity_id)
 references crm_sales.manual_activities(lead_id,follow_up_id,id)
 on delete no action deferrable initially deferred;

create index manual_activities_page
 on crm_sales.manual_activities(
   lead_id,occurred_at desc,created_at desc,id
 );

create table crm_sales.follow_up_events (
 id bigint generated always as identity primary key,
 lead_id uuid not null,
 follow_up_id uuid not null,
 actor_id uuid not null,
 actions text[] not null check(
   cardinality(actions) between 1 and 2
   and actions <@ array[
     'created','updated','reassigned',
     'rescheduled','completed','cancelled'
   ]
 ),
 reason text check(length(reason)<=4000),
 before_data jsonb,
 after_data jsonb not null,
 occurred_at timestamptz not null default now(),
 foreign key(lead_id,follow_up_id)
   references crm_sales.follow_ups(lead_id,id) on delete restrict
);

create index follow_up_events_page
 on crm_sales.follow_up_events(lead_id,id desc);

create table crm_sales.sales_requests (
 actor_id uuid not null,
 request_id uuid not null,
 lead_id uuid not null references crm_sales.leads(id) on delete restrict,
 api_kind text not null check(api_kind in ('follow_up','activity')),
 input jsonb not null,
 result jsonb not null,
 primary key(actor_id,request_id)
);

create function crm_sales.guard_follow_up()
returns trigger language plpgsql set search_path='' as $$
begin
 if (
   new.id,new.lead_id,new.created_by,new.created_at
 ) is distinct from (
   old.id,old.lead_id,old.created_by,old.created_at
 )
 or (old.status<>'open' and new is distinct from old) then
   raise exception using
     errcode='42501',
     message='Follow-up identity and finalized records are immutable.';
 end if;
 return new;
end;
$$;

create trigger guard_follow_up
 before update on crm_sales.follow_ups
 for each row execute function crm_sales.guard_follow_up();

create function crm_sales.guard_manual_activity()
returns trigger language plpgsql set search_path='' as $$
begin
 if new is distinct from old then
   raise exception using
     errcode='42501',
     message='Recorded activities are immutable.';
 end if;
 return new;
end;
$$;

create trigger guard_manual_activity
 before update on crm_sales.manual_activities
 for each row execute function crm_sales.guard_manual_activity();

alter table crm_sales.follow_ups enable row level security;
alter table crm_sales.manual_activities enable row level security;
alter table crm_sales.follow_up_events enable row level security;
alter table crm_sales.sales_requests enable row level security;

create policy follow_up_read
 on crm_sales.follow_ups for select to authenticated
 using(
   exists(
     select 1 from crm_sales.leads l
     where l.id=lead_id
       and crm_sales.allowed(
         'leads.view',l.assigned_user_id,l.created_by
       )
   )
 );

create policy manual_activity_read
 on crm_sales.manual_activities for select to authenticated
 using(
   exists(
     select 1 from crm_sales.leads l
     where l.id=lead_id
       and crm_sales.allowed(
         'leads.view',l.assigned_user_id,l.created_by
       )
   )
 );

create policy follow_up_event_read
 on crm_sales.follow_up_events for select to authenticated
 using(
   exists(
     select 1 from crm_sales.follow_ups f
     where f.lead_id=follow_up_events.lead_id
       and f.id=follow_up_id
   )
 );

revoke all on
 crm_sales.follow_ups,
 crm_sales.manual_activities,
 crm_sales.follow_up_events,
 crm_sales.sales_requests
 from public,anon,authenticated,service_role;

revoke all on sequence crm_sales.follow_up_events_id_seq
 from public,anon,authenticated,service_role;

revoke all on function
 crm_sales.sales_evidence(text,integer),
 crm_sales.guard_follow_up(),
 crm_sales.guard_manual_activity()
 from public,anon,authenticated,service_role;

grant select on
 crm_sales.follow_ups,
 crm_sales.manual_activities,
 crm_sales.follow_up_events
 to authenticated;

create function public.crm_save_follow_up(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid();
 l crm_sales.leads%rowtype;
 f crm_sales.follow_ups%rowtype;
 receipt crm_sales.sales_requests%rowtype;
 command text;
 request_uuid uuid;
 record_uuid uuid;
 expected bigint;
 payload jsonb;
 keys text[];
 field text;
 owner_uuid uuid;
 stamp timestamptz;
 before_value jsonb;
 actions text[]:=array[]::text[];
 result jsonb;
 activity_uuid uuid;
begin
 perform pg_advisory_xact_lock(90310001::bigint);

 if auth.role() is distinct from 'authenticated'
   or actor is null
   or crm_access.is_eligible_user(actor) is not true then
   raise exception using
     errcode='42501',message='Active employee required.';
 end if;

 if p_input is null
   or jsonb_typeof(p_input)<>'object'
   or not(
     p_input ?& array[
       'requestId','leadId','followUpId','command','version','data'
     ]
   )
   or exists(
     select 1 from jsonb_object_keys(p_input) k
     where k not in (
       'requestId','leadId','followUpId','command','version','data'
     )
   ) then
   raise exception using
     errcode='22023',message='Invalid follow-up request.';
 end if;

 foreach field in array
   array['requestId','leadId','followUpId','command']
 loop
   if jsonb_typeof(p_input->field)<>'string' then
     raise exception using
       errcode='22023',message='Invalid identity.';
   end if;
 end loop;

 request_uuid:=(p_input->>'requestId')::uuid;
 record_uuid:=(p_input->>'followUpId')::uuid;
 command:=p_input->>'command';
 payload:=p_input->'data';

 if command not in (
   'create','update','reschedule','complete','cancel'
 ) or jsonb_typeof(payload)<>'object' then
   raise exception using
     errcode='22023',message='Invalid follow-up command.';
 end if;

 if command='create' then
   if jsonb_typeof(p_input->'version')<>'null' then
     raise exception using
       errcode='22023',message='Creation requires a null version.';
   end if;
 else
   if jsonb_typeof(p_input->'version')<>'number'
     or p_input->>'version' !~ '^[1-9][0-9]{0,15}$'
     or (p_input->>'version')::numeric>9007199254740991 then
     raise exception using
       errcode='22023',message='Invalid version.';
   end if;
   expected:=(p_input->>'version')::bigint;
 end if;

 select * into l
 from crm_sales.leads
 where id=(p_input->>'leadId')::uuid
 for update;

 if not found
   or crm_sales.allowed(
     'leads.view',l.assigned_user_id,l.created_by
   ) is not true
   or crm_sales.allowed(
     'leads.update',l.assigned_user_id,l.created_by
   ) is not true then
   raise exception using
     errcode='42501',message='Follow-up update denied.';
 end if;

 select * into f
 from crm_sales.follow_ups
 where id=record_uuid
 for update;

 if f.id is not null and f.lead_id<>l.id then
   raise exception using
     errcode='42501',message='Follow-up unavailable.';
 end if;

 select * into receipt
 from crm_sales.sales_requests
 where actor_id=actor and request_id=request_uuid;

 if found then
   if receipt.api_kind<>'follow_up'
     or receipt.input<>p_input then
     raise exception using
       errcode='22023',message='Request ID already used.';
   end if;
   return receipt.result||jsonb_build_object('replayed',true);
 end if;

 if l.archived_at is not null
   or l.stage='lost'
   or (command='create' and f.id is not null)
   or (
     command<>'create'
     and (
       f.id is null or f.version<>expected or f.status<>'open'
     )
   ) then
   raise exception using
     errcode='40001',
     message='Follow-up changed, finalized or lead is read-only.';
 end if;

 keys:=case command
   when 'create' then array[
     'title','description','kind','priority','assigned_user_id','due_at'
   ]
   when 'update' then array[
     'title','description','kind','priority','assigned_user_id'
   ]
   when 'reschedule' then array['due_at','reason']
   when 'complete' then array['actual_at','outcome']
   else array['reason']
 end;

 if not(payload ?& keys)
   or exists(
     select 1 from jsonb_object_keys(payload) k
     where not(k=any(keys))
   ) then
   raise exception using
     errcode='22023',
     message='Unexpected or missing follow-up fields.';
 end if;

 foreach field in array keys loop
   if jsonb_typeof(payload->field) not in ('string','null') then
     raise exception using
       errcode='22023',message='Invalid field type.';
   end if;
 end loop;

 before_value:=case
   when f.id is null then null else to_jsonb(f)
 end;

 owner_uuid:=case
   when command in ('create','update')
     then (payload->>'assigned_user_id')::uuid
   else f.assigned_user_id
 end;

 if command<>'cancel' and (
   owner_uuid is null
   or owner_uuid is distinct from l.assigned_user_id
   or crm_sales.eligible_owner(owner_uuid) is not true
 ) then
   raise exception using
     errcode='22023',
     message='Assign/reassign to the current active Sales owner before proceeding.';
 end if;

 if command='create' then
   stamp:=crm_sales.visit_time(payload->>'due_at');

   insert into crm_sales.follow_ups(
     id,lead_id,title,description,kind,priority,
     assigned_user_id,due_at,created_by,updated_by
   )
   values(
     record_uuid,l.id,btrim(payload->>'title'),
     nullif(btrim(payload->>'description'),''),
     payload->>'kind',payload->>'priority',
     owner_uuid,stamp,actor,actor
   )
   returning * into f;

   actions:=array['created'];

 elsif command='update' then
   if (
     f.title,f.description,f.kind,f.priority,f.assigned_user_id
   ) is distinct from (
     btrim(payload->>'title'),
     nullif(btrim(payload->>'description'),''),
     payload->>'kind',payload->>'priority',owner_uuid
   ) then
     if f.assigned_user_id is distinct from owner_uuid then
       actions:=array_append(actions,'reassigned');
     end if;

     if (
       f.title,f.description,f.kind,f.priority
     ) is distinct from (
       btrim(payload->>'title'),
       nullif(btrim(payload->>'description'),''),
       payload->>'kind',payload->>'priority'
     ) then
       actions:=array_append(actions,'updated');
     end if;

     update crm_sales.follow_ups
     set title=btrim(payload->>'title'),
       description=nullif(btrim(payload->>'description'),''),
       kind=payload->>'kind',
       priority=payload->>'priority',
       assigned_user_id=owner_uuid,
       version=version+1,
       updated_by=actor,
       updated_at=now()
     where id=f.id
     returning * into f;
   end if;

 elsif command='reschedule' then
   stamp:=crm_sales.visit_time(payload->>'due_at');

   if crm_sales.sales_evidence(payload->>'reason',2000) is not true then
     raise exception using
       errcode='22023',message='Reschedule reason required.';
   end if;

   if stamp is distinct from f.due_at then
     update crm_sales.follow_ups
     set due_at=stamp,
       version=version+1,
       updated_by=actor,
       updated_at=now()
     where id=f.id
     returning * into f;

     actions:=array['rescheduled'];
   end if;

 elsif command='complete' then
   stamp:=crm_sales.visit_time(payload->>'actual_at');

   if stamp>clock_timestamp()
     or crm_sales.sales_evidence(
       payload->>'outcome',4000
     ) is not true then
     raise exception using
       errcode='22023',
       message='Nonfuture actual time and meaningful outcome required.';
   end if;

   activity_uuid:=gen_random_uuid();

   insert into crm_sales.manual_activities(
     id,lead_id,kind,summary,occurred_at,
     outcome,follow_up_id,created_by
   )
   values(
     activity_uuid,l.id,'follow_up',f.title,stamp,
     btrim(payload->>'outcome'),f.id,actor
   );

   update crm_sales.follow_ups
   set status='completed',
     actual_at=stamp,
     outcome=btrim(payload->>'outcome'),
     completed_activity_id=activity_uuid,
     finalized_by=actor,
     finalized_at=now(),
     version=version+1,
     updated_by=actor,
     updated_at=now()
   where id=f.id
   returning * into f;

   actions:=array['completed'];

 else
   if crm_sales.sales_evidence(payload->>'reason',2000) is not true then
     raise exception using
       errcode='22023',message='Cancellation reason required.';
   end if;

   update crm_sales.follow_ups
   set status='cancelled',
     cancellation_reason=btrim(payload->>'reason'),
     finalized_by=actor,
     finalized_at=now(),
     version=version+1,
     updated_by=actor,
     updated_at=now()
   where id=f.id
   returning * into f;

   actions:=array['cancelled'];
 end if;

 if cardinality(actions)>0 then
   insert into crm_sales.follow_up_events(
     lead_id,follow_up_id,actor_id,actions,
     reason,before_data,after_data
   )
   values(
     l.id,f.id,actor,actions,
     coalesce(payload->>'reason',payload->>'outcome'),
     before_value,to_jsonb(f)
   );
 end if;

 result:=jsonb_build_object(
   'followUp',to_jsonb(f),'replayed',false
 );

 insert into crm_sales.sales_requests(
   actor_id,request_id,lead_id,api_kind,input,result
 )
 values(
   actor,request_uuid,l.id,'follow_up',p_input,result
 );

 return result;
end;
$$;

create function public.crm_log_manual_activity(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid();
 l crm_sales.leads%rowtype;
 a crm_sales.manual_activities%rowtype;
 receipt crm_sales.sales_requests%rowtype;
 payload jsonb;
 request_uuid uuid;
 activity_uuid uuid;
 stamp timestamptz;
 field text;
 result jsonb;
begin
 perform pg_advisory_xact_lock(90310001::bigint);

 if auth.role() is distinct from 'authenticated'
   or actor is null
   or crm_access.is_eligible_user(actor) is not true then
   raise exception using
     errcode='42501',message='Active employee required.';
 end if;

 if p_input is null
   or jsonb_typeof(p_input)<>'object'
   or not(
     p_input ?& array[
       'requestId','leadId','activityId','command','data'
     ]
   )
   or exists(
     select 1 from jsonb_object_keys(p_input) k
     where k not in (
       'requestId','leadId','activityId','command','data'
     )
   )
   or p_input->>'command' is distinct from 'log' then
   raise exception using
     errcode='22023',message='Invalid manual log.';
 end if;

 foreach field in array
   array['requestId','leadId','activityId','command']
 loop
   if jsonb_typeof(p_input->field)<>'string' then
     raise exception using
       errcode='22023',message='Invalid activity identity.';
   end if;
 end loop;

 request_uuid:=(p_input->>'requestId')::uuid;
 activity_uuid:=(p_input->>'activityId')::uuid;

 select * into l
 from crm_sales.leads
 where id=(p_input->>'leadId')::uuid
 for update;

 if not found
   or crm_sales.allowed(
     'leads.view',l.assigned_user_id,l.created_by
   ) is not true
   or crm_sales.allowed(
     'leads.update',l.assigned_user_id,l.created_by
   ) is not true then
   raise exception using
     errcode='42501',message='Activity logging denied.';
 end if;

 select * into receipt
 from crm_sales.sales_requests
 where actor_id=actor and request_id=request_uuid;

 if found then
   if receipt.api_kind<>'activity'
     or receipt.input<>p_input then
     raise exception using
       errcode='22023',message='Request ID already used.';
   end if;
   return receipt.result||jsonb_build_object('replayed',true);
 end if;

 if l.archived_at is not null
   or l.stage='lost'
   or exists(
     select 1 from crm_sales.manual_activities
     where id=activity_uuid
   ) then
   raise exception using
     errcode='40001',
     message='Activity conflicts or lead is read-only.';
 end if;

 payload:=p_input->'data';

 if jsonb_typeof(payload)<>'object'
   or not(
     payload ?& array[
       'kind','summary','occurred_at','outcome','notes'
     ]
   )
   or exists(
     select 1 from jsonb_object_keys(payload) k
     where k not in (
       'kind','summary','occurred_at','outcome','notes'
     )
   )
   or payload->>'kind' is null
   or payload->>'kind' not in (
     'call','meeting','whatsapp','email'
   ) then
   raise exception using
     errcode='22023',
     message='Only manual communication logs are accepted.';
 end if;

 foreach field in array
   array['kind','summary','occurred_at','outcome','notes']
 loop
   if jsonb_typeof(payload->field) not in ('string','null') then
     raise exception using
       errcode='22023',message='Invalid activity field.';
   end if;
 end loop;

 stamp:=crm_sales.visit_time(payload->>'occurred_at');

 if stamp>clock_timestamp() then
   raise exception using
     errcode='22023',
     message='Actual activity cannot be in the future.';
 end if;

 insert into crm_sales.manual_activities(
   id,lead_id,kind,summary,occurred_at,outcome,notes,created_by
 )
 values(
   activity_uuid,l.id,payload->>'kind',
   btrim(payload->>'summary'),stamp,
   nullif(btrim(payload->>'outcome'),''),
   nullif(btrim(payload->>'notes'),''),
   actor
 )
 returning * into a;

 result:=jsonb_build_object(
   'activity',to_jsonb(a),'replayed',false
 );

 insert into crm_sales.sales_requests(
   actor_id,request_id,lead_id,api_kind,input,result
 )
 values(
   actor,request_uuid,l.id,'activity',p_input,result
 );

 return result;
end;
$$;

create function crm_sales.follow_up_matches(
 p_row crm_sales.follow_ups,
 p_lead uuid,
 p_view text,
 p_mine boolean,
 p_now timestamptz
)
returns boolean language sql stable set search_path='' as $$
 select
   (p_lead is null or p_row.lead_id=p_lead)
   and (not p_mine or p_row.assigned_user_id=auth.uid())
   and exists(
     select 1 from crm_sales.leads l
     where l.id=p_row.lead_id
       and crm_sales.allowed(
         'leads.view',l.assigned_user_id,l.created_by
       )
   )
   and case p_view
     when 'all' then true
     when 'open' then p_row.status='open'
     when 'completed' then p_row.status='completed'
     when 'cancelled' then p_row.status='cancelled'
     when 'today' then
       p_row.status='open'
       and (p_row.due_at at time zone 'Asia/Dubai')::date
         =(p_now at time zone 'Asia/Dubai')::date
     when 'overdue' then
       p_row.status='open' and p_row.due_at<p_now
     when 'upcoming' then
       p_row.status='open' and p_row.due_at>=p_now
     else false
   end;
$$;

revoke all on function crm_sales.follow_up_matches(
 crm_sales.follow_ups,uuid,text,boolean,timestamptz
)
 from public,anon,authenticated,service_role;

create function public.crm_follow_up_page(
 p_lead_id uuid default null,
 p_page integer default 0,
 p_view text default 'open',
 p_mine boolean default true
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 l crm_sales.leads%rowtype;
 rows jsonb;
 events jsonb:='[]';
 total bigint;
 stamp timestamptz:=statement_timestamp();
begin
 if p_page is null
   or p_page not between 0 and 100000
   or p_view is null
   or p_view not in (
     'all','open','today','overdue','upcoming','completed','cancelled'
   )
   or p_mine is null then
   raise exception using
     errcode='22023',message='Invalid follow-up page.';
 end if;

 if auth.role() is distinct from 'authenticated'
   or public.crm_has_permission('leads.view') is not true then
   raise exception using
     errcode='42501',message='Follow-up access denied.';
 end if;

 if p_lead_id is not null then
   select * into l from crm_sales.leads where id=p_lead_id;

   if not found
     or crm_sales.allowed(
       'leads.view',l.assigned_user_id,l.created_by
     ) is not true then
     raise exception using
       errcode='42501',message='Lead unavailable.';
   end if;

 elsif not p_mine
   and public.crm_has_permission(
     'leads.view','company'
   ) is not true then
   raise exception using
     errcode='42501',
     message='Company-wide team visibility required.';
 end if;

 select count(*) into total
 from crm_sales.follow_ups f
 where crm_sales.follow_up_matches(
   f,p_lead_id,p_view,p_mine,stamp
 );

 select coalesce(
   jsonb_agg(to_jsonb(q) order by q.due_at,q.id),'[]'
 )
 into rows
 from (
   select
     f.*,
     root.reference as lead_reference,
     root.customer_name,
     case
       when crm_sales.eligible_owner(
         root.assigned_user_id
       ) is true then root.assigned_user_id
       else null
     end as current_owner_id,
     (
       f.status<>'open'
       or root.archived_at is not null
       or root.stage='lost'
       or crm_sales.allowed(
         'leads.update',root.assigned_user_id,root.created_by
       ) is not true
     ) as read_only,
     (
       f.status='open'
       and (
         f.assigned_user_id is distinct from root.assigned_user_id
         or crm_sales.eligible_owner(
           f.assigned_user_id
         ) is not true
       )
     ) as needs_assignment_review
   from crm_sales.follow_ups f
   join crm_sales.leads root on root.id=f.lead_id
   where crm_sales.follow_up_matches(
     f,p_lead_id,p_view,p_mine,stamp
   )
   order by f.due_at,f.id
   limit 20 offset p_page*20
 ) q;

 if p_lead_id is not null then
   select coalesce(
     jsonb_agg(to_jsonb(q) order by q.id desc),'[]'
   )
   into events
   from (
     select e.*
     from crm_sales.follow_up_events e
     join crm_sales.follow_ups f
       on f.id=e.follow_up_id and f.lead_id=e.lead_id
     where e.lead_id=p_lead_id
       and (not p_mine or f.assigned_user_id=auth.uid())
     order by e.id desc
     limit 50
   ) q;
 end if;

 return jsonb_build_object(
   'rows',rows,
   'events',events,
   'total',total,
   'page',p_page,
   'pageSize',20,
   'asOf',stamp
 );
end;
$$;

create function public.crm_manual_activity_page(
 p_lead_id uuid,
 p_page integer default 0
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 l crm_sales.leads%rowtype;
 rows jsonb;
 total bigint;
begin
 if p_page is null or p_page not between 0 and 100000 then
   raise exception using
     errcode='22023',message='Invalid activity page.';
 end if;

 select * into l from crm_sales.leads where id=p_lead_id;

 if auth.role() is distinct from 'authenticated'
   or not found
   or crm_sales.allowed(
     'leads.view',l.assigned_user_id,l.created_by
   ) is not true then
   raise exception using
     errcode='42501',message='Activity access denied.';
 end if;

 select count(*) into total
 from crm_sales.manual_activities
 where lead_id=l.id;

 select coalesce(
   jsonb_agg(
     to_jsonb(q)
     order by q.occurred_at desc,q.created_at desc,q.id
   ),'[]'
 )
 into rows
 from (
   select *
   from crm_sales.manual_activities
   where lead_id=l.id
   order by occurred_at desc,created_at desc,id
   limit 20 offset p_page*20
 ) q;

 return jsonb_build_object(
   'rows',rows,
   'total',total,
   'page',p_page,
   'pageSize',20,
   'readOnly',
     l.archived_at is not null
     or l.stage='lost'
     or crm_sales.allowed(
       'leads.update',l.assigned_user_id,l.created_by
     ) is not true
 );
end;
$$;

revoke all on function
 public.crm_save_follow_up(jsonb),
 public.crm_log_manual_activity(jsonb),
 public.crm_follow_up_page(uuid,integer,text,boolean),
 public.crm_manual_activity_page(uuid,integer)
 from public,anon,authenticated,service_role;

grant execute on function
 public.crm_save_follow_up(jsonb),
 public.crm_log_manual_activity(jsonb),
 public.crm_follow_up_page(uuid,integer,text,boolean),
 public.crm_manual_activity_page(uuid,integer)
 to authenticated;

notify pgrst,'reload schema';
commit;