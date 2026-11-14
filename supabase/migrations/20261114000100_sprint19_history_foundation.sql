-- Revision provenance and protected saved-draft history. No new revision/approval operation.
begin;

create table crm_quotes.revisions (
  quotation_id uuid not null references crm_quotes.quotations(id) on delete cascade,
  revision integer not null check(revision>0),
  previous_revision integer,
  reason text check(reason is null or length(btrim(reason)) between 1 and 2000),
  created_by uuid not null,
  created_at timestamptz not null,
  primary key(quotation_id,revision),
  check((revision=1 and previous_revision is null)
    or (revision>1 and previous_revision is not null and previous_revision=revision-1 and reason is not null)),
  foreign key(quotation_id,previous_revision) references crm_quotes.revisions(quotation_id,revision)
    deferrable initially immediate
);

-- Sprint 18 allowed only Revision 1. Preserve each quotation's actual creator/time.
insert into crm_quotes.revisions(quotation_id,revision,created_by,created_at)
  select id,1,created_by,created_at from crm_quotes.quotations;

alter table crm_quotes.saves add column revision integer not null default 1 check(revision>0);

alter table crm_quotes.saves add constraint save_revision_fk
  foreign key(quotation_id,revision) references crm_quotes.revisions(quotation_id,revision);

create index saves_revision_page on crm_quotes.saves(quotation_id,revision,version desc);

alter table crm_quotes.revisions enable row level security;

create policy revision_read on crm_quotes.revisions for select to authenticated
  using(public.crm_can_view_quotation(quotation_id));

revoke all on crm_quotes.revisions from public,anon,authenticated,service_role;

create function crm_quotes.register_initial_revision()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into crm_quotes.revisions(quotation_id,revision,created_by,created_at)
    values(new.id,1,new.created_by,new.created_at);
  return new;
end;
$$;

create trigger register_initial_revision after insert on crm_quotes.quotations
  for each row execute function crm_quotes.register_initial_revision();

create function crm_quotes.stamp_save_revision()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  select revision into new.revision from crm_quotes.drafts where quotation_id=new.quotation_id;
  if new.revision is null then
    raise exception using errcode='23514',message='A current draft is required for saved evidence.';
  end if;
  return new;
end;
$$;

create trigger stamp_save_revision before insert on crm_quotes.saves
  for each row execute function crm_quotes.stamp_save_revision();

create function crm_quotes.reject_evidence_update()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception using errcode='42501',message='Saved quotation evidence and revision provenance cannot be overwritten.';
end;
$$;

create trigger immutable_save before update on crm_quotes.saves
  for each row execute function crm_quotes.reject_evidence_update();

create trigger immutable_revision before update on crm_quotes.revisions
  for each row execute function crm_quotes.reject_evidence_update();

create function public.crm_quotation_history(p_id uuid,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if public.crm_can_view_quotation(p_id) is not true then
    raise exception using errcode='42501',message='Quotation history is unavailable or not permitted.';
  end if;

  if p_page is null or p_page not between 0 and 10000 then
    raise exception using errcode='22023',message='Invalid history page.';
  end if;

  select jsonb_build_object('page',p_page,
    'total',(select count(*) from crm_quotes.saves where quotation_id=p_id),
    'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.version desc) from (
      select s.version,s.revision,s.actor_id as "actorId",s.occurred_at as "occurredAt",
        r.created_by as "revisionCreatedBy",r.created_at as "revisionCreatedAt",r.reason,
        s.revision=d.revision as "isCurrentRevision",s.version=d.version as "isLatestSave"
      from crm_quotes.saves s join crm_quotes.revisions r
        on r.quotation_id=s.quotation_id and r.revision=s.revision
      join crm_quotes.drafts d on d.quotation_id=s.quotation_id
      where s.quotation_id=p_id order by s.version desc limit 20 offset p_page*20
    ) x),'[]'::jsonb)) into result;

  return result;
end;
$$;

create function public.crm_quotation_snapshot(p_id uuid,p_version integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if public.crm_can_view_quotation(p_id) is not true then
    raise exception using errcode='42501',message='Quotation snapshot is unavailable or not permitted.';
  end if;

  if p_version is null or p_version<1 then
    raise exception using errcode='22023',message='Choose a saved version.';
  end if;

  select jsonb_build_object('quotationId',s.quotation_id,'revision',s.revision,'version',s.version,
    'actorId',s.actor_id,'occurredAt',s.occurred_at,'document',s.document,'calculation',s.calculation)
    into result from crm_quotes.saves s where s.quotation_id=p_id and s.version=p_version;

  if result is null then
    raise exception using errcode='42501',message='Quotation snapshot is unavailable or not permitted.';
  end if;

  return result;
end;
$$;

revoke all on function crm_quotes.register_initial_revision(),crm_quotes.stamp_save_revision(),
  crm_quotes.reject_evidence_update() from public,anon,authenticated,service_role;

revoke all on function public.crm_quotation_history(uuid,integer),public.crm_quotation_snapshot(uuid,integer)
  from public,anon,authenticated,service_role;

grant execute on function public.crm_quotation_history(uuid,integer),public.crm_quotation_snapshot(uuid,integer)
  to authenticated;

comment on table crm_quotes.revisions is 'Revision provenance; a saved draft version is not a commercial revision or approval.';

notify pgrst,'reload schema';

commit;