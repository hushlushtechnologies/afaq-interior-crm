-- DEC-009 owner-approved LOCAL reminder foundation. Does not schedule a job.
begin;

create extension if not exists pg_cron;

revoke all on schema cron
 from public,anon,authenticated,service_role;

create index follow_ups_open_due
 on crm_sales.follow_ups(due_at,id)
 where status='open';

create table crm_sales.follow_up_reminders (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null,
 follow_up_id uuid not null,
 recipient_id uuid not null,
 due_at timestamptz not null check(isfinite(due_at)),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(follow_up_id,recipient_id,due_at),
 foreign key(lead_id,follow_up_id)
   references crm_sales.follow_ups(lead_id,id) on delete restrict
);

create index reminders_recipient_page
 on crm_sales.follow_up_reminders(recipient_id,created_at desc,id);

create table crm_sales.reminder_runs (
 id bigint generated always as identity primary key,
 finished_at timestamptz not null default now(),
 created_count integer not null
   check(created_count between 0 and 100)
);

alter table crm_sales.follow_up_reminders enable row level security;
alter table crm_sales.reminder_runs enable row level security;

revoke all on
 crm_sales.follow_up_reminders,
 crm_sales.reminder_runs
 from public,anon,authenticated,service_role;

revoke all on sequence crm_sales.reminder_runs_id_seq
 from public,anon,authenticated,service_role;

-- Evaluates the recipient's existing role grants without impersonating their JWT.
create function crm_sales.reminder_current(
 p_follow_up uuid,
 p_recipient uuid,
 p_due timestamptz
)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1
   from crm_sales.follow_ups f
   join crm_sales.leads l on l.id=f.lead_id
   where f.id=p_follow_up
     and f.status='open'
     and f.due_at=p_due
     and f.due_at<=statement_timestamp()
     and f.assigned_user_id=p_recipient
     and l.assigned_user_id=p_recipient
     and l.archived_at is null
     and l.stage<>'lost'
     and crm_sales.eligible_owner(p_recipient) is true
     and exists(
       select 1
       from crm_access.user_roles m
       join crm_access.role_permissions g on g.role_key=m.role_key
       where m.user_id=p_recipient
         and g.permission_key='leads.view'
         and (
           g.scope_key in ('company','assigned')
           or (
             g.scope_key='own'
             and l.created_by=p_recipient
           )
         )
     )
 );
$$;

revoke all on function
 crm_sales.reminder_current(uuid,uuid,timestamptz)
 from public,anon,authenticated,service_role;

create function crm_sales.reminder_visible(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.role()='authenticated'
   and exists(
     select 1
     from crm_sales.follow_up_reminders r
     where r.id=p_id
       and r.recipient_id=auth.uid()
       and crm_sales.reminder_current(
         r.follow_up_id,r.recipient_id,r.due_at
       )
   );
$$;

revoke all on function crm_sales.reminder_visible(uuid)
 from public,anon,authenticated,service_role;

grant execute on function crm_sales.reminder_visible(uuid)
 to authenticated;

create policy reminder_read
 on crm_sales.follow_up_reminders
 for select to authenticated
 using(crm_sales.reminder_visible(id));

grant select on crm_sales.follow_up_reminders to authenticated;

create function crm_sales.generate_follow_up_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 -- Same lock used by lead/employee status workflows.
 -- Busy runs wait for the next tick.
 if not pg_try_advisory_xact_lock(90310001::bigint) then
   return 0;
 end if;

 insert into crm_sales.follow_up_reminders(
   lead_id,follow_up_id,recipient_id,due_at
 )
 select
   f.lead_id,f.id,f.assigned_user_id,f.due_at
 from crm_sales.follow_ups f
 where f.status='open'
   and f.due_at<=statement_timestamp()
   and crm_sales.reminder_current(
     f.id,f.assigned_user_id,f.due_at
   )
   and not exists(
     select 1
     from crm_sales.follow_up_reminders r
     where r.follow_up_id=f.id
       and r.recipient_id=f.assigned_user_id
       and r.due_at=f.due_at
   )
 order by f.due_at,f.id
 limit 100
 on conflict(follow_up_id,recipient_id,due_at) do nothing;

 get diagnostics inserted=row_count;

 insert into crm_sales.reminder_runs(created_count)
 values(inserted);

 return inserted;
end;
$$;

revoke all on function crm_sales.generate_follow_up_reminders()
 from public,anon,authenticated,service_role;

create function public.crm_my_reminders(p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 rows jsonb;
 total bigint;
 unread bigint;
begin
 if p_page is null or p_page not between 0 and 100000 then
   raise exception using
     errcode='22023',message='Invalid reminder page.';
 end if;

 if auth.role() is distinct from 'authenticated'
   or crm_access.is_eligible_user(auth.uid()) is not true
   or public.crm_has_permission('leads.view') is not true then
   raise exception using
     errcode='42501',
     message='Active lead-view permission required.';
 end if;

 select
   count(*),
   count(*) filter(where read_at is null)
 into total,unread
 from crm_sales.follow_up_reminders
 where crm_sales.reminder_visible(id);

 select coalesce(
   jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id),
   '[]'
 )
 into rows
 from (
   select
     r.id,
     r.lead_id,
     r.follow_up_id,
     r.due_at,
     r.created_at,
     r.read_at,
     'Follow-up due'::text as title
   from crm_sales.follow_up_reminders r
   where crm_sales.reminder_visible(r.id)
   order by r.created_at desc,r.id
   limit 20 offset p_page*20
 ) q;

 return jsonb_build_object(
   'rows',rows,
   'total',total,
   'unread',unread,
   'page',p_page,
   'pageSize',20
 );
end;
$$;

create function public.crm_read_reminder(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare stamp timestamptz;
begin
 perform pg_advisory_xact_lock(90310001::bigint);

 if public.crm_has_permission('leads.view') is not true
   or crm_sales.reminder_visible(p_id) is not true then
   raise exception using
     errcode='42501',message='Reminder unavailable.';
 end if;

 update crm_sales.follow_up_reminders
 set read_at=coalesce(read_at,now())
 where id=p_id and recipient_id=auth.uid()
 returning read_at into stamp;

 return jsonb_build_object(
   'id',p_id,
   'readAt',stamp
 );
end;
$$;

revoke all on function
 public.crm_my_reminders(integer),
 public.crm_read_reminder(uuid)
 from public,anon,authenticated,service_role;

grant execute on function
 public.crm_my_reminders(integer),
 public.crm_read_reminder(uuid)
 to authenticated;

notify pgrst,'reload schema';
commit;