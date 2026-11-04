-- Local synthetic metadata only; every object, bucket, policy and grant rolls back.
\set ON_ERROR_STOP on

BEGIN;

SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '5s';

DO $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'crm-private'
      and public = false
      and file_size_limit = 10485760
      and allowed_mime_types @> array[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp'
      ]
      and cardinality(allowed_mime_types) = 4
  ) then
    raise exception 'Private bucket configuration mismatch';
  end if;

  if (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname in ('buckets', 'objects')
      and c.relrowsecurity
  ) <> 2 then
    raise exception 'Managed Storage RLS is disabled';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and policyname in (
        'crm_private_object_guard',
        'crm_private_bucket_guard'
      )
      and permissive = 'RESTRICTIVE'
  ) <> 2 then
    raise exception 'Restrictive guards missing';
  end if;
end;
$$;

insert into storage.buckets(id, name, public)
values ('s12-control', 's12-control', false);

insert into storage.objects(bucket_id, name)
values
  ('crm-private', 's12-sql-probe'),
  ('s12-control', 's12-sql-probe');

-- Deliberately permissive fixture policies must not expose the reserved bucket.
create policy s12_probe_objects
on storage.objects
for all
to anon, authenticated
using (true)
with check (true);

create policy s12_probe_buckets
on storage.buckets
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete
on storage.objects, storage.buckets
to anon, authenticated;

SET LOCAL ROLE authenticated;

DO $$
begin
  if exists (
    select 1 from storage.objects where bucket_id = 'crm-private'
  ) then
    raise exception 'Private object listed';
  end if;

  if exists (
    select 1 from storage.buckets where id = 'crm-private'
  ) then
    raise exception 'Private bucket listed';
  end if;

  if not exists (
    select 1 from storage.objects where bucket_id = 's12-control'
  ) then
    raise exception 'Unrelated bucket affected';
  end if;

  begin
    insert into storage.objects(bucket_id, name)
    values ('crm-private', 'forged');

    raise exception 'Private upload allowed';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update storage.objects
    set bucket_id = 'crm-private'
    where bucket_id = 's12-control';

    raise exception 'Move into private bucket allowed';
  exception when insufficient_privilege then
    null;
  end;

  update storage.objects
  set bucket_id = 's12-control'
  where bucket_id = 'crm-private';

  if found then
    raise exception 'Move out of private bucket allowed';
  end if;

  -- Managed Storage blocks direct SQL DELETE; actual deletion is checked via its API.
  update storage.buckets
  set public = true
  where id = 'crm-private';

  if found then
    raise exception 'Private bucket made public';
  end if;
end;
$$;

RESET ROLE;

SET LOCAL ROLE anon;

DO $$
begin
  if exists (
    select 1 from storage.objects where bucket_id = 'crm-private'
  ) then
    raise exception 'Anonymous private read';
  end if;

  begin
    insert into storage.objects(bucket_id, name)
    values ('crm-private', 'anonymous');

    raise exception 'Anonymous private upload';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

RESET ROLE;

ROLLBACK;