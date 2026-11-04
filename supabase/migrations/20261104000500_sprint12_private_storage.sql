-- Reserved foundation bucket. No client access until business-link authorization exists.
-- Fail on an existing ID instead of silently modifying an unknown bucket.
insert into storage.buckets(
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'crm-private',
  'crm-private',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
);

-- RESTRICTIVE guards remain effective even alongside broad permissive policies.
-- Other bucket IDs are unaffected by these guards.
create policy crm_private_object_guard
on storage.objects
as restrictive
for all
to anon, authenticated
using (bucket_id <> 'crm-private')
with check (bucket_id <> 'crm-private');

create policy crm_private_bucket_guard
on storage.buckets
as restrictive
for all
to anon, authenticated
using (id <> 'crm-private')
with check (id <> 'crm-private');

notify pgrst, 'reload schema';