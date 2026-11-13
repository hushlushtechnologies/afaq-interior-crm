-- Approved additive export grant. No role memberships, existing grants or lead data change.
begin;
insert into crm_access.permissions(permission_key,label)
values('leads.export','Export permitted lead records');
insert into crm_access.role_permissions(role_key,permission_key,scope_key) values
 ('super_admin','leads.export','company'),
 ('management_director','leads.export','company'),
 ('sales_executive','leads.export','assigned');

create table crm_sales.export_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null,
 occurred_at timestamptz not null default statement_timestamp(),
 filters jsonb not null check(jsonb_typeof(filters)='object'),
 row_count integer not null check(row_count between 0 and 1000)
);
create index export_events_actor_time on crm_sales.export_events(actor_id,occurred_at desc);
alter table crm_sales.export_events enable row level security;
revoke all on crm_sales.export_events from public,anon,authenticated,service_role;
comment on table crm_sales.export_events is
 'Private snapshot-access evidence. No CSV payload retained; issuance does not prove a browser save.';

create function public.crm_lead_export(p_query jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 sort_expression text;
 direction text;
 rows jsonb;
 total integer;
 event_id uuid;
 stamp timestamptz;
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 if auth.role() is distinct from 'authenticated'
   or public.crm_has_permission('leads.export') is not true
   or public.crm_has_permission('leads.view') is not true then
   raise exception using errcode='42501',message='Lead export access denied.';
 end if;
 -- Reuse the existing authoritative validator; its page result never leaves this function.
 perform public.crm_query_leads(p_query);
 stamp:=clock_timestamp();
 if (select count(*) from crm_sales.export_events e
     where e.actor_id=auth.uid() and e.occurred_at>stamp-interval '1 minute')>=5 then
   raise exception using errcode='P0001',message='Export rate limit reached.';
 end if;
 direction:=coalesce(p_query->>'direction','desc');
 sort_expression:=case coalesce(p_query->>'sort','created_at')
   when 'created_at' then 'f.created_at'
   when 'customer_name' then 'lower(f.customer_name)'
   when 'reference' then 'f.reference'
   when 'budget' then 'f.budget'
   when 'inquiry_on' then 'f.inquiry_on'
   when 'follow_up_on' then 'f.follow_up_on'
   when 'source_code' then 'f.source_code'
   when 'owner' then 'lower(f.sort_owner)'
   when 'stage' then
     'array_position(array[''new'',''assigned'',''contacted'',''requirements'',''site-visit'',''quotation-shared'',''negotiation'',''won'',''lost''],f.stage)'
   when 'priority' then
     'case f.priority when ''urgent'' then 4 when ''high'' then 3 when ''normal'' then 2 else 1 end'
   else null end;
 if sort_expression is null or direction not in ('asc','desc') then
   raise exception using errcode='22023',message='Invalid export sorting.';
 end if;
 execute format($query$
   with filtered as materialized (
     select l.*,s.name source_name,
       case when l.assigned_user_id is null then 'Unassigned'
         else coalesce(e.display_name,'Assigned employee') end owner_name,
       coalesce(e.display_name,u.email) sort_owner
     from crm_sales.leads l
     join crm_sales.sources s on s.code=l.source_code
     left join crm_employees.employees e on e.auth_user_id=l.assigned_user_id
     left join auth.users u on u.id=l.assigned_user_id
     where crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by)
       and crm_sales.allowed('leads.export',l.assigned_user_id,l.created_by)
       and (l.archived_at is not null)=$1
       and ($2='' or position(lower($2) in lower(l.customer_name))>0
         or position(lower($2) in lower(coalesce(l.email,'')))>0
         or position($2 in coalesce(l.phone,''))>0
         or position($2 in coalesce(l.alternate_phone,''))>0
         or position(lower($2) in lower(coalesce(l.location,'')))>0
         or l.reference::text=$2)
       and ($3 is null or l.stage=$3)
       and ($4 is null or l.source_code=$4)
       and ($5 is null or ($5='unassigned' and l.assigned_user_id is null)
         or l.assigned_user_id::text=$5)
       and ($6 is null or l.priority=$6)
       and ($7 is null or l.inquiry_on>=$7)
       and ($8 is null or l.inquiry_on<=$8)
   ), selected as (
     select f.*,row_number() over(order by %s %s nulls last,f.id asc) n
     from filtered f order by %s %s nulls last,f.id asc limit 1001
   )
   select coalesce(jsonb_agg(jsonb_build_array(
     reference::text,customer_name,email,phone,alternate_phone,
     source_code,source_name,stage,priority,owner_name,property_type,location,
     budget::text,currency,inquiry_on::text,expected_start_on::text,follow_up_on::text,
     to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
     case when archived_at is null then null else
       to_char(archived_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end
   ) order by n),'[]'::jsonb),count(*)::integer from selected
 $query$,sort_expression,direction,sort_expression,direction)
 into rows,total using coalesce((p_query->>'archived')::boolean,false),
   btrim(coalesce(p_query->>'search','')),nullif(p_query->>'stage',''),
   nullif(p_query->>'source',''),lower(nullif(p_query->>'owner','')),
   nullif(p_query->>'priority',''),nullif(p_query->>'from','')::date,
   nullif(p_query->>'to','')::date;
 if total>1000 then
   raise exception using errcode='54000',message='Narrow the export filters.';
 end if;
 insert into crm_sales.export_events(actor_id,occurred_at,filters,row_count)
 values(auth.uid(),stamp,p_query-'page'-'pageSize',total) returning id into event_id;
 return jsonb_build_object('id',event_id,'asOf',stamp,'rows',rows);
end;
$$;
revoke all on function public.crm_lead_export(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_lead_export(jsonb) to authenticated;
commit;