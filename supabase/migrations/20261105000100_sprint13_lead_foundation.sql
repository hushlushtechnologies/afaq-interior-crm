-- Additive, single-company inquiry foundation. No quotation/project conversion.
begin;
create schema crm_sales;
revoke all on schema crm_sales from public, anon, authenticated, service_role;
alter default privileges in schema crm_sales revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema crm_sales revoke execute on functions from public, anon, authenticated, service_role;

insert into crm_access.permissions(permission_key,label)
values ('leads.archive','Archive eligible leads while preserving history');
insert into crm_access.role_permissions(role_key,permission_key,scope_key)
values ('super_admin','leads.archive','company');

create table crm_sales.sources (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{0,39}$'),
  name text not null check (length(name) between 1 and 80),
  active boolean not null default true
);
insert into crm_sales.sources(code,name) values
 ('facebook','Facebook Lead Ads'),('instagram','Instagram Lead Ads'),('phone','Phone'),
 ('whatsapp','WhatsApp inquiry'),('website','Website'),('walk_in','Walk-in'),
 ('referral','Referral'),('manual','Manual entry'),('csv','CSV import'),('other','Other');

create table crm_sales.leads (
  id uuid primary key default gen_random_uuid(),
  reference bigint generated always as identity unique,
  customer_name text not null check (length(btrim(customer_name)) between 2 and 160),
  constraint leads_customer_name_content check (customer_name ~ '[^[:space:]]'),
  email text check (email is null or (length(email)<=254 and email=lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  alternate_phone text check (alternate_phone is null or alternate_phone ~ '^\+[1-9][0-9]{6,14}$'),
  source_code text not null references crm_sales.sources(code),
  external_id text check (external_id is null or length(external_id) between 1 and 200),
  assigned_user_id uuid references auth.users(id) on delete restrict,
  stage text not null default 'new' check (stage='new'),
  qualification_status text not null default 'unreviewed' check (qualification_status='unreviewed'),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  property_type text check (length(property_type)<=100),
  location text check (length(location)<=300),
  budget numeric(14,2) check (budget>=0),
  currency text not null default 'AED' check (currency='AED'),
  expected_start_on date,
  inquiry_on date not null default (now() at time zone 'Asia/Dubai')::date,
  follow_up_on date,
  description text check (length(description)<=4000),
  initial_note text check (length(initial_note)<=2000),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version>0),
  archived_at timestamptz,
  unique(source_code,external_id)
);
create index leads_owner_page on crm_sales.leads(assigned_user_id,created_at desc,id);
create index leads_page on crm_sales.leads(archived_at,created_at desc,id);
create index leads_email on crm_sales.leads(email) where email is not null;
create index leads_phone on crm_sales.leads(phone) where phone is not null;

-- UUID identities deliberately survive Auth identity deletion in historical evidence.
create table crm_sales.events (
  id bigint generated always as identity primary key,
  lead_id uuid not null references crm_sales.leads(id) on delete restrict,
  actor_id uuid not null,
  action text not null check (action in ('created','updated','assigned','archived')),
  before_data jsonb,
  after_data jsonb not null,
  occurred_at timestamptz not null default now()
);
create index events_lead on crm_sales.events(lead_id,id desc);
create table crm_sales.requests (
  actor_id uuid not null,
  request_id uuid not null,
  input jsonb not null,
  possible_duplicate boolean not null default false,
  lead_id uuid not null references crm_sales.leads(id) on delete restrict,
  primary key(actor_id,request_id)
);

create function crm_sales.allowed(p_permission text,p_owner uuid,p_creator uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and crm_access.is_eligible_user(auth.uid())
   and (public.crm_has_permission(p_permission,'company')
     or (p_owner=auth.uid() and public.crm_has_permission(p_permission,'assigned'))
     or (p_creator=auth.uid() and public.crm_has_permission(p_permission,'own')));
$$;
create function crm_sales.eligible_owner(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select crm_access.is_eligible_user(p_user) and exists(
   select 1 from crm_access.user_roles where user_id=p_user and role_key in ('sales_executive','super_admin'));
$$;
create function crm_sales.guard_identity()
returns trigger language plpgsql set search_path='' as $$
begin
 if (new.id,new.reference,new.created_by,new.created_at,new.source_code,new.external_id,new.stage,new.qualification_status,new.initial_note)
    is distinct from
    (old.id,old.reference,old.created_by,old.created_at,old.source_code,old.external_id,old.stage,old.qualification_status,old.initial_note) then
   raise exception using errcode='42501',message='Lead identity, source, intake stage and initial evidence are immutable.';
 end if;
 return new;
end;
$$;
create trigger guard_identity before update on crm_sales.leads for each row execute function crm_sales.guard_identity();

alter table crm_sales.sources enable row level security;
alter table crm_sales.leads enable row level security;
alter table crm_sales.events enable row level security;
alter table crm_sales.requests enable row level security;
create policy source_read on crm_sales.sources for select to authenticated
 using (public.crm_has_permission('leads.view') or public.crm_has_permission('leads.create'));
create policy lead_read on crm_sales.leads for select to authenticated
 using (crm_sales.allowed('leads.view',assigned_user_id,created_by));
create policy event_read on crm_sales.events for select to authenticated
 using (exists(select 1 from crm_sales.leads l where l.id=lead_id));
revoke all on all tables in schema crm_sales from public,anon,authenticated,service_role;
revoke all on all sequences in schema crm_sales from public,anon,authenticated,service_role;
revoke all on all functions in schema crm_sales from public,anon,authenticated,service_role;
grant usage on schema crm_sales to authenticated;
grant select on crm_sales.sources,crm_sales.leads,crm_sales.events to authenticated;
grant execute on function crm_sales.allowed(text,uuid,uuid) to authenticated;

create function public.crm_lead_page(p_page integer default 0,p_archived boolean default false,p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if public.crm_has_permission('leads.view') is not true then
   raise exception using errcode='42501',message='Lead visibility required.'; end if;
 if p_page is null or p_page not between 0 and 10000 or p_archived is null then
   raise exception using errcode='22023',message='Invalid page.'; end if;
 with visible as (
   select * from crm_sales.leads l
   where crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by)
     and (p_id is not null or (l.archived_at is not null)=p_archived)
     and (p_id is null or l.id=p_id)
 ), selected as (select * from visible order by created_at desc,id limit 20 offset p_page*20)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('assigned_name',(select coalesce(e.display_name,u.email) from auth.users u left join crm_employees.employees e on e.auth_user_id=u.id where u.id=s.assigned_user_id)) order by s.created_at desc,s.id) from selected s),'[]'::jsonb),
   'total',(select count(*) from visible),'page',p_page,
   'events',case when p_id is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(e) order by e.id desc) from (
     select id,actor_id,action,occurred_at from crm_sales.events where lead_id=p_id
       and exists(select 1 from visible) order by id desc limit 50) e),'[]'::jsonb) end)
 into result;
 return result;
