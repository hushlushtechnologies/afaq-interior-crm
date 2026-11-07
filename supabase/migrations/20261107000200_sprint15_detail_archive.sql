-- Safe room/note archive. No deletion, role-grant or Storage changes.
begin;
alter table crm_sales.detail_records add column archived_at timestamptz;
create index detail_archive_page on crm_sales.detail_records(lead_id,kind,archived_at,created_at,id);
alter table crm_sales.detail_events drop constraint detail_events_action_check;
alter table crm_sales.detail_events add constraint detail_events_action_check check(action in ('created','updated','archived'));

-- Keep the approved save implementation private; the public guard prevents edits
-- to archived records while retaining exact committed-request replay.
alter function public.crm_save_lead_detail(jsonb) set schema crm_sales;
alter function crm_sales.crm_save_lead_detail(jsonb) rename to save_lead_detail_v1;
revoke all on function crm_sales.save_lead_detail_v1(jsonb) from public,anon,authenticated,service_role;
create function public.crm_save_lead_detail(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l crm_sales.leads%rowtype; target uuid; request_uuid uuid;
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 if auth.uid() is null or auth.role() is distinct from 'authenticated' or crm_access.is_eligible_user(auth.uid()) is not true then
   raise exception using errcode='42501',message='Active authenticated employee required.'; end if;
 select * into l from crm_sales.leads where id=(p_input->>'leadId')::uuid for update;
 if not found or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true
   or crm_sales.allowed('leads.update',l.assigned_user_id,l.created_by) is not true then
   raise exception using errcode='42501',message='Lead detail update is not permitted.'; end if;
 target:=case when p_input->>'command'='save_requirements' then l.id else (p_input->>'recordId')::uuid end;
 request_uuid:=(p_input->>'requestId')::uuid;
 if exists(select 1 from crm_sales.detail_records where lead_id=l.id and id=target and archived_at is not null)
   and not exists(select 1 from crm_sales.detail_requests where actor_id=auth.uid() and request_id=request_uuid and input=p_input) then
   raise exception using errcode='40001',message='Archived detail records are read-only.'; end if;
 return crm_sales.save_lead_detail_v1(p_input);
end;
$$;

create function crm_sales.detail_page(p_lead_id uuid,p_kind text,p_page integer,p_archived boolean)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l crm_sales.leads%rowtype; result jsonb;
begin
 if auth.uid() is null or auth.role() is distinct from 'authenticated' or crm_access.is_eligible_user(auth.uid()) is not true then
   raise exception using errcode='42501',message='Active authenticated employee required.'; end if;
 if p_lead_id is null or p_kind is null or p_kind not in ('requirements','room','note')
   or p_page is null or p_page not between 0 and 10000 or p_archived is null then
   raise exception using errcode='22023',message='Invalid detail page.'; end if;
 select * into l from crm_sales.leads where id=p_lead_id;
 if not found or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true then
   raise exception using errcode='42501',message='Lead detail visibility required.'; end if;
 with visible as (
   select * from crm_sales.detail_records where lead_id=p_lead_id and kind=p_kind and (archived_at is not null)=p_archived
 ), selected as (
   select * from visible order by case when p_kind='room' then (data->>'sort_order')::integer end,created_at,id limit 20 offset p_page*20
 ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(s) order by
   case when p_kind='room' then (s.data->>'sort_order')::integer end,s.created_at,s.id) from selected s),'[]'::jsonb),
   'total',(select count(*) from visible),'page',p_page,'pageSize',20,
   'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.id desc) from (
     select e.* from crm_sales.detail_events e join crm_sales.detail_records r on r.lead_id=e.lead_id and r.id=e.record_id
     where e.lead_id=p_lead_id and r.kind=p_kind order by e.id desc limit 50) e),'[]'::jsonb)) into result;
 return result;
end;
$$;
create or replace function public.crm_lead_details(p_lead_id uuid,p_kind text,p_page integer default 0)
returns jsonb language sql stable security definer set search_path='' as $$
 select crm_sales.detail_page(p_lead_id,p_kind,p_page,false);
$$;
create function public.crm_archived_lead_details(p_lead_id uuid,p_kind text,p_page integer default 0)
returns jsonb language sql stable security definer set search_path='' as $$
 select crm_sales.detail_page(p_lead_id,p_kind,p_page,true);
$$;

create function public.crm_archive_lead_detail(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); l crm_sales.leads%rowtype; r crm_sales.detail_records%rowtype;
 receipt crm_sales.detail_requests%rowtype; request_uuid uuid; expected bigint; previous jsonb; result jsonb;
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 if actor is null or auth.role() is distinct from 'authenticated' or crm_access.is_eligible_user(actor) is not true then
   raise exception using errcode='42501',message='Active authenticated employee required.'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object'
   or not (p_input ?& array['requestId','leadId','recordId','version'])
   or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('requestId','leadId','recordId','version'))
   or jsonb_typeof(p_input->'requestId')<>'string' or jsonb_typeof(p_input->'leadId')<>'string'
   or jsonb_typeof(p_input->'recordId')<>'string' or jsonb_typeof(p_input->'version')<>'number'
   or p_input->>'version' !~ '^[1-9][0-9]{0,15}$' or (p_input->>'version')::numeric>9007199254740991 then
   raise exception using errcode='22023',message='Invalid archive request.'; end if;
 request_uuid:=(p_input->>'requestId')::uuid; expected:=(p_input->>'version')::bigint;
 select * into l from crm_sales.leads where id=(p_input->>'leadId')::uuid for update;
 if not found or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true
   or crm_sales.allowed('leads.archive',l.assigned_user_id,l.created_by) is not true then
   raise exception using errcode='42501',message='Lead archive permission required.'; end if;
 select * into r from crm_sales.detail_records where lead_id=l.id and id=(p_input->>'recordId')::uuid for update;
 if not found then raise exception using errcode='42501',message='Detail record is unavailable.'; end if;
 if r.kind not in ('room','note') then raise exception using errcode='22023',message='Only rooms and notes may be archived.'; end if;
 select * into receipt from crm_sales.detail_requests where actor_id=actor and request_id=request_uuid;
 if found then
   if receipt.input<>p_input then raise exception using errcode='22023',message='Request ID was used for different input.'; end if;
   return receipt.result||jsonb_build_object('replayed',true);
 end if;
 if r.version<>expected or r.archived_at is not null or l.archived_at is not null or l.stage='lost' then
   raise exception using errcode='40001',message='Record changed or is read-only.'; end if;
 previous:=to_jsonb(r);
 update crm_sales.detail_records set archived_at=now(),updated_at=now(),updated_by=actor,version=version+1
   where lead_id=l.id and id=r.id returning * into r;
 insert into crm_sales.detail_events(lead_id,record_id,actor_id,action,before_data,after_data)
   values(l.id,r.id,actor,'archived',previous,to_jsonb(r));
 result:=jsonb_build_object('record',to_jsonb(r),'replayed',false);
 insert into crm_sales.detail_requests(actor_id,request_id,lead_id,record_id,input,result)
   values(actor,request_uuid,l.id,r.id,p_input,result);
 return result;
end;
$$;
revoke all on function crm_sales.detail_page(uuid,text,integer,boolean) from public,anon,authenticated,service_role;
revoke all on function public.crm_save_lead_detail(jsonb),public.crm_lead_details(uuid,text,integer),
 public.crm_archived_lead_details(uuid,text,integer),public.crm_archive_lead_detail(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_save_lead_detail(jsonb),public.crm_lead_details(uuid,text,integer),
 public.crm_archived_lead_details(uuid,text,integer),public.crm_archive_lead_detail(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;