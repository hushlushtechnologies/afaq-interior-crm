-- Approved local capture authority. No employee impersonation, source rewrites or job activation.
begin;
create extension if not exists pg_net;
revoke all on all functions in schema net from public,anon,authenticated,service_role;
revoke all on all tables in schema net from public,anon,authenticated,service_role;
create schema crm_capture;
revoke all on schema crm_capture from public,anon,authenticated,service_role;
alter default privileges in schema crm_capture revoke all on tables from public,anon,authenticated,service_role;
alter default privileges in schema crm_capture revoke execute on functions from public,anon,authenticated,service_role;
insert into crm_access.permissions(permission_key,label) values('integrations.manage','Manage approved local lead integrations');
insert into crm_access.role_permissions(role_key,permission_key,scope_key) values('super_admin','integrations.manage','company');
create table crm_capture.principals (
 auth_user_id uuid primary key references auth.users(id),active boolean not null default true
);
create table crm_capture.connections (
 id uuid primary key,principal_id uuid not null references crm_capture.principals(auth_user_id),
 sponsor_id uuid not null references auth.users(id),provider text not null check(provider in ('website','meta')),
 source_code text not null references crm_sales.sources(code),owner_id uuid references auth.users(id),
 binding text not null unique check(binding ~ '^CAPTURE_[A-Z0-9_]{1,60}$'),
 page_id text,form_id text,active boolean not null default false,expires_at timestamptz not null,
 version integer not null default 1,created_at timestamptz not null default now(),
 check((provider='website' and source_code='website' and page_id is null and form_id is null)
 or(provider='meta' and source_code in ('facebook','instagram') and page_id is not null and form_id is not null and page_id ~ '^[1-9][0-9]{0,63}$' and form_id ~ '^[1-9][0-9]{0,63}$'))
);
create unique index capture_active_meta_form on crm_capture.connections(page_id,form_id) where provider='meta' and active;
create table crm_capture.executions (
 id uuid primary key default gen_random_uuid(),principal_id uuid not null,
 accountable_id uuid not null,connection_id uuid not null references crm_capture.connections(id),
 occurred_at timestamptz not null default now(),operation text not null
);
create table crm_capture.events (
 id uuid primary key default gen_random_uuid(),connection_id uuid not null references crm_capture.connections(id),
 event_key text not null check(length(event_key) between 1 and 160),digest text not null check(digest ~ '^[0-9a-f]{64}$'),
 metadata jsonb not null,inquiry jsonb,state text not null default 'queued' check(state in ('queued','processing','held','succeeded')),
 attempts integer not null default 0 check(attempts between 0 and 5),available_at timestamptz not null default now(),
 lease uuid,lease_until timestamptz,resulting_lead_id uuid references crm_sales.leads(id),safe_error text,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(connection_id,event_key),check((state='succeeded')=(resulting_lead_id is not null))
);
create index capture_due on crm_capture.events(connection_id,state,available_at);
create table crm_capture.audit (
 id bigint generated always as identity primary key,actor_id uuid not null,connection_id uuid not null,
 event_id uuid,action text not null,occurred_at timestamptz not null default now()
);
create table crm_capture.runtime (
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,
 worker_url text not null check(worker_url ~ '^http://(host[.]docker[.]internal|172[.](1[6-9]|2[0-9]|3[01])[.][0-9]{1,3}[.][0-9]{1,3}|127[.]0[.]0[.]1):3100/api/integrations/capture-worker$')
);
alter table crm_sales.leads add column capture_execution_id uuid references crm_capture.executions(id);
alter table crm_sales.leads add column created_actor_kind text not null default 'employee' check(created_actor_kind in ('employee','integration'));
create or replace function crm_access.is_eligible_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users a where a.id=p_user_id and coalesce(a.email,'')<>''
 and a.email_confirmed_at is not null and a.deleted_at is null and (a.banned_until is null or a.banned_until<=now())
 and not exists(select 1 from crm_capture.principals p where p.auth_user_id=a.id)
 and not exists(select 1 from crm_employees.employees e where e.auth_user_id=a.id and e.employment_status<>'active')
 and not exists(select 1 from crm_employees.invitations i where(i.auth_user_id=a.id or i.work_email=lower(a.email)) and i.status<>'accepted'));
