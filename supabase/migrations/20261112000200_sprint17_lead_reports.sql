-- Read-only aggregation. Existing tables, identities, RLS and permissions stay intact.
begin;
create function public.crm_lead_report(p_from date,p_to date,p_mode text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 permission_key text;
 result jsonb;
 stamp timestamptz:=statement_timestamp();
begin
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to)
   or p_from<date '0001-01-01' or p_to>date '9999-12-31'
   or p_to<p_from or p_to-p_from>365
   or p_mode is null or p_mode not in ('dashboard','report') then
   raise exception using errcode='22023',message='Invalid report range or mode.';
 end if;
 permission_key:=case p_mode when 'dashboard' then 'dashboard.view' else 'reports.view' end;
 if auth.role() is distinct from 'authenticated'
   or public.crm_has_permission(permission_key) is not true
   or public.crm_has_permission('leads.view') is not true then
   raise exception using errcode='42501',message='Lead reporting access denied.';
 end if;
 with visible as materialized (
   select l.* from crm_sales.leads l
   where crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by)
     and crm_sales.allowed(permission_key,l.assigned_user_id,l.created_by)
 ), cohort as materialized (
   select * from visible
   where created_at >= (p_from::timestamp at time zone 'Asia/Dubai')
     and created_at < ((p_to+1)::timestamp at time zone 'Asia/Dubai')
 ), tasks as materialized (
   select f.*,
     l.archived_at is null and l.stage not in ('lost','won') as active_lead,
     coalesce(f.assigned_user_id=l.assigned_user_id
       and crm_sales.eligible_owner(f.assigned_user_id),false) as eligible_assignment
   from crm_sales.follow_ups f join visible l on l.id=f.lead_id
   where f.due_at >= (p_from::timestamp at time zone 'Asia/Dubai')
     and f.due_at < ((p_to+1)::timestamp at time zone 'Asia/Dubai')
     and (public.crm_has_permission('leads.view','company')
       or f.assigned_user_id=auth.uid())
 ), months as (
   select to_char(d,'YYYY-MM') as label
   from generate_series(date_trunc('month',p_from::timestamp),
     date_trunc('month',p_to::timestamp),interval '1 month') d
 )
 select jsonb_build_object(
   'from',p_from,'to',p_to,'asOf',stamp,
   'leads',jsonb_build_object('total',(select count(*) from cohort),
     'new',(select count(*) from cohort where stage='new'),
     'archived',(select count(*) from cohort where archived_at is not null)),
   'stages',coalesce((select jsonb_agg(jsonb_build_object('key',q.stage,'label',q.stage,'value',q.n) order by q.stage)
     from (select stage,count(*) n from cohort group by stage) q),'[]'::jsonb),
   'sources',coalesce((select jsonb_agg(jsonb_build_object('key',q.code,'label',q.name,'value',q.n) order by q.code)
     from (select s.code,s.name,count(*) n from cohort l join crm_sales.sources s on s.code=l.source_code group by s.code,s.name) q),'[]'::jsonb),
   'owners',coalesce((select jsonb_agg(jsonb_build_object('key',q.owner,'label',q.name,'value',q.n) order by q.owner)
     from (select coalesce(l.assigned_user_id::text,'unassigned') owner,
       case when l.assigned_user_id is null then 'Unassigned' else coalesce(e.display_name,'Assigned employee') end name,
       count(*) n from cohort l left join crm_employees.employees e on e.auth_user_id=l.assigned_user_id
       group by l.assigned_user_id,e.display_name) q),'[]'::jsonb),
   'trend',(select jsonb_agg(jsonb_build_object('key',m.label,'label',m.label,'value',
     (select count(*) from cohort c where to_char(c.created_at at time zone 'Asia/Dubai','YYYY-MM')=m.label)) order by m.label) from months m),
   'lossReasons',coalesce((select jsonb_agg(jsonb_build_object('key',q.code,'label',q.name,'value',q.n) order by q.code)
     from (select r.code,r.name,count(*) n from cohort l
       join crm_sales.losses x on x.id=l.current_loss_id
       join crm_sales.lost_reasons r on r.code=x.reason_code
       where l.stage='lost' group by r.code,r.name) q),'[]'::jsonb),
   'followUps',jsonb_build_object(
     'total',(select count(*) from tasks),
     'completed',(select count(*) from tasks where status='completed'),
     'cancelled',(select count(*) from tasks where status='cancelled'),
     'open',(select count(*) from tasks where status='open'),
     'overdue',(select count(*) from tasks where status='open' and active_lead and eligible_assignment and due_at<stamp),
     'upcoming',(select count(*) from tasks where status='open' and active_lead and eligible_assignment and due_at>=stamp),
     'needsReview',(select count(*) from tasks where status='open' and active_lead and not eligible_assignment))
 ) into result;
 return result;
end;
$$;
revoke all on function public.crm_lead_report(date,date,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_lead_report(date,date,text) to authenticated;
comment on function public.crm_lead_report(date,date,text) is
 'Employee-scoped read metrics. Dubai creation cohort and independent due-date cohort. No conversion or revenue claims.';
commit;