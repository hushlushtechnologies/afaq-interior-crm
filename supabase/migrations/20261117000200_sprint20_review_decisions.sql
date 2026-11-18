-- Exact-review decisions and corrected revisions. No delivery or role changes.
begin;
alter table crm_quotes.review_requests drop constraint review_requests_status_check;
alter table crm_quotes.review_requests add constraint review_requests_status_check
  check(status in ('pending','approved','rejected','changes_requested'));

create table crm_quotes.review_decisions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references crm_quotes.review_requests(id) on delete restrict,
  actor_id uuid not null,
  status text not null check(status in ('approved','rejected','changes_requested')),
  comments text check(comments is null or length(comments)<=4000),
  decided_at timestamptz not null default clock_timestamp(),
  check(status='approved' or coalesce(length(btrim(comments)),0)>=2)
);
alter table crm_quotes.review_decisions enable row level security;
revoke all on crm_quotes.review_decisions from public,anon,authenticated,service_role;
create trigger immutable_review_decision before update or delete on crm_quotes.review_decisions
  for each row execute function crm_quotes.reject_evidence_update();

create function crm_quotes.guard_review_result()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception using errcode='42501',message='Review evidence must be retained.'; end if;
  if auth.role() is distinct from 'authenticated' or old.status<>'pending'
    or new.status not in ('approved','rejected','changes_requested')
    or (new.id,new.quotation_id,new.revision,new.saved_version,new.creator_id,new.editor_id,
        new.submitted_by,new.reviewer_id,new.submitted_at,new.snapshot,new.requirements)
      is distinct from
       (old.id,old.quotation_id,old.revision,old.saved_version,old.creator_id,old.editor_id,
        old.submitted_by,old.reviewer_id,old.submitted_at,old.snapshot,old.requirements)
    or old.reviewer_id<>auth.uid() or crm_quotes.review_pm_eligible(auth.uid()) is not true
    or not exists(select 1 from crm_quotes.review_decisions d where d.review_id=old.id
      and d.actor_id=auth.uid() and d.status=new.status) then
    raise exception using errcode='42501',message='Only the validated review decision may change status.';
  end if;
  return new;
end;
$$;
drop trigger immutable_review_request on crm_quotes.review_requests;
create trigger immutable_review_request before update or delete on crm_quotes.review_requests
  for each row execute function crm_quotes.guard_review_result();

create or replace function crm_quotes.guard_pending_review()
returns trigger language plpgsql security definer set search_path='' as $$
declare review_status text;
begin
  if tg_table_name='drafts' then
    select status into review_status from crm_quotes.review_requests
      where quotation_id=old.quotation_id and revision=old.revision;
    if found then
      if tg_op='DELETE' then raise exception using errcode='42501',message='Reviewed evidence must be retained.'; end if;
      if review_status='pending' or new.quotation_id<>old.quotation_id
        or new.revision<>old.revision+1 or new.version<>old.version+1
        or new.document is distinct from old.document or new.calculation is distinct from old.calculation
        or new.status<>old.status or new.updated_by is distinct from auth.uid()
        or not exists(select 1 from crm_quotes.revisions r where r.quotation_id=old.quotation_id
          and r.revision=new.revision and r.previous_revision=old.revision and r.created_by=auth.uid()) then
        raise exception using errcode='42501',message='Reviewed content is immutable; create a new revision after review.';
      end if;
    end if;
  else
    if tg_op<>'INSERT' then
      if exists(select 1 from crm_quotes.review_requests where quotation_id=old.quotation_id and revision=old.revision) then
        raise exception using errcode='42501',message='Reviewed concept references are immutable.';
      end if;
    end if;
    if tg_op<>'DELETE' then
      if exists(select 1 from crm_quotes.review_requests where quotation_id=new.quotation_id and revision=new.revision) then
        raise exception using errcode='42501',message='Reviewed concept references are immutable.';
      end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

create function public.crm_decide_quotation_review(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); request_uuid uuid; review_uuid uuid; k text; target_status text; notes text;
  r crm_quotes.review_requests%rowtype; q crm_quotes.quotations%rowtype; d crm_quotes.drafts%rowtype;
  l crm_sales.leads%rowtype; receipt crm_quotes.review_receipts%rowtype;
  decision_uuid uuid; result jsonb;
