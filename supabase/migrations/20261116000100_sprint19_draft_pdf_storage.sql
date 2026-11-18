-- Local Sprint 19 foundation only. No approval, delivery or financial changes.
begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('crm-quotation-drafts','crm-quotation-drafts',false,10485760,array['application/pdf']);

create policy quotation_pdf_object_guard on storage.objects as restrictive
for all to anon,authenticated
using(bucket_id<>'crm-quotation-drafts') with check(bucket_id<>'crm-quotation-drafts');
create policy quotation_pdf_bucket_guard on storage.buckets as restrictive
for all to anon,authenticated
using(id<>'crm-quotation-drafts') with check(id<>'crm-quotation-drafts');

create table crm_quotes.draft_pdfs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  request_id uuid not null,
  quotation_id uuid not null,
  saved_version integer not null,
  template text not null check(template='s19-english-a4-v1'),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  byte_count integer not null check(byte_count between 1 and 10485760),
  page_count integer not null check(page_count between 1 and 80),
  path text not null unique check(path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.pdf$'),
  state text not null default 'pending' check(state in ('pending','ready','failed')),
  created_at timestamptz not null default clock_timestamp(),
  ready_at timestamptz,
  unique(actor_id,request_id),
  foreign key(quotation_id,saved_version) references crm_quotes.saves(quotation_id,version) on delete restrict,
  check((state='ready')=(ready_at is not null))
);
create index draft_pdf_attempts on crm_quotes.draft_pdfs(actor_id,created_at desc);
create table crm_quotes.draft_pdf_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references crm_quotes.draft_pdfs(id) on delete restrict,
  actor_id uuid not null,
  action text not null check(action in ('generated','failed','download_access_issued')),
  occurred_at timestamptz not null default clock_timestamp()
);
create index draft_pdf_event_history on crm_quotes.draft_pdf_events(document_id,occurred_at,id);
alter table crm_quotes.draft_pdfs enable row level security;
alter table crm_quotes.draft_pdf_events enable row level security;
revoke all on crm_quotes.draft_pdfs,crm_quotes.draft_pdf_events from public,anon,authenticated,service_role;
create trigger immutable_pdf_event before update or delete on crm_quotes.draft_pdf_events
for each row execute function crm_quotes.reject_evidence_update();

