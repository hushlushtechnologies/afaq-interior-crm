-- Local attachment request throttling before body parsing. No role/bucket changes.
begin;
create table crm_sales.attachment_upload_windows (
 actor_id uuid primary key,
 started_at timestamptz not null,
 attempts integer not null check(attempts between 1 and 10)
);
alter table crm_sales.attachment_upload_windows enable row level security;
revoke all on crm_sales.attachment_upload_windows from public,anon,authenticated,service_role;
create function public.crm_attachment_upload_attempt(p_actor uuid,p_lead_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare l crm_sales.leads%rowtype; w crm_sales.attachment_upload_windows%rowtype; stamp timestamptz:=clock_timestamp();
begin
 if auth.role() is distinct from 'service_role' then
   raise exception using errcode='42501',message='Trusted server required.'; end if;
 perform pg_advisory_xact_lock(90310001::bigint);
 select * into l from crm_sales.leads where id=p_lead_id;
 if not found or l.archived_at is not null or l.stage='lost'
   or crm_sales.attachment_allowed(p_actor,'leads.view',l.id) is not true
   or crm_sales.attachment_allowed(p_actor,'leads.update',l.id) is not true then
   raise exception using errcode='42501',message='Upload denied.'; end if;
 select * into w from crm_sales.attachment_upload_windows where actor_id=p_actor for update;
 if found and w.started_at>stamp-interval '1 minute' and w.attempts>=10 then
   raise exception using errcode='54000',message='Upload attempt limit reached.'; end if;
 insert into crm_sales.attachment_upload_windows(actor_id,started_at,attempts) values(p_actor,stamp,1)
 on conflict(actor_id) do update set
   attempts=case when attachment_upload_windows.started_at<=stamp-interval '1 minute' then 1 else attachment_upload_windows.attempts+1 end,
   started_at=case when attachment_upload_windows.started_at<=stamp-interval '1 minute' then stamp else attachment_upload_windows.started_at end;
end;
$$;
revoke all on function public.crm_attachment_upload_attempt(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.crm_attachment_upload_attempt(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;