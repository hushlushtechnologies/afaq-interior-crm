-- Local review submission foundation. No decisions, delivery or role changes.
begin;
create table crm_quotes.review_requests (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null,
  revision integer not null,
  saved_version integer not null,
  creator_id uuid not null,
  editor_id uuid not null,
  submitted_by uuid not null,
  reviewer_id uuid not null,
  submitted_at timestamptz not null default now(),
  status text not null default 'pending' check(status='pending'),
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  requirements jsonb not null check(jsonb_typeof(requirements)='array'),
  unique(quotation_id,revision),
  foreign key(quotation_id,revision) references crm_quotes.revisions(quotation_id,revision) on delete restrict,
  foreign key(quotation_id,saved_version) references crm_quotes.saves(quotation_id,version) on delete restrict,
  check(reviewer_id<>creator_id and reviewer_id<>editor_id and reviewer_id<>submitted_by)
);
create table crm_quotes.review_files (
  request_id uuid not null references crm_quotes.review_requests(id) on delete restrict,
  attachment_id uuid not null references crm_sales.attachments(id) on delete restrict,
  concept_id uuid not null references crm_quotes.concept_references(id) on delete restrict,
  metadata jsonb not null check(jsonb_typeof(metadata)='object'),
  primary key(request_id,attachment_id)
);
create table crm_quotes.review_receipts (
  actor_id uuid not null, request_id uuid not null, input jsonb not null, result jsonb not null,
  primary key(actor_id,request_id)
);
alter table crm_quotes.review_requests enable row level security;
alter table crm_quotes.review_files enable row level security;
alter table crm_quotes.review_receipts enable row level security;
revoke all on crm_quotes.review_requests,crm_quotes.review_files,crm_quotes.review_receipts
  from public,anon,authenticated,service_role;
create trigger immutable_review_request before update or delete on crm_quotes.review_requests
  for each row execute function crm_quotes.reject_evidence_update();
create trigger immutable_review_file before update or delete on crm_quotes.review_files
  for each row execute function crm_quotes.reject_evidence_update();