begin
  perform crm_quotes.exact_keys(p_input,array['requestId','reviewId','expectedRevision','expectedSavedVersion','decision','comments']);
  request_uuid:=crm_quotes.uuid_value(p_input->'requestId'); review_uuid:=crm_quotes.uuid_value(p_input->'reviewId');
  foreach k in array array['expectedRevision','expectedSavedVersion'] loop
    if jsonb_typeof(p_input->k) is distinct from 'number' or p_input->>k !~ '^[1-9][0-9]{0,9}$'
      or (p_input->>k)::numeric>2147483647 then raise exception using errcode='22023',message='Invalid review version.'; end if;
  end loop;
  target_status:=case p_input->>'decision' when 'approve' then 'approved' when 'reject' then 'rejected'
    when 'request_changes' then 'changes_requested' end;
  notes:=crm_quotes.text_value(p_input->'comments',4000);
  if target_status is null or (target_status<>'approved' and coalesce(length(notes),0)<2) then
    raise exception using errcode='22023',message='A valid decision and meaningful feedback are required.';
  end if;
  select * into r from crm_quotes.review_requests where id=review_uuid;
  if not found or auth.role() is distinct from 'authenticated' or r.reviewer_id is distinct from actor
    or crm_quotes.review_pm_eligible(actor) is not true or actor in (r.creator_id,r.editor_id,r.submitted_by) then
    raise exception using errcode='42501',message='Only the named eligible independent PM may decide this review.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('quotation-review:'||actor::text,0));
  select * into q from crm_quotes.quotations where id=r.quotation_id;
  select * into l from crm_sales.leads where id=q.lead_id for share;
  select * into d from crm_quotes.drafts where quotation_id=q.id for update;
  select * into r from crm_quotes.review_requests where id=review_uuid for update;
  if r.reviewer_id is distinct from actor or crm_quotes.review_pm_eligible(actor) is not true then
    raise exception using errcode='42501',message='Review authority is no longer available.';
  end if;
  select * into receipt from crm_quotes.review_receipts where actor_id=actor and request_id=request_uuid;
  if found then
    if receipt.input<>p_input then raise exception using errcode='22023',message='Retry input changed.'; end if;
    return receipt.result||'{"replayed":true}'::jsonb;
  end if;
  if r.status<>'pending' or r.revision<>(p_input->>'expectedRevision')::integer
    or r.saved_version<>(p_input->>'expectedSavedVersion')::integer
    or d.revision<>r.revision or d.version<>r.saved_version then
    raise exception using errcode='40001',message='Review changed, is stale, or already has a decision.';
  end if;
  if target_status='approved' then
    if l.archived_at is not null or l.stage not in ('new','assigned','contacted','requirements','site-visit')
      or (l.assigned_user_id is not null and crm_sales.eligible_owner(l.assigned_user_id) is not true)
      or (r.snapshot->'document'->>'validUntil' is not null and
        (r.snapshot->'document'->>'validUntil')::date<(now() at time zone 'Asia/Dubai')::date) then
      raise exception using errcode='22023',message='The lead or recorded quotation validity is no longer eligible.';
    end if;
    if d.document<>r.snapshot->'document' or d.calculation<>r.snapshot->'calculation'
      or q.customer_snapshot<>r.snapshot->'customer'
      or crm_quotes.calculate(d.document->'pricing')<>d.calculation then
      raise exception using errcode='23514',message='Reviewed financial evidence does not match.';
    end if;
    if exists(select 1 from crm_quotes.review_files f join crm_sales.attachments a on a.id=f.attachment_id
      where f.request_id=r.id and (a.lead_id<>q.lead_id or a.state<>'ready'
        or a.sha256<>f.metadata->>'sha256' or a.mime<>f.metadata->>'mime'
        or a.bytes<>(f.metadata->>'bytes')::integer or a.filename<>f.metadata->>'filename'
        or not exists(select 1 from storage.objects o where o.bucket_id='crm-private' and o.name=a.storage_path
          and o.metadata->>'mimetype'=a.mime and o.metadata->>'size'=a.bytes::text))) then
      raise exception using errcode='22023',message='Retained review evidence is unavailable.';
    end if;
  end if;
  insert into crm_quotes.review_decisions(review_id,actor_id,status,comments)
    values(r.id,actor,target_status,notes) returning id into decision_uuid;
  update crm_quotes.review_requests set status=target_status where id=r.id;
  result:=jsonb_build_object('id',decision_uuid,'reviewId',r.id,'revision',r.revision,
    'savedVersion',r.saved_version,'status',target_status,'replayed',false);
  insert into crm_quotes.review_receipts(actor_id,request_id,input,result) values(actor,request_uuid,p_input,result);
  return result;
end;
$$;

create or replace function public.crm_get_quotation_review(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r crm_quotes.review_requests%rowtype; q crm_quotes.quotations%rowtype; evidence_allowed boolean;
begin
  if crm_quotes.review_readable(p_id) is not true then raise exception using errcode='42501',message='Review access is unavailable.'; end if;
  select * into r from crm_quotes.review_requests where id=p_id;
  select * into q from crm_quotes.quotations where id=r.quotation_id;
  evidence_allowed:=(r.reviewer_id=auth.uid() and crm_quotes.review_pm_eligible(auth.uid())) or exists(
    select 1 from crm_sales.leads l where l.id=q.lead_id and crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by));
  return jsonb_build_object('id',r.id,'quotationId',r.quotation_id,'number',q.number,'revision',r.revision,
    'savedVersion',r.saved_version,'status',r.status,'submittedBy',r.submitted_by,'reviewerId',r.reviewer_id,
    'creatorId',r.creator_id,'editorId',r.editor_id,'submittedAt',r.submitted_at,'snapshot',r.snapshot,
    'isCurrentRevision',coalesce((select d.revision=r.revision from crm_quotes.drafts d where d.quotation_id=q.id),false),
    'isLatestSavedVersion',coalesce((select d.version=r.saved_version from crm_quotes.drafts d where d.quotation_id=q.id),false),
    'decision',(select jsonb_build_object('id',x.id,'status',x.status,'actorId',x.actor_id,'comments',x.comments,'decidedAt',x.decided_at)
      from crm_quotes.review_decisions x where x.review_id=r.id),
    'evidence',case when evidence_allowed then jsonb_build_object('requirements',r.requirements,
      'images',coalesce((select jsonb_agg(metadata order by attachment_id) from crm_quotes.review_files where request_id=r.id),'[]'::jsonb)) else null end);
end;
$$;
revoke all on function crm_quotes.guard_review_result() from public,anon,authenticated,service_role;
revoke all on function public.crm_decide_quotation_review(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_decide_quotation_review(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;