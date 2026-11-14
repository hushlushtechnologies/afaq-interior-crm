\set ON_ERROR_STOP on
begin;
set local statement_timeout='45s';
create function pg_temp.qcheck(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'Quotation check failed: %',label; end if; end;
$$;
create function pg_temp.qreject(input jsonb,expected text) returns boolean language plpgsql as $$
begin
  perform public.crm_save_quotation_draft(input); return false;
exception when others then
  if sqlstate=expected then return true; end if; raise;
end;
$$;
create temporary table quote_fixture(actor uuid,other_actor uuid,finance uuid,payload jsonb,id uuid);
grant select on quote_fixture to authenticated;
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); f uuid:=gen_random_uuid();
  l uuid:=gen_random_uuid(); other_lead uuid:=gen_random_uuid(); room uuid:=gen_random_uuid();
  p jsonb; edit jsonb; r jsonb; replay jsonb; q uuid; rejected boolean; bad jsonb;
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (a,'quote-'||a||'@example.test',now()),(b,'quote-'||b||'@example.test',now()),
    (f,'quote-'||f||'@example.test',now());
  insert into crm_access.user_roles(user_id,role_key) values
    (a,'sales_executive'),(b,'sales_executive'),(f,'finance_officer');
  insert into crm_sales.leads(id,customer_name,source_code,assigned_user_id,created_by) values
    (l,'Synthetic quote customer','manual',a,a),(other_lead,'Other fixture','manual',b,b);
  insert into crm_sales.detail_records(lead_id,id,kind,data,created_by,updated_by) values
    (other_lead,room,'room','{"name":"Other room","room_type":null,"sort_order":0,"requirements_notes":null,"measurement_notes":null,"deliverables_notes":null}',b,b);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  p:=jsonb_build_object('requestId',gen_random_uuid(),'quotationId',null,'expectedVersion',null,'leadId',l,
    'title','Synthetic quotation','quotationDate','2026-11-13','validUntil',null,
    'companyVatNumber','001234567890123','clientNotes',null,'internalNotes',null,'terms',null,'paymentTerms',null,
    'sections','[]'::jsonb,'pricing',jsonb_build_object('policyId','s18-exclusive-discount-before-tax-half-up-v1',
      'currency','AED','overallDiscount',jsonb_build_object('mode','none'),'items',jsonb_build_array(jsonb_build_object(
        'id',gen_random_uuid(),'sectionId',null,'description','Synthetic work','unit','m²','quantity','1','unitPrice','100',
        'discount',jsonb_build_object('mode','none'),'tax',jsonb_build_object('treatment','taxable','rate','5')))));
  r:=public.crm_save_quotation_draft(p); q:=(r->>'id')::uuid;
  perform pg_temp.qcheck(r->>'version'='1' and r->>'replayed'='false','create');
  perform pg_temp.qcheck(r->>'number' ~ '^AFAQ-Q-[0-9]{4}-[0-9]{6,12}$','number');
  perform pg_temp.qcheck(r->'calculation'->'totals'->>'grandTotal'='105.00','authoritative total');
  replay:=public.crm_save_quotation_draft(p);
  perform pg_temp.qcheck(replay=r||'{"replayed":true}','create replay');
  perform pg_temp.qcheck((select count(*)=1 from crm_quotes.requests where actor_id=a),'one receipt');
  perform pg_temp.qcheck(pg_temp.qreject(p||'{"title":"Changed retry"}','22023'),'request collision');
  edit:=p||jsonb_build_object('requestId',gen_random_uuid(),'quotationId',q,'expectedVersion',1);
  edit:=jsonb_set(edit,'{pricing,items,0,quantity}','"2"');
  r:=public.crm_save_quotation_draft(edit);
  perform pg_temp.qcheck(r->>'version'='2' and r->'calculation'->'totals'->>'grandTotal'='210.00','edit');
  perform pg_temp.qcheck(public.crm_save_quotation_draft(edit)=r||'{"replayed":true}','edit replay');
  perform pg_temp.qcheck(public.crm_save_quotation_draft(p)->>'version'='1','original replay result retained');
  perform pg_temp.qcheck(pg_temp.qreject(edit||jsonb_build_object('requestId',gen_random_uuid()),'40001'),'stale version');
  perform pg_temp.qcheck((select count(*)=2 from crm_quotes.saves where quotation_id=q),'save history');
  perform pg_temp.qcheck((select document->'pricing'->'items'->0->>'quantity'='1' from crm_quotes.saves where quotation_id=q and version=1),'old item retained');
  perform pg_temp.qcheck(public.crm_get_quotation(q)->'document'->>'companyVatNumber'='001234567890123','manual VAT preserves zeros');
  perform pg_temp.qcheck((select qualification_status='unreviewed' and stage='new' from crm_sales.leads where id=l),'lead unchanged');

  for bad in select value from jsonb_array_elements(jsonb_build_array(
    p||'{"approved":true}',p||'{"calculation":{}}',p-'title',
    jsonb_set(p,'{quotationDate}','"2026-02-30"'),
    jsonb_set(p,'{validUntil}','"2026-01-01"'),
    jsonb_set(p,'{pricing,overallDiscount}','{"mode":"fixed","amount":"100.01"}'),
    jsonb_set(p,'{pricing,items,0,sectionId}',to_jsonb(gen_random_uuid())),
    jsonb_set(p,'{sections}',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','Cross-lead room','roomId',room)))
  )) loop
    bad:=bad||jsonb_build_object('requestId',gen_random_uuid());
    perform pg_temp.qcheck(pg_temp.qreject(bad,'22023'),'invalid draft rejected');
  end loop;
  perform pg_temp.qcheck(pg_temp.qreject(p||jsonb_build_object('requestId',gen_random_uuid(),'leadId',other_lead),'42501'),'cross-lead create');
  update crm_sales.leads set archived_at=now() where id=l;
  perform pg_temp.qcheck(pg_temp.qreject(p||jsonb_build_object('requestId',gen_random_uuid()),'22023'),'archived lead');
  update crm_sales.leads set archived_at=null,assigned_user_id=b where id=l;
  perform pg_temp.qcheck(not public.crm_can_view_quotation(q),'old owner loses access');
  perform pg_temp.qcheck(pg_temp.qreject(p,'42501'),'revoked retry rejected');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
  perform pg_temp.qcheck(public.crm_get_quotation(q)->>'id'=q::text,'new owner access');
  update crm_sales.leads set assigned_user_id=a where id=l;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  update auth.users set banned_until=now()+interval '1 day' where id=a;
  perform pg_temp.qcheck(not public.crm_can_view_quotation(q),'inactive user denied');
  perform pg_temp.qcheck(pg_temp.qreject(p,'42501'),'inactive retry denied');
  update auth.users set banned_until=null where id=a;
  perform public.crm_transition_lead(gen_random_uuid(),l,(select version from crm_sales.leads where id=l),
    'lose','{"reasonCode":"postponed","explanation":null,"note":null}');
  perform pg_temp.qcheck(pg_temp.qreject(p||jsonb_build_object('requestId',gen_random_uuid()),'22023'),'Lost lead cannot create draft');
  perform pg_temp.qcheck(public.crm_get_quotation(q)->>'id'=q::text,'Lost quotation history remains readable');
  perform public.crm_transition_lead(gen_random_uuid(),l,(select version from crm_sales.leads where id=l),
    'reopen','{"reason":"Local fixture reopening"}');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f,'role','authenticated')::text,true);
  perform pg_temp.qcheck(public.crm_get_quotation(q)->>'id'=q::text,'finance quotation view');
  perform pg_temp.qcheck(public.crm_has_permission('leads.view') is not true,'finance gains no lead permission');
  perform pg_temp.qcheck(pg_temp.qreject(p,'42501'),'finance create denied');
  perform pg_temp.qcheck((select count(*)=1 from crm_quotes.quotations where lead_id=l),'no partial or duplicate records');
  insert into quote_fixture values(a,b,f,edit||jsonb_build_object('requestId',gen_random_uuid(),'expectedVersion',2),q);