end;
$$;

create function public.crm_lead_options()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if public.crm_has_permission('leads.view') is not true and public.crm_has_permission('leads.create') is not true then
   raise exception using errcode='42501',message='Lead access required.'; end if;
 return jsonb_build_object('sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from crm_sales.sources s where s.active),'[]'::jsonb),
   'owners',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',coalesce(e.display_name,u.email)) order by coalesce(e.display_name,u.email))
     from auth.users u left join crm_employees.employees e on e.auth_user_id=u.id
     where crm_sales.eligible_owner(u.id)
       and (public.crm_has_permission('leads.assign','company') or u.id=auth.uid())),'[]'::jsonb));
end;
$$;

create function public.crm_save_lead(p_request_id uuid,p_command text,p_lead_id uuid,p_version integer,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); l crm_sales.leads%rowtype; previous jsonb; receipt crm_sales.requests%rowtype;
 fingerprint jsonb:=jsonb_build_object('command',p_command,'id',p_lead_id,'version',p_version,'data',p_data);
 owner_id uuid; amount numeric; field text; duplicate_found boolean:=false;
begin
 -- Synchronize eligibility checks with employee/role changes, then lock request and row.
 perform pg_advisory_xact_lock(90310001::bigint);
 if actor is null or crm_access.is_eligible_user(actor) is not true or auth.role() is distinct from 'authenticated' then
   raise exception using errcode='42501',message='Active authenticated employee required.'; end if;
 if p_request_id is null or p_command is null or p_command not in ('create','update','assign','archive')
    or p_data is null or jsonb_typeof(p_data)<>'object' then
   raise exception using errcode='22023',message='Invalid request.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_request_id::text,13));
 if p_command='create' then
   if p_lead_id is not null or p_version is not null or public.crm_has_permission('leads.create') is not true then
     raise exception using errcode='42501',message='Lead creation is not permitted.'; end if;
 else
   if p_lead_id is null or p_version is null then raise exception using errcode='22023',message='Lead version required.'; end if;
   select * into l from crm_sales.leads where id=p_lead_id for update;
   if not found or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true
      or crm_sales.allowed('leads.'||case p_command when 'update' then 'update' when 'assign' then 'assign' else 'archive' end,l.assigned_user_id,l.created_by) is not true then
     raise exception using errcode='42501',message='Lead operation is not permitted.'; end if;
 end if;
 select * into receipt from crm_sales.requests where actor_id=actor and request_id=p_request_id;
 if found then
   if receipt.input<>fingerprint then raise exception using errcode='22023',message='Request ID already used for different input.'; end if;
   select * into l from crm_sales.leads where id=receipt.lead_id;
   if crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true then
     raise exception using errcode='42501',message='Lead is no longer accessible.'; end if;
   return jsonb_build_object('lead',to_jsonb(l),'replayed',true,'possibleDuplicate',receipt.possible_duplicate);
 end if;
 if p_command<>'create' and (l.version<>p_version or l.archived_at is not null) then
   raise exception using errcode='40001',message='Lead changed or was archived. Reload before trying again.'; end if;
 previous:=case when p_command='create' then null else to_jsonb(l) end;
 if p_command in ('create','update') then
   if exists(select 1 from jsonb_object_keys(p_data) k where k not in
     ('customer_name','email','phone','alternate_phone','source_code','assigned_user_id','priority','property_type','location','budget','expected_start_on','inquiry_on','follow_up_on','description','initial_note')) then
     raise exception using errcode='22023',message='Unexpected lead field.'; end if;
   foreach field in array array['customer_name','email','phone','alternate_phone','source_code','assigned_user_id','priority','property_type','location','budget','expected_start_on','inquiry_on','follow_up_on','description','initial_note'] loop
     if p_data ? field and jsonb_typeof(p_data->field) not in ('string','null') then
       raise exception using errcode='22023',message='Lead fields must be text or null.'; end if;
   end loop;
   if length(btrim(coalesce(p_data->>'customer_name',''))) not between 2 and 160
      or coalesce(p_data->>'priority','') not in ('low','normal','high','urgent')
      or p_data->>'inquiry_on' is null then
     raise exception using errcode='22023',message='Name, priority and inquiry date required.'; end if;
   amount:=nullif(p_data->>'budget','')::numeric;
   if amount is not null and (amount<0 or amount>=1000000000000 or amount<>round(amount,2)) then
     raise exception using errcode='22023',message='Invalid AED budget.'; end if;
   if p_command='create' then
     owner_id:=nullif(p_data->>'assigned_user_id','')::uuid;
     if public.crm_has_permission('leads.assign','company') is not true and owner_id is distinct from actor then
       raise exception using errcode='42501',message='New leads must be assigned to yourself.'; end if;
     if owner_id is not null and crm_sales.eligible_owner(owner_id) is not true then
       raise exception using errcode='22023',message='Assignee is not eligible.'; end if;
     if crm_sales.allowed('leads.view',owner_id,actor) is not true then
       raise exception using errcode='42501',message='Lead visibility required for creation.'; end if;
     if not exists(select 1 from crm_sales.sources where code=p_data->>'source_code' and active) then
       raise exception using errcode='22023',message='Choose an active source.'; end if;
     insert into crm_sales.leads(customer_name,source_code,assigned_user_id,created_by,initial_note)
       values(btrim(p_data->>'customer_name'),p_data->>'source_code',owner_id,actor,nullif(btrim(p_data->>'initial_note'),'')) returning * into l;
   else
     if (p_data ? 'source_code' and p_data->>'source_code' is distinct from l.source_code)
       or (p_data ? 'assigned_user_id' and nullif(p_data->>'assigned_user_id','')::uuid is distinct from l.assigned_user_id)
       or (p_data ? 'initial_note' and nullif(btrim(p_data->>'initial_note'),'') is distinct from l.initial_note) then
       raise exception using errcode='42501',message='Use assignment controls; source and initial note are preserved.'; end if;
   end if;
   update crm_sales.leads set customer_name=btrim(p_data->>'customer_name'),email=nullif(lower(btrim(p_data->>'email')),''),
     phone=nullif(btrim(p_data->>'phone'),''),alternate_phone=nullif(btrim(p_data->>'alternate_phone'),''),
     priority=p_data->>'priority',property_type=nullif(btrim(p_data->>'property_type'),''),location=nullif(btrim(p_data->>'location'),''),
     budget=amount,expected_start_on=nullif(p_data->>'expected_start_on','')::date,inquiry_on=(p_data->>'inquiry_on')::date,
     follow_up_on=nullif(p_data->>'follow_up_on','')::date,description=nullif(btrim(p_data->>'description'),''),
     version=case when p_command='create' then 1 else version+1 end,updated_at=now()
     where id=l.id returning * into l;
   select exists(select 1 from crm_sales.leads other where other.id<>l.id
     and crm_sales.allowed('leads.view',other.assigned_user_id,other.created_by)
     and ((l.email is not null and other.email=l.email) or (l.phone is not null and (other.phone=l.phone or other.alternate_phone=l.phone))
       or (l.alternate_phone is not null and (other.phone=l.alternate_phone or other.alternate_phone=l.alternate_phone)))) into duplicate_found;
 elsif p_command='assign' then
   if exists(select 1 from jsonb_object_keys(p_data) k where k<>'assigned_user_id') then
     raise exception using errcode='22023',message='Unexpected assignment field.'; end if;
   owner_id:=nullif(p_data->>'assigned_user_id','')::uuid;
   if owner_id is not null and crm_sales.eligible_owner(owner_id) is not true then
     raise exception using errcode='22023',message='Assignee is not eligible.'; end if;
   if owner_id is not distinct from l.assigned_user_id then
     insert into crm_sales.requests(actor_id,request_id,input,lead_id) values(actor,p_request_id,fingerprint,l.id);
     return jsonb_build_object('lead',to_jsonb(l),'replayed',false,'possibleDuplicate',false);
   end if;
   update crm_sales.leads set assigned_user_id=owner_id,version=version+1,updated_at=now() where id=l.id returning * into l;
 else
   if p_data<>'{}'::jsonb then raise exception using errcode='22023',message='Unexpected archive field.'; end if;
   update crm_sales.leads set archived_at=now(),version=version+1,updated_at=now() where id=l.id returning * into l;
 end if;
 insert into crm_sales.events(lead_id,actor_id,action,before_data,after_data)
 values(l.id,actor,case p_command when 'create' then 'created' when 'update' then 'updated' when 'assign' then 'assigned' else 'archived' end,previous,to_jsonb(l));
 insert into crm_sales.requests(actor_id,request_id,input,lead_id,possible_duplicate) values(actor,p_request_id,fingerprint,l.id,duplicate_found);
 return jsonb_build_object('lead',to_jsonb(l),'replayed',false,'possibleDuplicate',duplicate_found);
end;
$$;
revoke all on function public.crm_lead_page(integer,boolean,uuid) from public,anon,authenticated,service_role;
revoke all on function public.crm_lead_options() from public,anon,authenticated,service_role;
revoke all on function public.crm_save_lead(uuid,text,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_lead_page(integer,boolean,uuid),public.crm_lead_options(),public.crm_save_lead(uuid,text,uuid,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;