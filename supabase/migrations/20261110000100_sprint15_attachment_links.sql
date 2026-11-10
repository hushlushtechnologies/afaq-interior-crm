-- Sprint 15 room/site-visit references. Additive; no Storage or role changes.
begin;
alter table crm_sales.attachments add constraint attachment_lead_identity unique(lead_id,id);
create table crm_sales.attachment_links (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null,
 attachment_id uuid not null,
 room_id uuid,
 visit_id uuid,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 archived_by uuid,
 archived_at timestamptz,
 version integer not null default 1 check(version>0),
 check(num_nonnulls(room_id,visit_id)=1),
 check((archived_by is null)=(archived_at is null)),
 foreign key(lead_id,attachment_id) references crm_sales.attachments(lead_id,id) on delete restrict,
 foreign key(lead_id,room_id) references crm_sales.detail_records(lead_id,id) on delete restrict,
 foreign key(lead_id,visit_id) references crm_sales.site_visits(lead_id,id) on delete restrict
);
create unique index active_room_attachment on crm_sales.attachment_links(attachment_id,room_id) where archived_at is null;
create unique index active_visit_attachment on crm_sales.attachment_links(attachment_id,visit_id) where archived_at is null;
create index attachment_links_page on crm_sales.attachment_links(lead_id,attachment_id,created_at desc,id);
create table crm_sales.attachment_link_events (
 id bigint generated always as identity primary key,
 link_id uuid not null references crm_sales.attachment_links(id) on delete restrict,
 actor_id uuid not null,
 action text not null check(action in ('linked','unlinked')),
 occurred_at timestamptz not null default now(),
 after_data jsonb not null
);
create table crm_sales.attachment_link_requests (
 actor_id uuid not null,
 request_id uuid not null,
 lead_id uuid not null references crm_sales.leads(id) on delete restrict,
 input jsonb not null,
 result jsonb not null,
 primary key(actor_id,request_id)
);
alter table crm_sales.attachment_links enable row level security;
alter table crm_sales.attachment_link_events enable row level security;
alter table crm_sales.attachment_link_requests enable row level security;
create policy attachment_link_read on crm_sales.attachment_links for select to authenticated using(
 exists(select 1 from crm_sales.attachments a where a.lead_id=attachment_links.lead_id and a.id=attachment_id)
);
create policy attachment_link_event_read on crm_sales.attachment_link_events for select to authenticated using(
 exists(select 1 from crm_sales.attachment_links l where l.id=link_id)
);
revoke all on crm_sales.attachment_links,crm_sales.attachment_link_events,crm_sales.attachment_link_requests from public,anon,authenticated,service_role;
revoke all on sequence crm_sales.attachment_link_events_id_seq from public,anon,authenticated,service_role;
grant select on crm_sales.attachment_links,crm_sales.attachment_link_events to authenticated;

