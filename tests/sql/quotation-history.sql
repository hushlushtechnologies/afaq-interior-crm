\set ON_ERROR_STOP on
begin;

set local statement_timeout='45s';

create temporary table history_fixture(actor uuid,other_actor uuid,finance uuid,quote uuid);
grant select on history_fixture to authenticated;

do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); f uuid:=gen_random_uuid();
  l uuid:=gen_random_uuid(); q uuid; p jsonb; r jsonb; i integer; denied boolean;
begin
  insert into auth.users(id,email,email_confirmed_at)
    values(a,'s19-'||a||'@example.test',now()),
      (b,'s19-'||b||'@example.test',now()),
      (f,'s19-'||f||'@example.test',now());

  insert into crm_access.user_roles(user_id,role_key)
    values(a,'sales_executive'),(b,'sales_executive'),(f,'finance_officer');

  insert into crm_sales.leads(id,customer_name,source_code,assigned_user_id,created_by)
    values(l,'History fixture','manual',a,a);

  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);

  p:=jsonb_build_object(
    'requestId',gen_random_uuid(),'quotationId',null,'expectedVersion',null,'leadId',l,
    'title','Original history title','quotationDate','2026-11-14','validUntil',null,
    'companyVatNumber',null,'clientNotes',null,'internalNotes',null,'terms',null,
    'paymentTerms',null,'sections','[]'::jsonb,
    'pricing','{"policyId":"s18-exclusive-discount-before-tax-half-up-v1","currency":"AED","items":[],"overallDiscount":{"mode":"none"}}'::jsonb
  );

  r:=public.crm_save_quotation_draft(p);
  q:=(r->>'id')::uuid;

  if not exists(
    select 1 from crm_quotes.revisions
    where quotation_id=q and revision=1 and created_by=a
  ) then
    raise exception 'Initial revision was not registered';
  end if;

  for i in 2..22 loop
    r:=public.crm_save_quotation_draft(
      p||jsonb_build_object(
        'requestId',gen_random_uuid(),'quotationId',q,
        'expectedVersion',i-1,'title','Saved title '||i
      )
    );
  end loop;

  r:=public.crm_quotation_history(q,0);

  if r->>'total'<>'22'
    or jsonb_array_length(r->'rows')<>20
    or r->'rows'->0->>'version'<>'22'
    or r->'rows'->0->>'revision'<>'1'
    or r->'rows'->0->>'isLatestSave'<>'true'
  then
    raise exception 'History ordering or revision distinction failed';
  end if;

  if jsonb_array_length(public.crm_quotation_history(q,1)->'rows')<>2 then
    raise exception 'History pagination failed';
  end if;

  if public.crm_quotation_snapshot(q,1)->'document'->>'title'<>'Original history title' then
    raise exception 'Original snapshot changed';
  end if;

  denied:=false;
  begin
    update crm_quotes.saves set document='{}' where quotation_id=q and version=1;
  exception when insufficient_privilege then
    denied:=true;
  end;
  if not denied then raise exception 'Saved evidence was overwritten';end if;

  denied:=false;
  begin
    update crm_quotes.revisions set created_by=b where quotation_id=q;
  exception when insufficient_privilege then
    denied:=true;
  end;
  if not denied then raise exception 'Revision provenance was overwritten';end if;

  denied:=false;
  begin
    perform public.crm_quotation_history(q,-1);
  exception when invalid_parameter_value then
    denied:=true;
  end;
  if not denied then raise exception 'Invalid history page accepted';end if;

  denied:=false;
  begin
    perform public.crm_quotation_snapshot(q,999);
  exception when insufficient_privilege then
    denied:=true;
  end;
  if not denied then raise exception 'Missing saved version accepted';end if;

  update crm_sales.leads set archived_at=now() where id=l;

  if public.crm_quotation_history(q,0)->>'total'<>'22' then
    raise exception 'Archived history disappeared';
  end if;

  update crm_sales.leads set archived_at=null where id=l;

  insert into history_fixture values(a,b,f,q);
end;
$$;

-- Temporary grants exercise the actual RLS policy; rollback removes these grants.
grant usage on schema crm_quotes to authenticated;
grant select on crm_quotes.revisions to authenticated;

set local role authenticated;

do $$
declare c history_fixture%rowtype; denied boolean;
begin
  select * into c from history_fixture;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',c.actor,'role','authenticated')::text,true
  );

  if public.crm_quotation_snapshot(c.quote,1)->>'version'<>'1'
    or (select count(*) from crm_quotes.revisions where quotation_id=c.quote)<>1
  then
    raise exception 'Owner history/RLS failed';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',c.other_actor,'role','authenticated')::text,true
  );

  denied:=false;
  begin
    perform public.crm_quotation_snapshot(c.quote,1);
  exception when insufficient_privilege then
    denied:=true;
  end;

  if not denied or exists(select 1 from crm_quotes.revisions) then
    raise exception 'Cross-owner history access';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',c.finance,'role','authenticated')::text,true
  );

  if public.crm_quotation_history(c.quote,0)->>'total'<>'22' then
    raise exception 'Authorized Finance history failed';
  end if;
end;
$$;

reset role;
set local role anon;

do $$
begin
  begin
    perform public.crm_quotation_history(gen_random_uuid(),0);
    raise exception 'Anonymous history accepted';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
set local role service_role;

do $$
begin
  begin
    perform public.crm_quotation_history(gen_random_uuid(),0);
    raise exception 'Service history accepted';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

select 'quotation history checks passed';

rollback;