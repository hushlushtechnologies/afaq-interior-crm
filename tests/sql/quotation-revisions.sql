\set ON_ERROR_STOP on
begin;

set local statement_timeout='45s';

create temporary table revision_fixture(
  actor uuid,
  other_actor uuid,
  finance uuid,
  quote uuid,
  payload jsonb
);

grant select on revision_fixture to authenticated;

do $$
declare
  a uuid:=gen_random_uuid();
  b uuid:=gen_random_uuid();
  f uuid:=gen_random_uuid();
  l uuid:=gen_random_uuid();
  q uuid;
  p jsonb;
  command jsonb;
  r jsonb;
  denied boolean;
begin
  insert into auth.users(id,email,email_confirmed_at)
  values
    (a,'s19-rev-'||a||'@example.test',now()),
    (b,'s19-rev-'||b||'@example.test',now()),
    (f,'s19-rev-'||f||'@example.test',now());

  insert into crm_access.user_roles(user_id,role_key)
  values
    (a,'sales_executive'),
    (b,'sales_executive'),
    (f,'finance_officer');

  insert into crm_sales.leads(
    id,customer_name,source_code,assigned_user_id,created_by
  )
  values(l,'Revision SQL fixture','manual',a,a);

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',a,'role','authenticated')::text,
    true
  );

  p:=jsonb_build_object(
    'requestId',gen_random_uuid(),
    'quotationId',null,
    'expectedVersion',null,
    'leadId',l,
    'title','Original revision title',
    'quotationDate','2026-11-14',
    'validUntil',null,
    'companyVatNumber',null,
    'clientNotes',null,
    'internalNotes',null,
    'terms',null,
    'paymentTerms',null,
    'sections','[]'::jsonb,
    'pricing','{"policyId":"s18-exclusive-discount-before-tax-half-up-v1","currency":"AED","items":[],"overallDiscount":{"mode":"none"}}'::jsonb
  );

  q:=(public.crm_save_quotation_draft(p)->>'id')::uuid;

  command:=jsonb_build_object(
    'requestId',gen_random_uuid(),
    'quotationId',q,
    'expectedVersion',1,
    'expectedRevision',1,
    'reason','Client requested another scope'
  );

  r:=public.crm_create_quotation_revision(command);

  if r->>'revision'<>'2'
    or r->>'version'<>'2'
    or r->>'replayed'<>'false' then
    raise exception 'Revision creation failed';
  end if;

  if not exists(
    select 1 from crm_quotes.revisions
    where quotation_id=q
      and revision=2
      and previous_revision=1
      and created_by=a
      and reason='Client requested another scope'
  ) then
    raise exception 'Revision provenance missing';
  end if;

  r:=public.crm_save_quotation_draft(
    p||jsonb_build_object(
      'requestId',gen_random_uuid(),
      'quotationId',q,
      'expectedVersion',2,
      'title','Revision two edited'
    )
  );

  if r->>'revision'<>'2' or r->>'version'<>'3' then
    raise exception 'Revision two editing failed';
  end if;

  if public.crm_quotation_snapshot(q,1)->'document'->>'title'<>'Original revision title'
    or public.crm_quotation_snapshot(q,1)->>'revision'<>'1'
    or public.crm_quotation_snapshot(q,2)->'document'->>'title'<>'Original revision title'
    or public.crm_quotation_snapshot(q,2)->>'revision'<>'2' then
    raise exception 'Prior evidence changed';
  end if;

  r:=public.crm_create_quotation_revision(command);

  if r->>'replayed'<>'true'
    or r->>'version'<>'2'
    or (select count(*) from crm_quotes.saves where quotation_id=q)<>3
    or public.crm_get_quotation(q)->>'version'<>'3' then
    raise exception 'Retry changed current evidence';
  end if;

  denied:=false;
  begin
    perform public.crm_create_quotation_revision(
      command||'{"reason":"Changed request"}'::jsonb
    );
  exception when invalid_parameter_value then
    denied:=true;
  end;
  if not denied then raise exception 'Changed retry accepted';end if;

  denied:=false;
  begin
    perform public.crm_create_quotation_revision(
      command||jsonb_build_object('requestId',gen_random_uuid())
    );
  exception when serialization_failure then
    denied:=true;
  end;
  if not denied then raise exception 'Stale revision accepted';end if;

  denied:=false;
  begin
    perform public.crm_create_quotation_revision(
      command||jsonb_build_object(
        'requestId',gen_random_uuid(),
        'expectedVersion',3,
        'expectedRevision',1
      )
    );
  exception when serialization_failure then
    denied:=true;
  end;
  if not denied then raise exception 'Wrong expected revision accepted';end if;

  denied:=false;
  begin
    perform public.crm_create_quotation_revision(
      command||jsonb_build_object(
        'requestId',gen_random_uuid(),
        'reason',' '
      )
    );
  exception when invalid_parameter_value then
    denied:=true;
  end;
  if not denied then raise exception 'Blank reason accepted';end if;

  denied:=false;
  begin
    perform public.crm_create_quotation_revision(
      command||jsonb_build_object('requestId',p->'requestId')
    );
  exception when invalid_parameter_value then
    denied:=true;
  end;
  if not denied then raise exception 'Draft request ID collision accepted';end if;

  denied:=false;
  begin
    perform public.crm_save_quotation_draft(
      p||jsonb_build_object(
        'requestId',command->'requestId',
        'quotationId',q,
        'expectedVersion',3
      )
    );
  exception when invalid_parameter_value then
    denied:=true;
  end;
  if not denied then raise exception 'Revision request ID collision accepted';end if;

  update crm_sales.leads set archived_at=now() where id=l;

  denied:=false;
  begin
    perform public.crm_create_quotation_revision(command);
  exception when invalid_parameter_value then
    denied:=true;
  end;
  if not denied then raise exception 'Archived lead revision accepted';end if;

  update crm_sales.leads set archived_at=null where id=l;

  insert into revision_fixture
  values(
    a,b,f,q,
    command||jsonb_build_object(
      'requestId',gen_random_uuid(),
      'expectedVersion',3,
      'expectedRevision',2,
      'reason','Next planned revision'
    )
  );
end;
$$;

set local role authenticated;

do $$
declare
  c revision_fixture%rowtype;
  denied boolean;
  r jsonb;
begin
  select * into c from revision_fixture;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',c.other_actor,'role','authenticated')::text,
    true
  );

  denied:=false;
  begin
    perform public.crm_create_quotation_revision(c.payload);
  exception when insufficient_privilege then
    denied:=true;
  end;
  if not denied then raise exception 'Cross-owner revision accepted';end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',c.finance,'role','authenticated')::text,
    true
  );

  if public.crm_get_quotation(c.quote)->>'revision'<>'2' then
    raise exception 'Finance read failed';
  end if;

  denied:=false;
  begin
    perform public.crm_create_quotation_revision(c.payload);
  exception when insufficient_privilege then
    denied:=true;
  end;
  if not denied then raise exception 'Finance revision write accepted';end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',c.actor,'role','authenticated')::text,
    true
  );

  r:=public.crm_create_quotation_revision(c.payload);

  if r->>'revision'<>'3' or r->>'version'<>'4' then
    raise exception 'Authenticated owner revision failed';
  end if;
end;
$$;

reset role;
set local role anon;

do $$
begin
  begin
    perform public.crm_create_quotation_revision('{}'::jsonb);
    raise exception 'Anonymous revision accepted';
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
    perform public.crm_create_quotation_revision('{}'::jsonb);
    raise exception 'Service revision accepted';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

select 'quotation revision checks passed';

rollback;