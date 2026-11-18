-- Read-only picker/history/preview context. No Storage or role-policy changes.
begin;
create function public.crm_quotation_concept_context(p_id uuid,p_revision integer,p_image_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare lead_uuid uuid; result jsonb;
begin
  if crm_quotes.concept_access(p_id,false,p_revision) is not true then
    raise exception using errcode='42501',message='Concept context is unavailable.';
  end if;
  if p_image_page is null or p_image_page not between 0 and 10000 or p_revision is null
    or not exists(select 1 from crm_quotes.revisions where quotation_id=p_id and revision=p_revision) then
    raise exception using errcode='22023',message='Invalid concept context page.';
  end if;
  select lead_id into lead_uuid from crm_quotes.quotations where id=p_id;
  select jsonb_build_object('imagePage',p_image_page,'pageSize',20,
    'imageTotal',(select count(*) from crm_sales.attachments where lead_id=lead_uuid
      and state='ready' and mime in ('image/png','image/jpeg','image/webp')),
    'images',coalesce((select jsonb_agg(to_jsonb(x) order by x."createdAt" desc,x.id) from (
      select id,filename,mime,created_at as "createdAt" from crm_sales.attachments
      where lead_id=lead_uuid and state='ready' and mime in ('image/png','image/jpeg','image/webp')
      order by created_at desc,id limit 20 offset p_image_page*20
    ) x),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(x) order by x."occurredAt" desc,x.id desc) from (
      select e.id,e.reference_id as "referenceId",e.actor_id as "actorId",e.action,e.version,e.occurred_at as "occurredAt"
      from crm_quotes.concept_events e join crm_quotes.concept_references c on c.id=e.reference_id
      where c.quotation_id=p_id and c.revision=p_revision order by e.occurred_at desc,e.id desc limit 50
    ) x),'[]'::jsonb)) into result;
  return result;
end;
$$;

create function public.crm_quotation_concept_preview(p_id uuid,p_reference uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if crm_quotes.concept_access(p_id,false,null) is not true then
    raise exception using errcode='42501',message='Concept preview is unavailable.';
  end if;
  select jsonb_build_object('leadId',q.lead_id,'attachmentId',c.attachment_id,'version',c.version)
    into result from crm_quotes.concept_references c
    join crm_quotes.quotations q on q.id=c.quotation_id join crm_sales.attachments a on a.id=c.attachment_id
    where c.id=p_reference and c.quotation_id=p_id and c.archived_at is null
      and a.lead_id=q.lead_id and a.state='ready' and a.mime in ('image/png','image/jpeg','image/webp')
      and (c.room_id is null or exists(select 1 from crm_sales.detail_records r
        where r.lead_id=q.lead_id and r.id=c.room_id and r.kind='room' and r.archived_at is null));
  if result is null then raise exception using errcode='42501',message='Concept preview is unavailable.'; end if;
  return result;
end;
$$;
revoke all on function public.crm_quotation_concept_context(uuid,integer,integer),public.crm_quotation_concept_preview(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.crm_quotation_concept_context(uuid,integer,integer),public.crm_quotation_concept_preview(uuid,uuid)
  to authenticated;
notify pgrst,'reload schema';
commit;