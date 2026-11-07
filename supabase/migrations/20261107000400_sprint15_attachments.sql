-- Additive DEC-025 local attachment workflow. Bucket guards/roles remain unchanged.
begin;
create table crm_sales.attachments (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references crm_sales.leads(id) on delete restrict,
 actor_id uuid not null,
 request_id uuid not null,
 filename text not null check(length(filename) between 1 and 180 and filename=btrim(filename)
   and filename !~ '[[:cntrl:]<>:"/|?*]' and position(chr(92) in filename)=0
   and position('..' in filename)=0 and left(filename,1)<>'.'),
 mime text not null check(mime in ('application/pdf','image/png','image/jpeg','image/webp')),
 bytes integer not null check(bytes between 1 and 10485760),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 storage_path text not null unique,
 state text not null default 'pending' check(state in ('pending','ready','failed','removed')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '15 minutes'),
 removed_by uuid,
 removed_at timestamptz,
 version integer not null default 1 check(version>0),
 unique(actor_id,request_id),
 check((state='removed')=(removed_by is not null and removed_at is not null))
);
create index attachments_page on crm_sales.attachments(lead_id,state,created_at desc,id);
create index attachments_rate on crm_sales.attachments(actor_id,created_at desc);
create table crm_sales.attachment_events (
 id bigint generated always as identity primary key,
 attachment_id uuid not null references crm_sales.attachments(id) on delete restrict,
 actor_id uuid not null,
 action text not null check(action in ('uploaded','download_access_issued','removed')),
 occurred_at timestamptz not null default now()
);
create index attachment_events_page on crm_sales.attachment_events(attachment_id,id desc);
alter table crm_sales.attachments enable row level security;
alter table crm_sales.attachment_events enable row level security;
create policy attachment_read on crm_sales.attachments for select to authenticated using(
 state in ('ready','removed') and exists(select 1 from crm_sales.leads l
   where l.id=lead_id and crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by))
);
create policy attachment_event_read on crm_sales.attachment_events for select to authenticated using(
 exists(select 1 from crm_sales.attachments a where a.id=attachment_id)
);
revoke all on crm_sales.attachments,crm_sales.attachment_events from public,anon,authenticated,service_role;
revoke all on sequence crm_sales.attachment_events_id_seq from public,anon,authenticated,service_role;
grant select(id,lead_id,filename,mime,bytes,state,actor_id,created_at,removed_by,removed_at,version)
 on crm_sales.attachments to authenticated;
grant select on crm_sales.attachment_events to authenticated;

