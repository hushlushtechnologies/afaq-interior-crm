-- Forward repair: 20261114000200 was pushed empty.
-- Also accepts its correctly applied implementation.
-- Preserve migration history, saved evidence, roles and quotation identities.
begin;

alter table crm_quotes.drafts
  drop constraint if exists drafts_revision_check;

alter table crm_quotes.drafts
  add constraint drafts_revision_check check(revision>0);

do $$
begin
  if not exists(
    select 1
    from pg_constraint
    where conrelid='crm_quotes.drafts'::regclass
      and conname='draft_revision_fk'
  ) then
    alter table crm_quotes.drafts
      add constraint draft_revision_fk
      foreign key(quotation_id,revision)
      references crm_quotes.revisions(quotation_id,revision);
  end if;
end;
$$;

do $$
declare
  definition text:=pg_get_functiondef(
    'public.crm_save_quotation_draft(jsonb)'::regprocedure
  );

  old_guard text:='d.status<>''draft'' or d.revision<>1 or d.version<>expected';

  new_guard text:='d.status<>''draft'' or not exists(select 1 from crm_quotes.revisions r where r.quotation_id=d.quotation_id and r.revision=d.revision) or d.version<>expected';

  old_result text:='''revision'',1,''status'',''draft'',''calculation'',calculation';

  new_result text:='''revision'',d.revision,''status'',''draft'',''calculation'',calculation';

  old_count integer;
  new_count integer;
begin
  old_count:=(
    length(definition)-length(replace(definition,old_guard,''))
  )/length(old_guard);

  new_count:=(
    length(definition)-length(replace(definition,new_guard,''))
  )/length(new_guard);

  if old_count=1 and new_count=0 then
    definition:=replace(definition,old_guard,new_guard);
  elsif old_count<>0 or new_count<>1 then
    raise exception 'Unexpected draft revision guard; review before repairing.';
  end if;

  old_count:=(
    length(definition)-length(replace(definition,old_result,''))
  )/length(old_result);

  new_count:=(
    length(definition)-length(replace(definition,new_result,''))
  )/length(new_result);

  if old_count=1 and new_count=0 then
    definition:=replace(definition,old_result,new_result);
  elsif old_count<>0 or new_count<>1 then
    raise exception 'Unexpected draft revision result; review before repairing.';
  end if;

  execute definition;
end;
$$;