create function public.crm_save_attachment_link(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); l crm_sales.leads%rowtype; a crm_sales.attachments%rowtype;
 r crm_sales.attachment_links%rowtype; receipt crm_sales.attachment_link_requests%rowtype;
 room crm_sales.detail_records%rowtype; visit crm_sales.site_visits%rowtype;
 command text; payload jsonb; expected integer; request_uuid uuid; result jsonb; changed boolean:=false;
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 if auth.role() is distinct from 'authenticated' or actor is null or crm_access.is_eligible_user(actor) is not true then
   raise exception using errcode='42501',message='Active employee required.'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object'
   or not(p_input ?& array['requestId','leadId','attachmentId','command','data'])
   or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('requestId','leadId','attachmentId','command','data')) then
   raise exception using errcode='22023',message='Invalid link request.'; end if;
 request_uuid:=(p_input->>'requestId')::uuid; command:=p_input->>'command'; payload:=p_input->'data';
 if request_uuid is null or command is null or command not in ('link','unlink') or jsonb_typeof(payload)<>'object' then
   raise exception using errcode='22023',message='Invalid link operation.'; end if;
 select * into l from crm_sales.leads where id=(p_input->>'leadId')::uuid for update;
 if not found or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true
   or crm_sales.allowed(case when command='link' then 'leads.update' else 'leads.archive' end,l.assigned_user_id,l.created_by) is not true then
   raise exception using errcode='42501',message='Attachment link operation denied.'; end if;
 select * into a from crm_sales.attachments where lead_id=l.id and id=(p_input->>'attachmentId')::uuid for update;
 if not found or a.state not in ('ready','removed') then raise exception using errcode='42501',message='File unavailable.'; end if;
 select * into receipt from crm_sales.attachment_link_requests where actor_id=actor and request_id=request_uuid;
 if found then
   if receipt.input<>p_input then raise exception using errcode='22023',message='Changed request reused an ID.'; end if;
   return receipt.result||jsonb_build_object('replayed',true);
 end if;
 if l.archived_at is not null or l.stage='lost' or a.state<>'ready' then
   raise exception using errcode='40001',message='Lead or file is read-only.'; end if;
 if command='link' then
   if not(payload ?& array['kind','targetId']) or exists(select 1 from jsonb_object_keys(payload) k where k not in ('kind','targetId'))
     or payload->>'kind' is null or payload->>'kind' not in ('room','visit') or (payload->>'targetId')::uuid is null then
     raise exception using errcode='22023',message='Invalid reference target.'; end if;
   if payload->>'kind'='room' then
     select * into room from crm_sales.detail_records where lead_id=l.id and id=(payload->>'targetId')::uuid and kind='room' for update;
     if not found or room.archived_at is not null then raise exception using errcode='40001',message='Room is unavailable or archived.'; end if;
     select * into r from crm_sales.attachment_links where attachment_id=a.id and room_id=room.id and archived_at is null;
   else
     select * into visit from crm_sales.site_visits where lead_id=l.id and id=(payload->>'targetId')::uuid for update;
     if not found or visit.status<>'planned' then raise exception using errcode='40001',message='Visit is unavailable or finalized.'; end if;
     select * into r from crm_sales.attachment_links where attachment_id=a.id and visit_id=visit.id and archived_at is null;
   end if;
   if r.id is null then
     insert into crm_sales.attachment_links(lead_id,attachment_id,room_id,visit_id,created_by)
       values(l.id,a.id,room.id,visit.id,actor) returning * into r;
     changed:=true;
   end if;
 else
   if not(payload ?& array['linkId','version']) or exists(select 1 from jsonb_object_keys(payload) k where k not in ('linkId','version'))
     or jsonb_typeof(payload->'version')<>'number' or payload->>'version' !~ '^[1-9][0-9]{0,8}$' then
     raise exception using errcode='22023',message='Invalid link version.'; end if;
   expected:=(payload->>'version')::integer;
   select * into r from crm_sales.attachment_links where lead_id=l.id and attachment_id=a.id and id=(payload->>'linkId')::uuid for update;
   if not found or r.archived_at is not null or r.version<>expected then
     raise exception using errcode='40001',message='Reference changed. Reload.'; end if;
   if r.room_id is not null then
     select * into room from crm_sales.detail_records where lead_id=l.id and id=r.room_id for update;
     if room.archived_at is not null then raise exception using errcode='40001',message='Archived room references are immutable.'; end if;
   else
     select * into visit from crm_sales.site_visits where lead_id=l.id and id=r.visit_id for update;
     if visit.status<>'planned' then raise exception using errcode='40001',message='Finalized visit references are immutable.'; end if;
   end if;
   update crm_sales.attachment_links set archived_by=actor,archived_at=now(),version=version+1 where id=r.id returning * into r;
   changed:=true;
 end if;
 if changed then
   insert into crm_sales.attachment_link_events(link_id,actor_id,action,after_data)
     values(r.id,actor,case when command='link' then 'linked' else 'unlinked' end,to_jsonb(r));
 end if;
 result:=jsonb_build_object('id',r.id,'version',r.version,'archived',r.archived_at is not null,'replayed',false);
 insert into crm_sales.attachment_link_requests(actor_id,request_id,lead_id,input,result) values(actor,request_uuid,l.id,p_input,result);
 return result;