-- Explicit actor form of the existing grant/scope rules for the privileged gateway.
-- No role names, new permissions, impersonation or client-provided actor authority.
create function crm_sales.attachment_allowed(p_actor uuid,p_permission text,p_lead uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select crm_access.is_eligible_user(p_actor) and exists(
   select 1 from crm_sales.leads l
   join crm_access.user_roles m on m.user_id=p_actor
   join crm_access.role_permissions g on g.role_key=m.role_key
   where l.id=p_lead and g.permission_key=p_permission and
   (g.scope_key='company' or (g.scope_key='assigned' and l.assigned_user_id=p_actor)
     or (g.scope_key='own' and l.created_by=p_actor))
 );
$$;
revoke all on function crm_sales.attachment_allowed(uuid,text,uuid) from public,anon,authenticated,service_role;

create function public.crm_attachment_gateway(p_actor uuid,p_operation text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 a crm_sales.attachments%rowtype; l crm_sales.leads%rowtype; keys text[];
 lead_uuid uuid; attachment_uuid uuid; request_uuid uuid; ext text; result jsonb;
begin
 if auth.role() is distinct from 'service_role' or p_actor is null then
   raise exception using errcode='42501',message='Trusted server required.'; end if;
 perform pg_advisory_xact_lock(90310001::bigint);
 if p_operation is null or p_operation not in ('check_upload','reserve','finish','abandon','authorize_download','download_issued','remove') then
   raise exception using errcode='22023',message='Unsupported attachment operation.'; end if;
 keys:=case when p_operation='check_upload' then array['leadId']
   when p_operation='remove' then array['leadId','attachmentId','version','requestId']
   when p_operation='reserve' then array['leadId','requestId','filename','mime','bytes','sha256']
   else array['leadId','attachmentId'] end;
 if p_input is null or jsonb_typeof(p_input)<>'object' or not(p_input ?& keys)
   or exists(select 1 from jsonb_object_keys(p_input) k where not(k=any(keys))) then
   raise exception using errcode='22023',message='Invalid attachment input.'; end if;
 lead_uuid:=(p_input->>'leadId')::uuid;
 select * into l from crm_sales.leads where id=lead_uuid for update;
 if not found or (p_operation<>'abandon' and crm_sales.attachment_allowed(p_actor,'leads.view',lead_uuid) is not true) then
   raise exception using errcode='42501',message='Attachment access denied.'; end if;
 if p_operation in ('check_upload','reserve','finish') and
   (crm_sales.attachment_allowed(p_actor,'leads.update',lead_uuid) is not true
     or l.archived_at is not null or l.stage='lost') then
   raise exception using errcode='42501',message='Lead is read-only.'; end if;
 if p_operation='check_upload' then return jsonb_build_object('allowed',true); end if;
 if p_operation='reserve' then
   request_uuid:=(p_input->>'requestId')::uuid;
   if request_uuid is null or jsonb_typeof(p_input->'bytes')<>'number' or p_input->>'bytes' !~ '^[1-9][0-9]{0,7}$'
     or jsonb_typeof(p_input->'filename')<>'string' or jsonb_typeof(p_input->'mime')<>'string'
     or jsonb_typeof(p_input->'sha256')<>'string' then
     raise exception using errcode='22023',message='Invalid validated metadata.'; end if;
   select * into a from crm_sales.attachments where actor_id=p_actor and request_id=request_uuid for update;
   if found then
     if (a.lead_id,a.filename,a.mime,a.bytes,a.sha256) is distinct from
       (lead_uuid,p_input->>'filename',p_input->>'mime',(p_input->>'bytes')::integer,p_input->>'sha256') then
       raise exception using errcode='22023',message='Request ID already used for different input.'; end if;
   else
     if (select count(*) from crm_sales.attachments where actor_id=p_actor and created_at>clock_timestamp()-interval '1 minute')>=10 then
       raise exception using errcode='54000',message='Upload request limit reached. Retry later.'; end if;
     attachment_uuid:=gen_random_uuid();
     ext:=case p_input->>'mime' when 'application/pdf' then 'pdf' when 'image/png' then 'png'
       when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' end;
     if ext is null or lower(p_input->>'filename') !~ ('\.'||case when ext='jpg' then '(jpg|jpeg)' else ext end||'$') then
       raise exception using errcode='22023',message='Filename/type mismatch.'; end if;
     insert into crm_sales.attachments(id,lead_id,actor_id,request_id,filename,mime,bytes,sha256,storage_path)
       values(attachment_uuid,lead_uuid,p_actor,request_uuid,p_input->>'filename',p_input->>'mime',
         (p_input->>'bytes')::integer,p_input->>'sha256',lead_uuid::text||'/'||attachment_uuid::text||'.'||ext)
       returning * into a;
   end if;
 else
   attachment_uuid:=(p_input->>'attachmentId')::uuid;
   select * into a from crm_sales.attachments where id=attachment_uuid and lead_id=lead_uuid for update;
   if not found then raise exception using errcode='42501',message='Attachment unavailable.'; end if;
 end if;
 if p_operation in ('finish','abandon') and a.actor_id<>p_actor then
   raise exception using errcode='42501',message='Upload belongs to another employee.'; end if;
 if p_operation='finish' and a.state<>'ready' then
   if a.state<>'pending' or a.expires_at<clock_timestamp() then
     raise exception using errcode='40001',message='Upload expired or failed.'; end if;
   if not exists(select 1 from storage.objects o where o.bucket_id='crm-private' and o.name=a.storage_path
     and o.metadata->>'size'=a.bytes::text and o.metadata->>'mimetype'=a.mime) then
     raise exception using errcode='22023',message='Stored object metadata mismatch.'; end if;
   update crm_sales.attachments set state='ready' where id=a.id returning * into a;
   insert into crm_sales.attachment_events(attachment_id,actor_id,action) values(a.id,p_actor,'uploaded');
 elsif p_operation='abandon' and a.state='pending' then
   update crm_sales.attachments set state='failed' where id=a.id returning * into a;
 elsif p_operation in ('authorize_download','download_issued') then
   if a.state<>'ready' then raise exception using errcode='42501',message='Attachment unavailable.'; end if;
   if p_operation='download_issued' then
     insert into crm_sales.attachment_events(attachment_id,actor_id,action) values(a.id,p_actor,'download_access_issued');
   end if;
 elsif p_operation='remove' then
   if crm_sales.attachment_allowed(p_actor,'leads.archive',lead_uuid) is not true
     or (a.state<>'removed' and (l.archived_at is not null or l.stage='lost')) then
     raise exception using errcode='42501',message='Attachment removal denied.'; end if;
   if a.state='ready' then
     if jsonb_typeof(p_input->'version')<>'number' or p_input->>'version' !~ '^[1-9][0-9]{0,8}$'
       or (p_input->>'version')::integer<>a.version or (p_input->>'requestId')::uuid is null then
       raise exception using errcode='40001',message='Attachment version changed.'; end if;
     update crm_sales.attachments set state='removed',removed_by=p_actor,removed_at=now(),version=version+1
       where id=a.id returning * into a;
     insert into crm_sales.attachment_events(attachment_id,actor_id,action) values(a.id,p_actor,'removed');
   elsif a.state<>'removed' then raise exception using errcode='40001',message='Attachment is not ready.'; end if;
 end if;
 result:=jsonb_build_object('id',a.id,'leadId',a.lead_id,'state',a.state,'path',a.storage_path,
   'filename',a.filename,'mime',a.mime,'bytes',a.bytes,'sha256',a.sha256);
 return result;
end;
$$;
revoke all on function public.crm_attachment_gateway(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_attachment_gateway(uuid,text,jsonb) to service_role;

create function public.crm_lead_attachments(p_lead_id uuid,p_page integer default 0,p_removed boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l crm_sales.leads%rowtype; result jsonb; total bigint;
begin
 if p_page is null or p_page<0 or p_page>100000 or p_removed is null then
   raise exception using errcode='22023',message='Invalid attachment page.'; end if;
 select * into l from crm_sales.leads where id=p_lead_id;
 if auth.role() is distinct from 'authenticated' or not found
   or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true then
   raise exception using errcode='42501',message='Attachment access denied.'; end if;
 select count(*) into total from crm_sales.attachments where lead_id=l.id and state=case when p_removed then 'removed' else 'ready' end;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id),'[]') into result from (
   select id,filename,mime,bytes,state,actor_id,created_at,removed_by,removed_at,version from crm_sales.attachments
   where lead_id=l.id and state=case when p_removed then 'removed' else 'ready' end
   order by created_at desc,id limit 20 offset p_page*20
 ) q;
 return jsonb_build_object('rows',result,'total',total,'page',p_page,'pageSize',20);
end;
$$;
revoke all on function public.crm_lead_attachments(uuid,integer,boolean) from public,anon,authenticated,service_role;
grant execute on function public.crm_lead_attachments(uuid,integer,boolean) to authenticated;
notify pgrst,'reload schema';
commit;