create or replace function public.crm_create_quotation_revision(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
<<revision_command>>
declare
  actor uuid:=auth.uid();
  request_id uuid;
  quote_id uuid;
  expected_version integer;
  expected_revision integer;
  reason text;
  key text;

  q crm_quotes.quotations%rowtype;
  l crm_sales.leads%rowtype;
  d crm_quotes.drafts%rowtype;
  receipt crm_quotes.requests%rowtype;
  result jsonb;
begin
  perform pg_advisory_xact_lock(90310001::bigint);

  if actor is null
    or auth.role() is distinct from 'authenticated'
    or crm_access.is_eligible_user(actor) is not true then
    raise exception using
      errcode='42501',
      message='Active authenticated employee required.';
  end if;

  perform crm_quotes.exact_keys(
    p_input,
    array[
      'requestId',
      'quotationId',
      'expectedVersion',
      'expectedRevision',
      'reason'
    ]
  );

  if octet_length(p_input::text)>16000 then
    raise exception using
      errcode='22023',
      message='Revision request is too large.';
  end if;

  request_id:=crm_quotes.uuid_value(p_input->'requestId');
  quote_id:=crm_quotes.uuid_value(p_input->'quotationId');
  reason:=crm_quotes.text_value(p_input->'reason',2000,1);

  foreach key in array array['expectedVersion','expectedRevision'] loop
    if jsonb_typeof(p_input->key) is distinct from 'number'
      or (p_input->>key) !~ '^[1-9][0-9]{0,9}$'
      or (p_input->>key)::numeric>2147483647 then
      raise exception using
        errcode='22023',
        message='A valid expected revision and saved version are required.';
    end if;
  end loop;

  expected_version:=(p_input->>'expectedVersion')::integer;
  expected_revision:=(p_input->>'expectedRevision')::integer;

  perform pg_advisory_xact_lock(
    hashtextextended(actor::text||request_id::text,1803)
  );

  select * into q
  from crm_quotes.quotations
  where id=quote_id;

  if not found then
    raise exception using
      errcode='42501',
      message='Quotation operation is not permitted.';
  end if;

  select * into l
  from crm_sales.leads
  where id=q.lead_id
  for update;

  select * into q
  from crm_quotes.quotations
  where id=quote_id
  for update;

  if crm_sales.allowed(
      'leads.view',l.assigned_user_id,l.created_by
    ) is not true
    or crm_quotes.allowed(
      'quotations.view',q.lead_id,q.created_by
    ) is not true
    or crm_quotes.allowed(
      'quotations.update',q.lead_id,q.created_by
    ) is not true then
    raise exception using
      errcode='42501',
      message='Quotation operation is not permitted.';
  end if;

  if l.archived_at is not null
    or l.stage not in (
      'new','assigned','contacted','requirements','site-visit'
    )
    or (
      l.assigned_user_id is not null
      and crm_sales.eligible_owner(l.assigned_user_id) is not true
    ) then
    raise exception using
      errcode='22023',
      message='An active pre-quotation lead with an eligible owner is required.';
  end if;

  select * into receipt
  from crm_quotes.requests r
  where r.actor_id=actor
    and r.request_id=revision_command.request_id;

  if found then
    if receipt.input<>p_input then
      raise exception using
        errcode='22023',
        message='Request ID already used for different input.';
    end if;

    return receipt.result||jsonb_build_object('replayed',true);
  end if;

  select * into d
  from crm_quotes.drafts
  where quotation_id=quote_id
  for update;

  if not found
    or d.status<>'draft'
    or d.version<>expected_version
    or d.revision<>expected_revision
    or d.version=2147483647
    or d.revision=2147483647 then
    raise exception using
      errcode='40001',
      message='Draft changed. Reload before creating a revision.';
  end if;

  if not exists(
    select 1
    from crm_quotes.saves s
    where s.quotation_id=quote_id
      and s.version=d.version
      and s.revision=d.revision
      and s.document=d.document
      and s.calculation=d.calculation
  ) then
    raise exception using
      errcode='23514',
      message='The latest saved evidence must match the draft.';
  end if;

  insert into crm_quotes.revisions(
    quotation_id,
    revision,
    previous_revision,
    reason,
    created_by,
    created_at
  )
  values(
    quote_id,
    d.revision+1,
    d.revision,
    revision_command.reason,
    actor,
    now()
  );

  update crm_quotes.drafts
  set revision=revision+1,
      version=version+1,
      updated_by=actor,
      updated_at=now()
  where quotation_id=quote_id
  returning * into d;

  insert into crm_quotes.saves(
    quotation_id,
    version,
    actor_id,
    document,
    calculation
  )
  values(
    quote_id,
    d.version,
    actor,
    d.document,
    d.calculation
  );

  result:=jsonb_build_object(
    'id',quote_id,
    'number',q.number,
    'revision',d.revision,
    'version',d.version,
    'status','draft',
    'calculation',d.calculation,
    'replayed',false
  );

  insert into crm_quotes.requests(
    actor_id,
    request_id,
    quotation_id,
    input,
    result
  )
  values(
    actor,
    request_id,
    quote_id,
    p_input,
    result
  );

  return result;
end;
$$;

revoke all on function public.crm_create_quotation_revision(jsonb)
  from public,anon,authenticated,service_role;

grant execute on function public.crm_create_quotation_revision(jsonb)
  to authenticated;

comment on function public.crm_create_quotation_revision(jsonb) is
  'Copies the current saved draft into an explicit new commercial revision; never approves or delivers it.';

notify pgrst,'reload schema';

commit;