$$;
create function crm_capture.guard_employee() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 target:=coalesce((to_jsonb(new)->>'user_id')::uuid,(to_jsonb(new)->>'auth_user_id')::uuid);
 if exists(select 1 from crm_capture.principals where auth_user_id=target) then raise exception using errcode='42501',message='Service identities cannot become employees.';end if;
 return new;
end;
$$;
create trigger capture_no_role before insert or update on crm_access.user_roles for each row execute function crm_capture.guard_employee();
create trigger capture_no_profile before insert or update on crm_employees.employees for each row execute function crm_capture.guard_employee();
create function crm_capture.manager() returns boolean language sql stable security definer set search_path='' as $$
 select auth.role()='authenticated' and crm_access.is_super_admin(auth.uid())
 and public.crm_has_permission('integrations.manage','company');
$$;
create function crm_capture.authority(c crm_capture.connections) returns boolean language sql stable security definer set search_path='' as $$
 select c.active and c.expires_at>now() and crm_access.is_eligible_user(c.sponsor_id)
 and exists(select 1 from crm_access.user_roles where user_id=c.sponsor_id and role_key='super_admin')
 and exists(select 1 from crm_capture.principals p join auth.users u on u.id=p.auth_user_id
   where p.auth_user_id=c.principal_id and p.active and u.deleted_at is null and u.email_confirmed_at is not null
   and(u.banned_until is null or u.banned_until<=now()))
 and exists(select 1 from crm_sales.sources s where s.code=c.source_code and s.active)
 and(c.owner_id is null or crm_sales.eligible_owner(c.owner_id))
 and exists(select 1 from crm_access.user_roles ur join crm_access.role_permissions rp using(role_key)
   where ur.user_id=c.sponsor_id and rp.permission_key='leads.create' and rp.scope_key='company')
 and exists(select 1 from crm_access.user_roles ur join crm_access.role_permissions rp using(role_key)
   where ur.user_id=c.sponsor_id and rp.permission_key='leads.assign' and rp.scope_key='company')
 and exists(select 1 from crm_access.user_roles ur join crm_access.role_permissions rp using(role_key)
   where ur.user_id=c.sponsor_id and rp.permission_key='integrations.manage' and rp.scope_key='company');
$$;
create function crm_capture.service(p_id uuid) returns crm_capture.connections language plpgsql security definer set search_path='' as $$
declare c crm_capture.connections;
begin
 select * into c from crm_capture.connections where id=p_id;
 if auth.role() is distinct from 'authenticated' or c.principal_id is distinct from auth.uid()
 or crm_capture.authority(c) is not true then raise exception using errcode='42501',message='Capture authority unavailable.'; end if;
 return c;