end;
$$;

-- Temporarily grant reads only to exercise RLS as a real application role.
-- These grants are rolled back and are not part of the migration.
grant usage on schema crm_quotes to authenticated;
grant select on crm_quotes.quotations,crm_quotes.drafts,crm_quotes.saves to authenticated;
set local role authenticated;
do $$
declare c quote_fixture%rowtype; r jsonb; denied boolean;
begin
  select * into c from quote_fixture;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c.actor,'role','authenticated')::text,true);
  r:=public.crm_save_quotation_draft(c.payload);
  if r->>'version'<>'3' then raise exception 'Actual authenticated save failed'; end if;
  if (select count(*) from crm_quotes.quotations)<>1 or (select count(*) from crm_quotes.saves)<>3 then
    raise exception 'Owner RLS failed'; end if;
  denied:=false;
  begin update crm_quotes.drafts set version=100 where quotation_id=c.id;
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Direct draft write accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c.other_actor,'role','authenticated')::text,true);
  if exists(select 1 from crm_quotes.quotations) or exists(select 1 from crm_quotes.drafts)
     or exists(select 1 from crm_quotes.saves) then raise exception 'Cross-owner RLS failed'; end if;
  denied:=false;
  begin perform public.crm_get_quotation(c.id);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Cross-owner RPC accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c.finance,'role','authenticated')::text,true);
  if not exists(select 1 from crm_quotes.quotations where id=c.id) then raise exception 'Finance RLS failed'; end if;
end;
$$;
reset role;
set local role anon;
do $$ begin
  begin perform public.crm_save_quotation_draft('{}'); raise exception 'Anonymous save accepted';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
set local role service_role;
do $$ begin
  begin perform public.crm_save_quotation_draft('{}'); raise exception 'Service-role save accepted';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
select 'quotation draft checks passed';
rollback;