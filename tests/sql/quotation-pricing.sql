-- Dedicated local database only. All temporary test objects are rolled back.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='45s';

create function pg_temp.check_quote(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'Quotation check failed: %',p_label; end if;
end;
$$;
create function pg_temp.reject_quote(p_input jsonb)
returns boolean language plpgsql as $$
begin
  perform crm_quotes.calculate(p_input);
  return false;
exception when invalid_parameter_value then return true;
end;
$$;

do $$
declare
  item jsonb := '{"id":"00000000-0000-4000-8000-000000000001","sectionId":null,"description":"Synthetic work","unit":"m²","quantity":"1","unitPrice":"100","discount":{"mode":"none"},"tax":{"treatment":"exempt"}}';
  p jsonb; q jsonb; r jsonb; x jsonb;
begin
  p := jsonb_build_object('policyId','s18-exclusive-discount-before-tax-half-up-v1',
    'currency','AED','items',jsonb_build_array(item),'overallDiscount',jsonb_build_object('mode','none'));
  q := jsonb_set(p,'{items,0,discount}','{"mode":"fixed","amount":"10"}');
  q := jsonb_set(q,'{items,0,tax}','{"treatment":"taxable","rate":"5"}');
  q := jsonb_set(q,'{overallDiscount}','{"mode":"percent","rate":"10"}');
  r := crm_quotes.calculate(q);
  perform pg_temp.check_quote(r->'totals' = '{"subtotal":"100.00","lineDiscount":"10.00","netSubtotal":"90.00","overallDiscount":"9.00","discount":"19.00","net":"81.00","tax":"4.05","grandTotal":"85.05"}', 'discounts before VAT');
  perform pg_temp.check_quote(r->'lines'->0->>'taxRate'='5.000000','exact tax text');

  q := jsonb_set(p,'{items,0,unitPrice}','"0.005000"');
  perform pg_temp.check_quote(crm_quotes.calculate(q)->'totals'->>'grandTotal'='0.01','half-up half cent');
  q := jsonb_set(p,'{items,0,quantity}','"1.5"');
  q := jsonb_set(q,'{items,0,unitPrice}','"19.995000"');
  perform pg_temp.check_quote(crm_quotes.calculate(q)->'totals'->>'grandTotal'='29.99','fractional quantity');

  q := jsonb_set(p,'{items,0,quantity}','"90071992547.4099"');
  q := jsonb_set(q,'{items,0,unitPrice}','"100000"');
  perform pg_temp.check_quote(crm_quotes.calculate(q)->'totals'->>'grandTotal'='9007199254740990.00','beyond binary safe integer');
  q := jsonb_set(p,'{items,0,quantity}','"99999999999999"');
  q := jsonb_set(q,'{items,0,unitPrice}','"999999999999"');
  perform pg_temp.check_quote(pg_temp.reject_quote(q),'line overflow');
  q := jsonb_set(p,'{items,0,quantity}','"90071992547"');
  q := jsonb_set(q,'{items,0,unitPrice}','"100000"');
  q := jsonb_set(q,'{items,0,tax}','{"treatment":"taxable","rate":"100"}');
  perform pg_temp.check_quote(pg_temp.reject_quote(q),'total overflow after tax');

  q := jsonb_set(p,'{items}','[]');
  perform pg_temp.check_quote(crm_quotes.calculate(q)->'totals'->>'grandTotal'='0.00','empty draft');
  q := jsonb_set(p,'{items,0,unitPrice}','"0"');
  perform pg_temp.check_quote(crm_quotes.calculate(q)->'totals'->>'tax'='0.00','zero price');
  q := jsonb_set(p,'{overallDiscount}','{"mode":"percent","rate":"100"}');
  perform pg_temp.check_quote(crm_quotes.calculate(q)->'totals'->>'net'='0.00','full discount');

  q := jsonb_set(p,'{items}',jsonb_build_array(
    item||'{"unitPrice":"0.10","tax":{"treatment":"taxable","rate":"5"}}',
    item||'{"id":"00000000-0000-4000-8000-000000000002","unitPrice":"0.10"}',
    item||'{"id":"00000000-0000-4000-8000-000000000003","unitPrice":"0.10"}'));
  q := jsonb_set(q,'{overallDiscount}','{"mode":"fixed","amount":"0.01"}');
  r := crm_quotes.calculate(q);
  perform pg_temp.check_quote(r->'lines'->0->>'overallDiscount'='0.01','stable ID tie allocation');
  perform pg_temp.check_quote(r->'totals'->>'grandTotal'='0.29','allocation before tax');
  x := jsonb_set(q,'{items}',jsonb_build_array(q->'items'->2,q->'items'->0,q->'items'->1));
  perform pg_temp.check_quote(crm_quotes.calculate(x)->'totals'=r->'totals','reorder keeps totals');
  perform pg_temp.check_quote(crm_quotes.calculate(x)->'lines'->1=r->'lines'->0,'reorder keeps line allocation');

  perform pg_temp.check_quote(pg_temp.reject_quote(p||'{"totals":{}}'),'reject submitted totals');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{currency}','"USD"')),'unsupported currency');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{policyId}','"unknown"')),'unsupported policy');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items,0,quantity}','"0"')),'zero quantity');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items,0,quantity}','1')),'JSON number rejected');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items,0,unitPrice}','"-1"')),'negative price');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items,0,quantity}','"1.00001"')),'precision limit');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items,0,quantity}',to_jsonb(E'1\n'::text))),'trailing newline');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items,0,tax}','null')),'explicit tax required');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items,0,tax}','{"treatment":"taxable","rate":"0"}')),'zero taxable rate');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items,0,tax}','{"treatment":"taxable","rate":"101"}')),'tax rate upper bound');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items,0,tax}','{"treatment":"exempt","rate":"5"}')),'contradictory tax');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{overallDiscount}','{"mode":"percent","rate":"101"}')),'discount rate upper bound');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{overallDiscount}','{"mode":"fixed","amount":"100.01"}')),'overall discount over base');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items,0,discount}','{"mode":"fixed","amount":"100.01"}')),'line discount over base');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items}',jsonb_build_array(item,item))),'duplicate IDs');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items,0,id}','"bad-id"')),'invalid UUID');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items,0,sectionId}','1')),'invalid section UUID');
  perform pg_temp.check_quote(pg_temp.reject_quote(jsonb_set(p,'{items}',(select jsonb_agg(item) from generate_series(1,201)))),'item count limit');
  perform pg_temp.check_quote(pg_temp.reject_quote(null),'SQL null input');

  perform pg_temp.check_quote(not exists (
    select 1 from pg_proc f join pg_namespace n on n.oid=f.pronamespace
    cross join (values('anon'),('authenticated'),('service_role')) roles(name)
    where n.nspname='crm_quotes' and has_function_privilege(roles.name,f.oid,'execute')
  ),'no direct function execution grants');
  perform pg_temp.check_quote(not has_schema_privilege('anon','crm_quotes','USAGE')
    and not has_schema_privilege('authenticated','crm_quotes','USAGE')
    and not has_schema_privilege('service_role','crm_quotes','USAGE'),'private schema');
end;
$$;

-- Test actual database roles, rather than merely changing JWT claims as postgres.
set local role anon;
do $$ begin
  begin
    perform crm_quotes.calculate('{}');
    raise exception 'Anonymous calculation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end; $$;
reset role;
set local role authenticated;
do $$ begin
  begin
    perform crm_quotes.calculate('{}');
    raise exception 'Authenticated direct calculation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end; $$;
reset role;
set local role service_role;
do $$ begin
  begin
    perform crm_quotes.calculate('{}');
    raise exception 'Service-role direct calculation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end; $$;
reset role;
select 'quotation SQL checks passed';
rollback;