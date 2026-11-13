-- Sprint 14 Part 1: read-only queries. No stage/outcome or role changes.
begin;

create index leads_stage_page on crm_sales.leads(stage,created_at desc,id);
create index leads_inquiry_page on crm_sales.leads(inquiry_on desc,id);
create index leads_source_page on crm_sales.leads(source_code,created_at desc,id);

create function public.crm_query_leads(p_query jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 page_number integer; page_size integer; archived boolean;
 search_text text; stage_filter text; source_filter text; owner_filter text; priority_filter text;
 from_date date; to_date date; sort_key text; sort_direction text; sort_expression text; result jsonb;
 key text;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null
    or crm_access.is_eligible_user(auth.uid()) is not true
    or public.crm_has_permission('leads.view') is not true then
   raise exception using errcode='42501',message='Active lead visibility required.';
 end if;
 if p_query is null or jsonb_typeof(p_query)<>'object' then
   raise exception using errcode='22023',message='Invalid lead query.';
 end if;
 if exists(select 1 from jsonb_object_keys(p_query) k where k not in
   ('page','pageSize','archived','search','stage','source','owner','priority','from','to','sort','direction')) then
   raise exception using errcode='22023',message='Unexpected query field.';
 end if;
 foreach key in array array['search','stage','source','owner','priority','from','to','sort','direction'] loop
   if p_query ? key and jsonb_typeof(p_query->key) not in ('string','null') then
     raise exception using errcode='22023',message='Query filters must be text or null.';
   end if;
 end loop;
 if (p_query ? 'page' and jsonb_typeof(p_query->'page')<>'number')
    or (p_query ? 'pageSize' and jsonb_typeof(p_query->'pageSize')<>'number')
    or (p_query ? 'archived' and jsonb_typeof(p_query->'archived')<>'boolean') then
   raise exception using errcode='22023',message='Invalid pagination.';
 end if;
 begin
   page_number:=coalesce((p_query->>'page')::integer,0);
   page_size:=coalesce((p_query->>'pageSize')::integer,20);
   archived:=coalesce((p_query->>'archived')::boolean,false);
   from_date:=nullif(p_query->>'from','')::date;
   to_date:=nullif(p_query->>'to','')::date;
 exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
   raise exception using errcode='22023',message='Invalid pagination or calendar date.';
 end;
 if page_number not between 0 and 10000 or page_size not in (10,20,50)
    or (from_date is not null and to_date is not null and from_date>to_date)
    or (from_date is not null and to_char(from_date,'YYYY-MM-DD')<>p_query->>'from')
    or (to_date is not null and to_char(to_date,'YYYY-MM-DD')<>p_query->>'to') then
   raise exception using errcode='22023',message='Invalid page or date range.';
 end if;
 search_text:=btrim(coalesce(p_query->>'search',''));
 stage_filter:=nullif(p_query->>'stage','');
 source_filter:=nullif(p_query->>'source','');
 owner_filter:=nullif(p_query->>'owner','');
 priority_filter:=nullif(p_query->>'priority','');
 sort_key:=coalesce(p_query->>'sort','created_at');
 sort_direction:=coalesce(p_query->>'direction','desc');
 if length(search_text)>100
    or (stage_filter is not null and stage_filter not in ('new','assigned','contacted','requirements','site-visit','quotation-shared','negotiation','won','lost'))
    or (source_filter is not null and source_filter !~ '^[a-z][a-z0-9_]{0,39}$')
    or (owner_filter is not null and owner_filter<>'unassigned' and owner_filter !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    or (priority_filter is not null and priority_filter not in ('low','normal','high','urgent'))
    or sort_direction not in ('asc','desc') then
   raise exception using errcode='22023',message='Invalid filter or sort.';
 end if;
 sort_expression:=case sort_key
   when 'created_at' then 'f.created_at'
   when 'customer_name' then 'lower(f.customer_name)'
   when 'reference' then 'f.reference'
   when 'budget' then 'f.budget'
   when 'inquiry_on' then 'f.inquiry_on'
   when 'follow_up_on' then 'f.follow_up_on'
   when 'priority' then 'case f.priority when ''urgent'' then 4 when ''high'' then 3 when ''normal'' then 2 else 1 end'
   else null end;
 if sort_expression is null then raise exception using errcode='22023',message='Invalid sort column.'; end if;
 -- Only fixed expressions/direction are interpolated. All user values are bound.
 execute format($query$
   with visible as materialized (
     select l.*,coalesce(e.display_name,u.email) as assigned_name
     from crm_sales.leads l
     left join auth.users u on u.id=l.assigned_user_id
     left join crm_employees.employees e on e.auth_user_id=u.id
     where crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by)
       and (l.archived_at is not null)=$1
   ), filtered as materialized (
     select * from visible l where
       ($2='' or position(lower($2) in lower(l.customer_name))>0
         or position(lower($2) in lower(coalesce(l.email,'')))>0
         or position($2 in coalesce(l.phone,''))>0
         or position($2 in coalesce(l.alternate_phone,''))>0
         or position(lower($2) in lower(coalesce(l.location,'')))>0
         or l.reference::text=$2)
       and ($3 is null or l.stage=$3)
       and ($4 is null or l.source_code=$4)
       and ($5 is null or ($5='unassigned' and l.assigned_user_id is null) or l.assigned_user_id::text=$5)
       and ($6 is null or l.priority=$6)
       and ($7 is null or l.inquiry_on>=$7)
       and ($8 is null or l.inquiry_on<=$8)
   ), ranked as (
     select f.*,row_number() over(order by %s %s nulls last,f.id asc) as query_order
     from filtered f
   ), selected as (
     select * from ranked order by query_order limit $9 offset $10
   )
   select jsonb_build_object(
     'rows',coalesce((select jsonb_agg(to_jsonb(s)-'query_order' order by s.query_order) from selected s),'[]'::jsonb),
     'total',(select count(*) from filtered),'page',$11,'pageSize',$9,
     'stageCounts',coalesce((select jsonb_object_agg(stage,total) from (select stage,count(*) as total from filtered group by stage) c),'{}'::jsonb),
     'owners',coalesce((select jsonb_agg(jsonb_build_object('id',o.assigned_user_id,'name',o.assigned_name) order by o.assigned_name,o.assigned_user_id)
       from (select distinct assigned_user_id,assigned_name from visible where assigned_user_id is not null) o),'[]'::jsonb)
   )
 $query$,sort_expression,sort_direction)
 into result using archived,search_text,stage_filter,source_filter,lower(owner_filter),priority_filter,
   from_date,to_date,page_size,page_number*page_size,page_number;
 return result;
end;
$$;

revoke all on function public.crm_query_leads(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_query_leads(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;