end;
$$;
create function public.crm_capture_config(p_id uuid,p_principal uuid,p_provider text,p_source text,p_binding text,p_owner uuid,
 p_page text,p_form text,p_active boolean,p_expires timestamptz,p_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c crm_capture.connections; v integer;
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 if crm_capture.manager() is not true then raise exception using errcode='42501',message='Integration administration denied.'; end if;
 if p_id is null or p_principal is null or p_active is null or p_expires is null or not isfinite(p_expires)
 or p_expires<=now() or p_expires>now()+interval '1 year'
 or (p_owner is not null and crm_sales.eligible_owner(p_owner) is not true) then
 raise exception using errcode='22023',message='Invalid capture configuration.'; end if;
 select * into c from crm_capture.connections where id=p_id;
 if found then
   if c.version is distinct from p_version or(c.principal_id,c.provider,c.source_code,c.binding,c.page_id,c.form_id)
     is distinct from(p_principal,p_provider,p_source,p_binding,p_page,p_form) then
     raise exception using errcode='40001',message='Reload the connection before changing it.'; end if;
 else
   if p_version is not null then raise exception using errcode='40001',message='Connection unavailable.'; end if;
   if not exists(select 1 from crm_capture.principals where auth_user_id=p_principal) then
     if not exists(select 1 from auth.users where id=p_principal and deleted_at is null and email_confirmed_at is not null)
       or exists(select 1 from crm_access.user_roles where user_id=p_principal)
       or exists(select 1 from crm_employees.employees where auth_user_id=p_principal)
       or exists(select 1 from crm_employees.invitations i join auth.users u on(u.id=i.auth_user_id or lower(u.email)=i.work_email) where u.id=p_principal)
       or exists(select 1 from crm_access.role_events where target_user_id=p_principal or actor_id=p_principal)
       or exists(select 1 from crm_sales.events where actor_id=p_principal)
       or exists(select 1 from crm_sales.leads where created_by=p_principal or assigned_user_id=p_principal) then
       raise exception using errcode='22023',message='A fresh non-employee Auth identity is required.'; end if;
     insert into crm_capture.principals(auth_user_id) values(p_principal);
   end if;
 end if;
 insert into crm_capture.connections(id,principal_id,sponsor_id,provider,source_code,binding,owner_id,page_id,form_id,active,expires_at)
 values(p_id,p_principal,auth.uid(),p_provider,p_source,p_binding,p_owner,p_page,p_form,p_active,p_expires)
 on conflict(id) do update set sponsor_id=auth.uid(),owner_id=p_owner,active=p_active,expires_at=p_expires,version=crm_capture.connections.version+1
 returning version into v;
 insert into crm_capture.audit(actor_id,connection_id,action) values(auth.uid(),p_id,'configured');
 return jsonb_build_object('id',p_id,'version',v);
end;
$$;
create function public.crm_capture_binding(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c crm_capture.connections;
begin c:=crm_capture.service(p_id);return to_jsonb(c);end;
$$;
create function crm_capture.fields(c crm_capture.connections,inquiry jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare d jsonb;
begin
 if inquiry is null or jsonb_typeof(inquiry)<>'object' or exists(select 1 from jsonb_object_keys(inquiry) k where k not in
 ('customer_name','email','phone','alternate_phone','property_type','location','budget','expected_start_on','description')) then
 raise exception using errcode='22023',message='Invalid capture inquiry fields.';end if;
 d:=jsonb_build_object('email',null,'phone',null,'alternate_phone',null,'property_type',null,'location',null,'budget',null,
 'expected_start_on',null,'description',null)||inquiry||jsonb_build_object('source_code',c.source_code,'assigned_user_id',c.owner_id,
 'priority','normal','inquiry_on',(now() at time zone 'Asia/Dubai')::date,'follow_up_on',null,'initial_note',null);
 d:=d||jsonb_build_object('email',lower(d->>'email'));
 perform crm_sales.check_import_fields(d);return d;
end;
$$;
create function public.crm_capture_stage(p_id uuid,p_key text,p_digest text,p_metadata jsonb,p_inquiry jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c crm_capture.connections;e crm_capture.events;replayed boolean:=false;
begin
 perform pg_advisory_xact_lock(90310001::bigint);c:=crm_capture.service(p_id);
 if p_key is null or p_digest is null or p_metadata is null or jsonb_typeof(p_metadata)<>'object'
 or octet_length(p_metadata::text)>4096 or(p_inquiry is not null and(jsonb_typeof(p_inquiry)<>'object' or octet_length(p_inquiry::text)>32768))
 or(c.provider='website' and(p_metadata<>'{}'::jsonb or exists(select 1 from jsonb_object_keys(p_inquiry) k where k not in ('customer_name','email','phone','alternate_phone','property_type','location','budget','expected_start_on','description')) or p_key !~ '^website:request:[0-9a-f-]{36}$' or p_inquiry is null))
 or(c.provider='meta' and(p_key<>('meta:leadgen:'||coalesce(p_metadata->>'leadgenId',''))
   or p_metadata->>'leadgenId' !~ '^[1-9][0-9]{0,63}$'
   or jsonb_typeof(p_metadata->'createdTime') is distinct from 'number'
   or coalesce(p_metadata->>'createdTime','') !~ '^(0|[1-9][0-9]{0,12})$'
   or exists(select 1 from jsonb_object_keys(p_metadata) k where k not in ('pageId','formId','leadgenId','createdTime'))
   or p_metadata->>'pageId' is distinct from c.page_id or p_metadata->>'formId' is distinct from c.form_id or p_inquiry is not null)) then
 raise exception using errcode='22023',message='Invalid capture event.';end if;
 if c.provider='meta' and (p_metadata->>'createdTime')::bigint>extract(epoch from now())+300 then raise exception using errcode='22023',message='Invalid provider creation time.';end if;
 if c.provider='website' then perform crm_capture.fields(c,p_inquiry);end if;
 select * into e from crm_capture.events where connection_id=p_id and event_key=p_key;
 if found then
   replayed:=true;
   if e.digest<>p_digest then raise exception using errcode='22023',message='Event identity collision.';end if;
 else
   if(select count(*) from crm_capture.events where connection_id=p_id and created_at>now()-interval '1 minute')>=100 then
     raise exception using errcode='P0001',message='Capture admission limit reached.';end if;
   insert into crm_capture.events(connection_id,event_key,digest,metadata,inquiry)
   values(p_id,p_key,p_digest,p_metadata,p_inquiry) returning * into e;
   insert into crm_capture.audit(actor_id,connection_id,event_id,action) values(auth.uid(),p_id,e.id,'staged');
 end if;
 return jsonb_build_object('id',e.id,'state',e.state,'replayed',replayed);
end;
$$;
create function public.crm_capture_stage_batch(p_id uuid,p_events jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare value jsonb;receipts jsonb:='[]';
begin
 if p_events is null or jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events) not between 1 and 100
 or octet_length(p_events::text)>131072 then raise exception using errcode='22023',message='Invalid capture batch.';end if;
 for value in select * from jsonb_array_elements(p_events) loop
 receipts:=receipts||jsonb_build_array(public.crm_capture_stage(p_id,value->>'key',value->>'digest',value->'metadata',null));
 end loop;return receipts;
end;
$$;
revoke all on function public.crm_capture_stage_batch(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_capture_stage_batch(uuid,jsonb) to authenticated;
create function public.crm_capture_claim(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c crm_capture.connections;e crm_capture.events; rows jsonb:='[]';
begin
 perform pg_advisory_xact_lock(90310001::bigint);c:=crm_capture.service(p_id);
 for e in select * from crm_capture.events where connection_id=p_id and attempts<5 and available_at<=now()
 and(state='queued' or(state='processing' and lease_until<=now())) order by created_at,id limit 10 for update loop
   update crm_capture.events set state='processing',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '5 minutes',version=version+1,updated_at=now()
   where id=e.id returning * into e;
   rows:=rows||jsonb_build_array(jsonb_build_object('id',e.id,'lease',e.lease,'metadata',e.metadata,'inquiry',e.inquiry));
 end loop;
 -- Recover a final crashed attempt for explicit review rather than leaving it leased forever.
 update crm_capture.events set state='held',safe_error='lease_expired',lease=null,lease_until=null,version=version+1
 where connection_id=p_id and state='processing' and attempts=5 and lease_until<=now();
 return rows;
end;
$$;
create function public.crm_capture_finish(p_event uuid,p_lease uuid,p_inquiry jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
<<finish>>
declare e crm_capture.events;c crm_capture.connections;d jsonb;exec_id uuid;lead_id uuid;ext text;
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 select * into e from crm_capture.events where id=p_event for update;c:=crm_capture.service(e.connection_id);
 if e.state<>'processing' or e.lease is distinct from p_lease or e.lease_until<=now() then
 raise exception using errcode='40001',message='Capture lease changed.';end if;
 if p_inquiry is null or jsonb_typeof(p_inquiry)<>'object' or exists(select 1 from jsonb_object_keys(p_inquiry) k where k not in
 ('customer_name','email','phone','alternate_phone','property_type','location','budget','expected_start_on','description')) then
 raise exception using errcode='22023',message='Invalid normalized inquiry.';end if;
 if c.provider='website' and p_inquiry is distinct from e.inquiry then raise exception using errcode='22023',message='Website evidence changed.';end if;
 d:=crm_capture.fields(c,p_inquiry);
 if c.provider='meta' then d:=jsonb_set(d,'{inquiry_on}',to_jsonb((to_timestamp((e.metadata->>'createdTime')::bigint) at time zone 'Asia/Dubai')::date::text));end if;
 ext:=case when c.provider='meta' then 'meta:'||(e.metadata->>'leadgenId') else c.id::text||':'||e.event_key end;
 insert into crm_capture.executions(principal_id,accountable_id,connection_id,operation)
 values(auth.uid(),c.sponsor_id,c.id,'lead.capture') returning id into exec_id;
 insert into crm_sales.leads(customer_name,email,phone,alternate_phone,source_code,external_id,assigned_user_id,property_type,location,
 budget,expected_start_on,inquiry_on,description,created_by,capture_execution_id,created_actor_kind)
 values(d->>'customer_name',d->>'email',d->>'phone',d->>'alternate_phone',c.source_code,ext,c.owner_id,d->>'property_type',d->>'location',
 (d->>'budget')::numeric,(d->>'expected_start_on')::date,(d->>'inquiry_on')::date,d->>'description',auth.uid(),exec_id,'integration') returning id into lead_id;
 insert into crm_sales.events(lead_id,actor_id,action,after_data) select finish.lead_id,auth.uid(),'created',to_jsonb(l) from crm_sales.leads l where l.id=finish.lead_id;
 update crm_capture.events set state='succeeded',resulting_lead_id=lead_id,inquiry=null,lease=null,lease_until=null,
 safe_error=null,version=version+1,updated_at=now() where id=p_event;
 insert into crm_capture.audit(actor_id,connection_id,event_id,action) values(auth.uid(),c.id,p_event,'lead_created');
 return lead_id;
end;
$$;
create function public.crm_capture_fail(p_event uuid,p_lease uuid,p_code text) returns void
language plpgsql security definer set search_path='' as $$
declare e crm_capture.events;c crm_capture.connections;
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 select * into e from crm_capture.events where id=p_event for update;
 select * into c from crm_capture.connections where id=e.connection_id;
 if auth.role()<>'authenticated' or c.principal_id is distinct from auth.uid() or e.state<>'processing'
 or e.lease is distinct from p_lease or e.lease_until<=now() or p_code is null or p_code not in ('provider_unavailable','invalid_inquiry','processing_failed') then
 raise exception using errcode='42501',message='Capture failure recording denied.';end if;
 update crm_capture.events set state=case when attempts>=5 or p_code='invalid_inquiry' then 'held' else 'queued' end,
 available_at=now()+make_interval(mins=>case attempts when 1 then 1 when 2 then 5 when 3 then 15 else 60 end),
 safe_error=p_code,lease=null,lease_until=null,version=version+1,updated_at=now() where id=p_event;
 insert into crm_capture.audit(actor_id,connection_id,event_id,action) values(auth.uid(),c.id,p_event,'attempt_failed');
end;
$$;
create function public.crm_capture_review(p_page integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if crm_capture.manager() is not true then raise exception using errcode='42501',message='Capture review denied.';end if;
 if p_page is null or p_page not between 0 and 10000 then raise exception using errcode='22023',message='Invalid review page.';end if;
 return jsonb_build_object('connections',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from crm_capture.connections c),'[]'),
 'rows',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from(select id,connection_id,state,attempts,safe_error,resulting_lead_id,version,created_at
 from crm_capture.events order by created_at desc,id limit 20 offset p_page*20)q),'[]'),
 'total',(select count(*) from crm_capture.events),'page',p_page);
end;
$$;
create function public.crm_capture_retry(p_id uuid,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare e crm_capture.events;c crm_capture.connections;
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 if crm_capture.manager() is not true then raise exception using errcode='42501',message='Capture retry denied.';end if;
 select * into e from crm_capture.events where id=p_id for update;select * into c from crm_capture.connections where id=e.connection_id;
 if e.state is distinct from 'held' or e.version is distinct from p_version or crm_capture.authority(c) is not true then
 raise exception using errcode='40001',message='Review current authority and event state.';end if;
 update crm_capture.events set state='queued',attempts=0,available_at=now(),safe_error=null,version=version+1,updated_at=now() where id=p_id;
 insert into crm_capture.audit(actor_id,connection_id,event_id,action) values(auth.uid(),e.connection_id,e.id,'retry_requested');
end;
$$;
create function crm_capture.dispatch_due() returns integer language plpgsql security definer set search_path='' as $$
declare c crm_capture.connections;r crm_capture.runtime;secret text;body jsonb;n integer:=0;
begin
 select * into r from crm_capture.runtime where singleton and enabled;if not found then return 0;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='afaq-local-capture-worker';
 if secret is null or length(secret)<32 then raise exception 'Local worker signing binding unavailable.';end if;
 for c in select * from crm_capture.connections x where crm_capture.authority(x) and exists(select 1 from crm_capture.events e where e.connection_id=x.id
 and((e.state='queued' and e.available_at<=now())or(e.state='processing' and e.lease_until<=now()))) limit 10 loop
 body:=jsonb_build_object('connectionId',c.id,'at',floor(extract(epoch from clock_timestamp()))::bigint,'nonce',gen_random_uuid());
 perform net.http_post(url:=r.worker_url,body:=body,headers:=jsonb_build_object('Content-Type','application/json',
 'X-Afaq-Worker-Signature',encode(extensions.hmac(convert_to(body::text,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex')),timeout_milliseconds:=45000);
 n:=n+1;
 end loop;return n;
end;
$$;
create function public.crm_capture_setup_worker(p_connection uuid,p_secret text,p_url text) returns void
language plpgsql security definer set search_path='' as $$
declare secret_id uuid;
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 if crm_capture.manager() is not true or not exists(select 1 from crm_capture.connections where id=p_connection) then
 raise exception using errcode='42501',message='Worker setup denied.';end if;
 if p_secret is null or p_secret !~ '^[A-Za-z0-9_-]{43,128}$' then raise exception using errcode='22023',message='Invalid worker signing binding.';end if;
 select id into secret_id from vault.secrets where name='afaq-local-capture-worker';
 if secret_id is null then perform vault.create_secret(p_secret,'afaq-local-capture-worker');
 else perform vault.update_secret(secret_id,p_secret);end if;
 insert into crm_capture.runtime(singleton,enabled,worker_url) values(true,true,p_url)
 on conflict(singleton)do update set enabled=true,worker_url=p_url;
 insert into crm_capture.audit(actor_id,connection_id,action)values(auth.uid(),p_connection,'worker_configured');
end;
$$;
revoke all on function public.crm_capture_setup_worker(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_capture_setup_worker(uuid,text,text) to authenticated;

revoke all on vault.secrets,vault.decrypted_secrets from public,anon,authenticated,service_role;
-- Private data and private helper functions have no application direct grants.
alter table crm_capture.principals enable row level security;
alter table crm_capture.connections enable row level security;
alter table crm_capture.executions enable row level security;
alter table crm_capture.events enable row level security;
alter table crm_capture.audit enable row level security;
alter table crm_capture.runtime enable row level security;
revoke all on all tables in schema crm_capture from public,anon,authenticated,service_role;
revoke all on all functions in schema crm_capture from public,anon,authenticated,service_role;
revoke all on function public.crm_capture_config(uuid,uuid,text,text,text,uuid,text,text,boolean,timestamptz,integer),
 public.crm_capture_binding(uuid),public.crm_capture_stage(uuid,text,text,jsonb,jsonb),public.crm_capture_claim(uuid),
 public.crm_capture_finish(uuid,uuid,jsonb),public.crm_capture_fail(uuid,uuid,text),public.crm_capture_review(integer),public.crm_capture_retry(uuid,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.crm_capture_config(uuid,uuid,text,text,text,uuid,text,text,boolean,timestamptz,integer),
 public.crm_capture_binding(uuid),public.crm_capture_stage(uuid,text,text,jsonb,jsonb),public.crm_capture_claim(uuid),
 public.crm_capture_finish(uuid,uuid,jsonb),public.crm_capture_fail(uuid,uuid,text),public.crm_capture_review(integer),public.crm_capture_retry(uuid,integer)
 to authenticated;
create or replace function public.crm_employee_directory(p_search text default '', p_page integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if public.crm_has_permission('employees.view', 'company') is not true then
    raise exception using errcode = '42501', message = 'Company employee visibility is required.';
  end if;
  if p_search is null or length(p_search) > 100 or p_page is null or p_page not between 0 and 10000 then
    raise exception using errcode = '22023', message = 'Invalid directory query.';
  end if;
  with records as (
    select account.id as user_id, coalesce(employee.display_name, account.email) as name,
      account.email, coalesce(employee.employment_status,
        case when account.email_confirmed_at is null or invitation.status is not null and invitation.status <> 'accepted' then 'invited' else 'active' end) as status,
      account.email_confirmed_at is not null as confirmed,
      (account.banned_until is not null and account.banned_until > now()) as blocked,
      coalesce((select jsonb_agg(role_key order by role_key) from crm_access.user_roles
        where user_id = account.id), '[]'::jsonb) as roles,
      invitation.status as invitation_status
    from auth.users account
    left join crm_employees.employees employee on employee.auth_user_id = account.id
    left join lateral (
      select i.status from crm_employees.invitations i
      where i.auth_user_id = account.id or i.work_email = lower(account.email)
      order by (i.auth_user_id = account.id) desc nulls last limit 1
    ) invitation on true
    where not exists(select 1 from crm_capture.principals p where p.auth_user_id=account.id) and account.deleted_at is null and coalesce(account.email, '') <> ''
    union all
    select null::uuid, i.display_name, i.work_email, 'invited', false, false, '[]'::jsonb, i.status
    from crm_employees.invitations i where i.auth_user_id is null
      and not exists(select 1 from auth.users where lower(email) = i.work_email)
  ), filtered as (
    select * from records where position(lower(btrim(p_search)) in lower(name || ' ' || email)) > 0
  ), selected as (
    select * from filtered order by lower(email), user_id nulls last limit 20 offset p_page * 20
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'userId', user_id, 'name', name, 'email', email, 'status', status,
      'confirmed', confirmed, 'blocked', blocked, 'roles', roles, 'invitationStatus', invitation_status
    ) order by lower(email)) from selected), '[]'::jsonb),
    'total', (select count(*) from filtered), 'page', p_page,
    'canManage', crm_access.is_super_admin(auth.uid()) and public.crm_has_permission('access.roles.manage', 'company')
  ) into v_result;
  return v_result;
end;
$$;

alter function public.crm_change_employee_status(uuid,uuid,text,text) set schema crm_capture;
alter function crm_capture.crm_change_employee_status(uuid,uuid,text,text) rename to change_employee_status_human;
revoke all on function crm_capture.change_employee_status_human(uuid,uuid,text,text) from public,anon,authenticated,service_role;
create function public.crm_change_employee_status(p_request_id uuid,p_user_id uuid,p_expected text,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(90310001::bigint);
 if exists(select 1 from crm_capture.principals where auth_user_id=p_user_id) then raise exception using errcode='42501',message='Service identity is not an employee.';end if;
 return crm_capture.change_employee_status_human(p_request_id,p_user_id,p_expected,p_status);
end;
$$;
revoke all on function public.crm_change_employee_status(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_change_employee_status(uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;