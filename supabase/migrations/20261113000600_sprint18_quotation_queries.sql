-- Additive authorized read models only. No role grants or business writes.
begin;
create function public.crm_quotation_page(p_query jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  page_no integer; search_text text; sort_key text; direction text;
  owner_filter text; status_filter text; lead_filter uuid; result jsonb;
begin
  if auth.role() is distinct from 'authenticated' or crm_access.is_eligible_user(auth.uid()) is not true
    or public.crm_has_permission('quotations.view') is not true then
    raise exception using errcode='42501',message='Quotation visibility required.';
  end if;
  perform crm_quotes.exact_keys(p_query,array['page','search','sort','direction','owner','status','leadId']);
  if jsonb_typeof(p_query->'page') is distinct from 'number' or p_query->>'page' !~ '^[0-9]{1,5}$'
    or (p_query->>'page')::integer>10000 then
    raise exception using errcode='22023',message='Invalid quotation page.';
  end if;
  page_no:=(p_query->>'page')::integer;
  search_text:=coalesce(crm_quotes.text_value(p_query->'search',100),'');
  sort_key:=crm_quotes.text_value(p_query->'sort',20,1);
  direction:=crm_quotes.text_value(p_query->'direction',4,1);
  owner_filter:=crm_quotes.text_value(p_query->'owner',12,1);
  status_filter:=crm_quotes.text_value(p_query->'status',12,1);
  lead_filter:=crm_quotes.uuid_value(p_query->'leadId',true);
  if sort_key not in ('number','customer','amount','created','updated','owner')
    or direction not in ('asc','desc') or owner_filter not in ('all','mine','unassigned')
    or status_filter not in ('all','draft') then
    raise exception using errcode='22023',message='Invalid quotation filters or sort.';
  end if;
  with visible as (
    select q.id,q.number,q.lead_id,q.customer_snapshot,d.document,d.status,d.calculation,
      q.created_at,d.updated_at,l.assigned_user_id,
      coalesce(e.display_name,u.email) as owner_name,
      crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) as can_read_lead
    from crm_quotes.quotations q join crm_quotes.drafts d on d.quotation_id=q.id
      join crm_sales.leads l on l.id=q.lead_id
      left join auth.users u on u.id=l.assigned_user_id
      left join crm_employees.employees e on e.auth_user_id=u.id
    where crm_quotes.allowed('quotations.view',q.lead_id,q.created_by)
      and (lead_filter is null or q.lead_id=lead_filter)
      and (status_filter='all' or d.status=status_filter)
      and (owner_filter='all' or (owner_filter='mine' and l.assigned_user_id=auth.uid())
        or (owner_filter='unassigned' and l.assigned_user_id is null))
      and (search_text='' or strpos(lower(concat_ws(' ',q.number,q.customer_snapshot->>'customerName',
        q.customer_snapshot->>'leadReference',d.document->>'title')),lower(search_text))>0)
  ), selected as (
    select * from visible order by
      case when sort_key='number' and direction='asc' then number end asc,
      case when sort_key='number' and direction='desc' then number end desc,
      case when sort_key='customer' and direction='asc' then lower(customer_snapshot->>'customerName') end asc,
      case when sort_key='customer' and direction='desc' then lower(customer_snapshot->>'customerName') end desc,
      case when sort_key='amount' and direction='asc' then (calculation->'totals'->>'grandTotal')::numeric end asc,
      case when sort_key='amount' and direction='desc' then (calculation->'totals'->>'grandTotal')::numeric end desc,
      case when sort_key='created' and direction='asc' then created_at end asc,
      case when sort_key='created' and direction='desc' then created_at end desc,
      case when sort_key='updated' and direction='asc' then updated_at end asc,
      case when sort_key='updated' and direction='desc' then updated_at end desc,
      case when sort_key='owner' and direction='asc' then lower(coalesce(owner_name,'')) end asc,
      case when sort_key='owner' and direction='desc' then lower(coalesce(owner_name,'')) end desc,
      id asc limit 20 offset page_no*20
  )
  select jsonb_build_object('page',page_no,'total',(select count(*) from visible),
    'rows',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'number',number,'leadId',lead_id,'leadReference',customer_snapshot->>'leadReference',
      'customerName',customer_snapshot->>'customerName','title',document->>'title','status',status,
      'amount',calculation->'totals'->>'grandTotal','ownerId',assigned_user_id,'ownerName',owner_name,
      'createdAt',created_at,'updatedAt',updated_at,'canReadLead',can_read_lead)) from selected),'[]'::jsonb))
    into result;
  return result;