create function crm_quotes.review_pm_eligible(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select crm_access.is_eligible_user(p_user)
    and exists(select 1 from crm_access.user_roles where user_id=p_user and role_key='project_manager')
    and exists(select 1 from crm_access.user_roles m join crm_access.role_permissions g on g.role_key=m.role_key
      where m.user_id=p_user and g.permission_key='quotations.approve' and g.scope_key in ('assigned','company'))
    and exists(select 1 from crm_access.user_roles m join crm_access.role_permissions g on g.role_key=m.role_key
      where m.user_id=p_user and g.permission_key='quotations.view' and g.scope_key in ('assigned','company'));
$$;
create function crm_quotes.review_readable(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.role()='authenticated' and crm_access.is_eligible_user(auth.uid()) and exists(
    select 1 from crm_quotes.review_requests r join crm_quotes.quotations q on q.id=r.quotation_id
    where r.id=p_id and (crm_quotes.allowed('quotations.view',q.lead_id,q.created_by)
      or (r.reviewer_id=auth.uid() and crm_quotes.review_pm_eligible(auth.uid()))));
$$;

create function crm_quotes.guard_pending_review()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='drafts' then
    if exists(select 1 from crm_quotes.review_requests where quotation_id=old.quotation_id and revision=old.revision) then
      raise exception using errcode='42501',message='Submitted quotation is locked for review.';
    end if;
  else
    if tg_op<>'INSERT' then
      if exists(select 1 from crm_quotes.review_requests where quotation_id=old.quotation_id and revision=old.revision) then
        raise exception using errcode='42501',message='Submitted concept references are locked.';
      end if;
    end if;
    if tg_op<>'DELETE' then
      if exists(select 1 from crm_quotes.review_requests where quotation_id=new.quotation_id and revision=new.revision) then
        raise exception using errcode='42501',message='Submitted concept references are locked.';
      end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger lock_submitted_draft before update or delete on crm_quotes.drafts
  for each row execute function crm_quotes.guard_pending_review();
create trigger lock_submitted_concept before insert or update or delete on crm_quotes.concept_references
  for each row execute function crm_quotes.guard_pending_review();

create function crm_quotes.guard_review_file()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from crm_quotes.review_files where attachment_id=old.id) then
    if tg_op='DELETE' then raise exception using errcode='42501',message='Review evidence must be retained.'; end if;
    if (new.lead_id,new.storage_path,new.state,new.mime,new.bytes,new.sha256,new.filename)
      is distinct from (old.lead_id,old.storage_path,old.state,old.mime,old.bytes,old.sha256,old.filename) then
      raise exception using errcode='42501',message='Review evidence must be retained.';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger retain_review_file before update or delete on crm_sales.attachments
  for each row execute function crm_quotes.guard_review_file();

create function public.crm_submit_quotation_review(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); request_uuid uuid; qid uuid; reviewer uuid; k text;
  q crm_quotes.quotations%rowtype; d crm_quotes.drafts%rowtype; l crm_sales.leads%rowtype;
  receipt crm_quotes.review_receipts%rowtype; review_uuid uuid; result jsonb; requirement_snapshot jsonb;
begin
  perform crm_quotes.exact_keys(p_input,array['requestId','quotationId','expectedRevision','expectedVersion','reviewerId']);
  request_uuid:=crm_quotes.uuid_value(p_input->'requestId');
  qid:=crm_quotes.uuid_value(p_input->'quotationId'); reviewer:=crm_quotes.uuid_value(p_input->'reviewerId');
  foreach k in array array['expectedRevision','expectedVersion'] loop
    if jsonb_typeof(p_input->k) is distinct from 'number' or p_input->>k !~ '^[1-9][0-9]{0,9}$'
      or (p_input->>k)::numeric>2147483647 then raise exception using errcode='22023',message='Invalid review version.'; end if;
  end loop;
  select * into q from crm_quotes.quotations where id=qid;
  if not found or crm_quotes.allowed('quotations.submit',q.lead_id,q.created_by) is not true
    or crm_quotes.allowed('quotations.view',q.lead_id,q.created_by) is not true then
    raise exception using errcode='42501',message='Quotation submission is not permitted.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('quotation-review:'||actor::text,0));
  select * into l from crm_sales.leads where id=q.lead_id for share;
  select * into d from crm_quotes.drafts where quotation_id=qid for update;
  if crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true
    or crm_quotes.allowed('quotations.submit',q.lead_id,q.created_by) is not true then
    raise exception using errcode='42501',message='Quotation submission is not permitted.';
  end if;
  select * into receipt from crm_quotes.review_receipts where actor_id=actor and request_id=request_uuid;
  if found then
    if receipt.input<>p_input then raise exception using errcode='22023',message='Retry input changed.'; end if;
    return receipt.result||'{"replayed":true}'::jsonb;
  end if;
  if d.revision<>(p_input->>'expectedRevision')::integer or d.version<>(p_input->>'expectedVersion')::integer
    or d.status<>'draft' or exists(select 1 from crm_quotes.review_requests where quotation_id=qid and revision=d.revision) then
    raise exception using errcode='40001',message='Quotation changed or was already submitted.';
  end if;
  if l.archived_at is not null or l.stage not in ('new','assigned','contacted','requirements','site-visit')
    or (l.assigned_user_id is not null and crm_sales.eligible_owner(l.assigned_user_id) is not true)
    or jsonb_array_length(d.document->'pricing'->'items')<1 then
    raise exception using errcode='22023',message='An active lead and at least one valid quotation item are required.';
  end if;
  if crm_quotes.review_pm_eligible(reviewer) is not true or reviewer in (q.created_by,d.updated_by,actor) then
    raise exception using errcode='42501',message='Choose a different eligible Project Manager.';
  end if;
  if crm_quotes.calculate(d.document->'pricing')<>d.calculation or not exists(select 1 from crm_quotes.saves s
    where s.quotation_id=qid and s.version=d.version and s.revision=d.revision
      and s.document=d.document and s.calculation=d.calculation and s.actor_id=d.updated_by) then
    raise exception using errcode='23514',message='Saved quotation evidence does not match.';
  end if;
  if (select count(*) from crm_quotes.concept_references where quotation_id=qid and revision=d.revision
    and archived_at is null and selected)>200 then
    raise exception using errcode='54000',message='The review evidence exceeds the snapshot resource limit.';
  end if;
  perform 1 from crm_sales.attachments a join crm_quotes.concept_references c on c.attachment_id=a.id
    where c.quotation_id=qid and c.revision=d.revision and c.archived_at is null and c.selected for share of a;
  if exists(select 1 from crm_quotes.concept_references c join crm_sales.attachments a on a.id=c.attachment_id
    where c.quotation_id=qid and c.revision=d.revision and c.archived_at is null and c.selected
      and (a.lead_id<>q.lead_id or a.state<>'ready' or a.mime not in ('image/png','image/jpeg','image/webp')
        or not exists(select 1 from storage.objects o where o.bucket_id='crm-private' and o.name=a.storage_path
          and o.metadata->>'mimetype'=a.mime and o.metadata->>'size'=a.bytes::text)
        or (c.room_id is not null and not exists(select 1 from crm_sales.detail_records r
          where r.lead_id=q.lead_id and r.id=c.room_id and r.kind='room' and r.archived_at is null))))
    or exists(select 1 from jsonb_array_elements(d.document->'sections') s where s->>'roomId' is not null
      and not exists(select 1 from crm_sales.detail_records r where r.lead_id=q.lead_id
        and r.id=(s->>'roomId')::uuid and r.kind='room' and r.archived_at is null)) then
    raise exception using errcode='22023',message='Selected review evidence is unavailable.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'version',r.version,'data',r.data) order by r.id),'[]'::jsonb)
    into requirement_snapshot from crm_sales.detail_records r where r.lead_id=q.lead_id and r.archived_at is null
      and (r.kind='requirements' or (r.kind='room' and (exists(select 1 from jsonb_array_elements(d.document->'sections') s
        where s->>'roomId'=r.id::text) or exists(select 1 from crm_quotes.concept_references c where c.quotation_id=qid
          and c.revision=d.revision and c.selected and c.archived_at is null and c.room_id=r.id))));
  insert into crm_quotes.review_requests(quotation_id,revision,saved_version,creator_id,editor_id,submitted_by,reviewer_id,snapshot,requirements)
    values(qid,d.revision,d.version,q.created_by,d.updated_by,actor,reviewer,
      jsonb_build_object('customer',q.customer_snapshot,'document',d.document,'calculation',d.calculation),requirement_snapshot)
    returning id into review_uuid;
  insert into crm_quotes.review_files(request_id,attachment_id,concept_id,metadata)
    select review_uuid,a.id,c.id,jsonb_build_object('conceptId',c.id,'conceptVersion',c.version,'title',c.title,
      'promptNotes',c.prompt_notes,'roomId',c.room_id,'attachmentId',a.id,'filename',a.filename,
      'mime',a.mime,'bytes',a.bytes,'sha256',a.sha256)
    from crm_quotes.concept_references c join crm_sales.attachments a on a.id=c.attachment_id
    where c.quotation_id=qid and c.revision=d.revision and c.selected and c.archived_at is null;
  result:=jsonb_build_object('id',review_uuid,'quotationId',qid,'revision',d.revision,'savedVersion',d.version,'status','pending','replayed',false);
  insert into crm_quotes.review_receipts(actor_id,request_id,input,result) values(actor,request_uuid,p_input,result);
  return result;
end;
$$;

create function public.crm_get_quotation_review(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r crm_quotes.review_requests%rowtype; q crm_quotes.quotations%rowtype; evidence_allowed boolean;
begin
  if crm_quotes.review_readable(p_id) is not true then raise exception using errcode='42501',message='Review access is unavailable.'; end if;
  select * into r from crm_quotes.review_requests where id=p_id;
  select * into q from crm_quotes.quotations where id=r.quotation_id;
  evidence_allowed:=(r.reviewer_id=auth.uid() and crm_quotes.review_pm_eligible(auth.uid())) or exists(select 1 from crm_sales.leads l where l.id=q.lead_id
    and crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by));
  return jsonb_build_object('id',r.id,'quotationId',r.quotation_id,'number',q.number,'revision',r.revision,
    'savedVersion',r.saved_version,'status',r.status,'submittedBy',r.submitted_by,'reviewerId',r.reviewer_id,
    'creatorId',r.creator_id,'editorId',r.editor_id,'submittedAt',r.submitted_at,'snapshot',r.snapshot,
    'evidence',case when evidence_allowed then jsonb_build_object('requirements',r.requirements,
      'images',coalesce((select jsonb_agg(metadata order by attachment_id) from crm_quotes.review_files where request_id=r.id),'[]'::jsonb)) else null end);
end;
$$;
revoke all on function crm_quotes.review_pm_eligible(uuid),crm_quotes.review_readable(uuid),
  crm_quotes.guard_pending_review(),crm_quotes.guard_review_file() from public,anon,authenticated,service_role;
revoke all on function public.crm_submit_quotation_review(jsonb),public.crm_get_quotation_review(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.crm_submit_quotation_review(jsonb),public.crm_get_quotation_review(uuid) to authenticated;
notify pgrst,'reload schema';
commit;