-- Read-only projection of existing history. No stored data or role changes.
begin;

create function public.crm_lead_timeline(
 p_lead_id uuid,
 p_page integer default 0
)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_page is null or p_page not between 0 and 100000 then
   raise exception using
     errcode='22023',message='Invalid timeline page.';
 end if;

 if auth.role() is distinct from 'authenticated'
   or not exists(
     select 1 from crm_sales.leads l
     where l.id=p_lead_id
       and crm_sales.allowed(
         'leads.view',l.assigned_user_id,l.created_by
       ) is true
   ) then
   raise exception using
     errcode='42501',message='Lead visibility required.';
 end if;

 with history as (
   select
     'lead:'||e.id as id,
     'lead'::text as source,
     e.actor_id,
     e.occurred_at as recorded_at,
     e.occurred_at as activity_at,
     'Lead '||e.action as title,
     jsonb_strip_nulls(
       jsonb_build_object(
         'previous_stage',e.before_data->>'stage',
         'stage',e.after_data->>'stage',
         'previous_owner',e.before_data->>'assigned_user_id',
         'owner',e.after_data->>'assigned_user_id',
         'reason',e.after_data->>'pipeline_reason'
       )
     ) as details
   from crm_sales.events e
   where e.lead_id=p_lead_id

   union all

   select
     'detail:'||e.id,
     'detail',
     e.actor_id,
     e.occurred_at,
     e.occurred_at,
     (e.after_data->>'kind')||' '||e.action,
     jsonb_build_object(
       'before',e.before_data->'data',
       'after',e.after_data->'data'
     )
   from crm_sales.detail_events e
   where e.lead_id=p_lead_id

   union all

   select
     'visit:'||e.id,
     'visit',
     e.actor_id,
     e.occurred_at,
     e.occurred_at,
     'Site visit '||array_to_string(e.actions,', '),
     jsonb_build_object(
       'before',e.before_data-'lead_id',
       'after',e.after_data-'lead_id'
     )
   from crm_sales.visit_events e
   where e.lead_id=p_lead_id

   union all

   select
     'follow_up:'||e.id,
     'follow_up',
     e.actor_id,
     e.occurred_at,
     coalesce(
       (e.after_data->>'actual_at')::timestamptz,
       e.occurred_at
     ),
     'Follow-up '||array_to_string(e.actions,', '),
     jsonb_build_object(
       'reason',e.reason,
       'before',e.before_data-'lead_id',
       'after',e.after_data-'lead_id'
     )
   from crm_sales.follow_up_events e
   where e.lead_id=p_lead_id

   union all

   select
     'manual:'||a.id,
     'manual',
     a.created_by,
     a.created_at,
     a.occurred_at,
     'Manual '||a.kind||': '||a.summary,
     jsonb_build_object(
       'outcome',a.outcome,
       'internal_notes',a.notes
     )
   from crm_sales.manual_activities a
   where a.lead_id=p_lead_id
     and a.follow_up_id is null
 ),
 selected as (
   select *
   from history
   order by recorded_at desc,id desc
   limit 20 offset p_page*20
 )
 select jsonb_build_object(
   'rows',coalesce(
     (
       select jsonb_agg(
         to_jsonb(s) order by s.recorded_at desc,s.id desc
       )
       from selected s
     ),
     '[]'
   ),
   'total',(select count(*) from history),
   'page',p_page,
   'pageSize',20
 )
 into result;

 return result;
end;
$$;

revoke all on function public.crm_lead_timeline(uuid,integer)
 from public,anon,authenticated,service_role;

grant execute on function public.crm_lead_timeline(uuid,integer)
 to authenticated;

notify pgrst,'reload schema';
commit;