-- Explicit actor equivalent of crm_quotes.allowed. Only a verified server identity
-- may reach this helper through the service-role gateway; no browser actor authority.
create function crm_quotes.pdf_allowed(p_actor uuid,p_quotation uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select crm_access.is_eligible_user(p_actor) and exists(
    select 1 from crm_quotes.quotations q join crm_sales.leads l on l.id=q.lead_id
    join crm_access.user_roles m on m.user_id=p_actor
    join crm_access.role_permissions g on g.role_key=m.role_key
    where q.id=p_quotation and g.permission_key='quotations.view' and
      (g.scope_key='company'
       or (g.scope_key='assigned' and l.assigned_user_id=p_actor and crm_sales.eligible_owner(p_actor))
       or (g.scope_key='own' and q.created_by=p_actor))
  );
$$;
revoke all on function crm_quotes.pdf_allowed(uuid,uuid) from public,anon,authenticated,service_role;

create function public.crm_draft_pdf_gateway(p_actor uuid,p_operation text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  d crm_quotes.draft_pdfs%rowtype;
  q uuid; request_uuid uuid; document_uuid uuid; save_no integer;
  bytes integer; pages integer;
begin
  if auth.role() is distinct from 'service_role' or p_actor is null then
    raise exception using errcode='42501',message='Trusted PDF service required.';
  end if;
  if p_operation is null or p_operation not in
    ('reserve','finish','abandon','authorize_download','download_issued') then
    raise exception using errcode='22023',message='Invalid PDF operation.';
  end if;
  if p_operation='reserve' then
    perform crm_quotes.exact_keys(p_input,array['quotationId','version','requestId','template','sha256','bytes','pages']);
    q:=crm_quotes.uuid_value(p_input->'quotationId');
    request_uuid:=crm_quotes.uuid_value(p_input->'requestId');
    if crm_quotes.pdf_allowed(p_actor,q) is not true then
      raise exception using errcode='42501',message='PDF access is unavailable.';
    end if;
    if jsonb_typeof(p_input->'version') is distinct from 'number'
      or p_input->>'version' !~ '^[1-9][0-9]{0,9}$'
      or (p_input->>'version')::numeric>2147483647
      or jsonb_typeof(p_input->'bytes') is distinct from 'number'
      or p_input->>'bytes' !~ '^[1-9][0-9]{0,7}$'
      or (p_input->>'bytes')::numeric>10485760
      or jsonb_typeof(p_input->'pages') is distinct from 'number'
      or p_input->>'pages' !~ '^[1-9][0-9]?$'
      or (p_input->>'pages')::integer>80
      or p_input->'template' is distinct from '"s19-english-a4-v1"'::jsonb
      or jsonb_typeof(p_input->'sha256') is distinct from 'string'
      or p_input->>'sha256' !~ '^[a-f0-9]{64}$' then
      raise exception using errcode='22023',message='Invalid generated PDF metadata.';
    end if;
    save_no:=(p_input->>'version')::integer;
    bytes:=(p_input->>'bytes')::integer;
    pages:=(p_input->>'pages')::integer;
    if not exists(select 1 from crm_quotes.saves where quotation_id=q and version=save_no) then
      raise exception using errcode='42501',message='PDF access is unavailable.';
    end if;
    -- Serialize an actor's reservations, including the retry and rate-limit checks.
    perform pg_advisory_xact_lock(hashtextextended('draft-pdf:'||p_actor::text,0));
    select * into d from crm_quotes.draft_pdfs where actor_id=p_actor and request_id=request_uuid for update;
    if found then
      if d.quotation_id<>q or d.saved_version<>save_no or d.sha256<>p_input->>'sha256'
        or d.byte_count<>bytes or d.page_count<>pages or d.template<>p_input->>'template' then
        raise exception using errcode='22023',message='Retry metadata differs from the original request.';
      end if;
    else
      if (select count(*) from crm_quotes.draft_pdfs where actor_id=p_actor
        and created_at>clock_timestamp()-interval '1 minute')>=5 then
        raise exception using errcode='54000',message='PDF generation limit reached.';
      end if;
      document_uuid:=gen_random_uuid();
      insert into crm_quotes.draft_pdfs(id,actor_id,request_id,quotation_id,saved_version,
        template,sha256,byte_count,page_count,path)
      values(document_uuid,p_actor,request_uuid,q,save_no,p_input->>'template',p_input->>'sha256',
        bytes,pages,document_uuid::text||'/'||gen_random_uuid()::text||'.pdf') returning * into d;
    end if;
  else
    perform crm_quotes.exact_keys(p_input,array['documentId']);
    document_uuid:=crm_quotes.uuid_value(p_input->'documentId');
    select * into d from crm_quotes.draft_pdfs where id=document_uuid for update;
    if not found then
      raise exception using errcode='42501',message='PDF access is unavailable.';
    end if;
    -- Abandon permits only the original uploader to fail a pending object after
    -- revoked access. It never grants access to a completed document or its URL.
    if p_operation='abandon' then
      if d.actor_id<>p_actor then
        raise exception using errcode='42501',message='PDF cleanup is unavailable.';
      end if;
    elsif crm_quotes.pdf_allowed(p_actor,d.quotation_id) is not true then
      raise exception using errcode='42501',message='PDF access is unavailable.';
    end if;
    if p_operation='finish' then
      if d.actor_id<>p_actor or d.state='failed' then
        raise exception using errcode='42501',message='PDF finalization is unavailable.';
      end if;
      if d.state='pending' then
        if not exists(select 1 from storage.objects where bucket_id='crm-quotation-drafts'
          and name=d.path and metadata->>'mimetype'='application/pdf'
          and metadata->>'size'=d.byte_count::text) then
          raise exception using errcode='22023',message='The uploaded PDF is not confirmed.';
        end if;
        update crm_quotes.draft_pdfs set state='ready',ready_at=clock_timestamp()
          where id=d.id returning * into d;
        insert into crm_quotes.draft_pdf_events(document_id,actor_id,action) values(d.id,p_actor,'generated');
      end if;
    elsif p_operation='abandon' and d.state='pending' then
      update crm_quotes.draft_pdfs set state='failed' where id=d.id returning * into d;
      insert into crm_quotes.draft_pdf_events(document_id,actor_id,action) values(d.id,p_actor,'failed');
    elsif p_operation in ('authorize_download','download_issued') then
      if d.state<>'ready' then
        raise exception using errcode='42501',message='PDF access is unavailable.';
      end if;
      if p_operation='download_issued' then
        insert into crm_quotes.draft_pdf_events(document_id,actor_id,action)
          values(d.id,p_actor,'download_access_issued');
      end if;
    end if;
  end if;
  return jsonb_build_object('id',d.id,'quotationId',d.quotation_id,'version',d.saved_version,
    'state',d.state,'path',d.path,'sha256',d.sha256,'bytes',d.byte_count,'pages',d.page_count,
    'template',d.template);
end;
$$;
revoke all on function public.crm_draft_pdf_gateway(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_draft_pdf_gateway(uuid,text,jsonb) to service_role;
comment on table crm_quotes.draft_pdfs is 'Internal draft artifacts only; never approval or client-delivery evidence.';
notify pgrst,'reload schema';
commit;