end;
$$;
revoke all on function public.crm_save_attachment_link(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_save_attachment_link(jsonb) to authenticated;

create function public.crm_attachment_links(p_lead_id uuid,p_attachment_id uuid,p_kind text default 'room',p_target_page integer default 0,p_link_page integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l crm_sales.leads%rowtype; a crm_sales.attachments%rowtype; targets jsonb; links jsonb;
 target_count bigint; link_count bigint; writable boolean; can_link boolean; can_unlink boolean;
begin
 if p_kind is null or p_kind not in ('room','visit') or p_target_page is null or p_link_page is null
   or p_target_page not between 0 and 100000 or p_link_page not between 0 and 100000 then
   raise exception using errcode='22023',message='Invalid reference page.'; end if;
 select * into l from crm_sales.leads where id=p_lead_id;
 if auth.role() is distinct from 'authenticated' or not found or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true then
   raise exception using errcode='42501',message='Reference access denied.'; end if;
 select * into a from crm_sales.attachments where id=p_attachment_id and lead_id=l.id and state in ('ready','removed');
 if not found then raise exception using errcode='42501',message='File unavailable.'; end if;
 writable:=l.archived_at is null and l.stage<>'lost' and a.state='ready';
 can_link:=writable and coalesce(crm_sales.allowed('leads.update',l.assigned_user_id,l.created_by),false);
 can_unlink:=writable and coalesce(crm_sales.allowed('leads.archive',l.assigned_user_id,l.created_by),false);
 if p_kind='room' then
   select count(*) into target_count from crm_sales.detail_records where lead_id=l.id and kind='room';
   select coalesce(jsonb_agg(to_jsonb(q) order by q.id),'[]') into targets from (
     select id,data->>'name' as label,case when archived_at is null then 'active' else 'archived' end as state,
       archived_at is null as writable from crm_sales.detail_records where lead_id=l.id and kind='room'
       order by id limit 20 offset p_target_page*20
   ) q;
 else
   select count(*) into target_count from crm_sales.site_visits where lead_id=l.id;
   select coalesce(jsonb_agg(to_jsonb(q) order by q.id),'[]') into targets from (
     select id,scheduled_at::text as label,status as state,status='planned' as writable from crm_sales.site_visits where lead_id=l.id
       order by id limit 20 offset p_target_page*20
   ) q;
 end if;
 select count(*) into link_count from crm_sales.attachment_links where lead_id=l.id and attachment_id=a.id;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id),'[]') into links from (
   select x.id,x.version,x.created_by,x.created_at,x.archived_by,x.archived_at,
     case when x.room_id is not null then 'room' else 'visit' end as kind,
     coalesce(d.data->>'name',v.scheduled_at::text) as label,
     can_unlink and x.archived_at is null and coalesce((d.kind='room' and d.archived_at is null) or v.status='planned',false) as "canUnlink"
   from crm_sales.attachment_links x left join crm_sales.detail_records d on d.lead_id=x.lead_id and d.id=x.room_id
     left join crm_sales.site_visits v on v.lead_id=x.lead_id and v.id=x.visit_id
   where x.lead_id=l.id and x.attachment_id=a.id order by x.created_at desc,x.id limit 20 offset p_link_page*20
 ) q;
 return jsonb_build_object('targets',targets,'targetTotal',target_count,'targetPage',p_target_page,
   'links',links,'total',link_count,'page',p_link_page,'pageSize',20,'canLink',can_link);
end;
$$;
revoke all on function public.crm_attachment_links(uuid,uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.crm_attachment_links(uuid,uuid,text,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;