end;
$$;

create function public.crm_quotation_context(p_lead_id uuid,p_quotation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  l crm_sales.leads%rowtype; q crm_quotes.quotations%rowtype;
  creator uuid:=auth.uid(); can_read boolean; active boolean; rooms jsonb; summary text; customer jsonb;
begin
  if auth.role() is distinct from 'authenticated' or crm_access.is_eligible_user(auth.uid()) is not true
    or (p_lead_id is null and p_quotation_id is null) then
    raise exception using errcode='42501',message='Quotation context is unavailable.';
  end if;
  if p_quotation_id is not null then
    select * into q from crm_quotes.quotations where id=p_quotation_id;
    if not found or public.crm_can_view_quotation(p_quotation_id) is not true
      or (p_lead_id is not null and p_lead_id<>q.lead_id) then
      raise exception using errcode='42501',message='Quotation context is unavailable.';
    end if;
    creator:=q.created_by;
  end if;
  select * into l from crm_sales.leads where id=coalesce(q.lead_id,p_lead_id);
  if not found or crm_quotes.allowed('quotations.view',l.id,creator) is not true then
    raise exception using errcode='42501',message='Quotation context is unavailable.';
  end if;
  can_read:=crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is true;
  if p_quotation_id is null and not can_read then
    raise exception using errcode='42501',message='Lead access is required.';
  end if;
  active:=l.archived_at is null and l.stage in ('new','assigned','contacted','requirements','site-visit')
    and (l.assigned_user_id is null or crm_sales.eligible_owner(l.assigned_user_id));
  if can_read then
    select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.data->>'name') order by r.id),'[]'::jsonb)
      into rooms from (select id,data from crm_sales.detail_records where lead_id=l.id
        and kind='room' and archived_at is null order by id limit 200) r;
    select concat_ws(E'\n',
      case when data->>'project_type' is not null then 'Project: '||(data->>'project_type') end,
      case when data->>'style_preferences' is not null then 'Style: '||(data->>'style_preferences') end,
      case when data->>'special_instructions' is not null then 'Instructions: '||(data->>'special_instructions') end)
      into summary from crm_sales.detail_records where lead_id=l.id and kind='requirements' and archived_at is null;
  end if;
  customer:=coalesce(q.customer_snapshot,jsonb_build_object('leadReference',l.reference::text,
    'customerName',l.customer_name,'email',l.email,'phone',l.phone,'propertyType',l.property_type,'location',l.location));
  return jsonb_build_object('leadId',l.id,'customer',customer,'canReadLead',can_read,
    'canCreate',can_read and active and crm_quotes.allowed('quotations.create',l.id,auth.uid()),
    'canEdit',p_quotation_id is not null and can_read and active and crm_quotes.allowed('quotations.update',l.id,creator),
    'ownerName',(select coalesce(e.display_name,u.email) from auth.users u
      left join crm_employees.employees e on e.auth_user_id=u.id where u.id=l.assigned_user_id),
    'rooms',coalesce(rooms,'[]'::jsonb),'requirements',nullif(summary,''),
    'roomsTruncated',can_read and (select count(*)>200 from crm_sales.detail_records where lead_id=l.id and kind='room' and archived_at is null));
end;
$$;
revoke all on function public.crm_quotation_page(jsonb),public.crm_quotation_context(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.crm_quotation_page(jsonb),public.crm_quotation_context(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;