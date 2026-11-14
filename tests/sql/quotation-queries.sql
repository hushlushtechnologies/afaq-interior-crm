\set ON_ERROR_STOP on
begin;
set local statement_timeout='45s';
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); f uuid:=gen_random_uuid();
  l uuid:=gen_random_uuid(); other_lead uuid:=gen_random_uuid(); q uuid; i integer;
  input jsonb; query jsonb; r jsonb; c jsonb; denied boolean;
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (a,'quote-query-'||a||'@example.test',now()),(b,'quote-query-'||b||'@example.test',now()),
    (f,'quote-query-'||f||'@example.test',now());
  insert into crm_access.user_roles(user_id,role_key) values(a,'sales_executive'),(b,'sales_executive'),(f,'finance_officer');
  insert into crm_sales.leads(id,customer_name,source_code,assigned_user_id,created_by) values
    (l,'Query customer A','manual',a,a),(other_lead,'Query customer B','manual',b,b);
  insert into crm_sales.detail_records(lead_id,id,kind,data,created_by,updated_by) values
    (l,gen_random_uuid(),'room','{"name":"Living room fixture","room_type":null,"sort_order":0,"requirements_notes":null,"measurement_notes":null,"deliverables_notes":null}',a,a),
    (l,l,'requirements','{"project_type":"Residential","property_type":null,"location_description":null,"style_preferences":"Minimalist fixture","material_preferences":null,"furniture_preferences":null,"color_preferences":null,"budget_estimate":null,"currency":"AED","desired_start_date":null,"desired_completion_date":null,"special_instructions":null,"completion_state":"in_progress"}',a,a);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  input:=jsonb_build_object('requestId',gen_random_uuid(),'quotationId',null,'expectedVersion',null,'leadId',l,
    'title','Query fixture','quotationDate','2026-11-13','validUntil',null,'companyVatNumber',null,
    'clientNotes',null,'internalNotes',null,'terms',null,'paymentTerms',null,'sections','[]'::jsonb,
    'pricing',jsonb_build_object('policyId','s18-exclusive-discount-before-tax-half-up-v1','currency','AED',
      'overallDiscount',jsonb_build_object('mode','none'),'items',jsonb_build_array(jsonb_build_object(
        'id',gen_random_uuid(),'sectionId',null,'description','Synthetic line','unit','custom','quantity','1','unitPrice','10',
        'discount',jsonb_build_object('mode','none'),'tax',jsonb_build_object('treatment','exempt')))));
  for i in 1..21 loop
    input:=input||jsonb_build_object('requestId',gen_random_uuid(),'title','Query fixture '||i);
    input:=jsonb_set(input,'{pricing,items,0,unitPrice}',to_jsonb((i*10)::text));
    r:=public.crm_save_quotation_draft(input);
    q:=(r->>'id')::uuid;
  end loop;
  query:='{"page":0,"search":"","sort":"amount","direction":"asc","owner":"all","status":"all","leadId":null}';
  r:=public.crm_quotation_page(query);
  if r->>'total'<>'21' or jsonb_array_length(r->'rows')<>20 or r->'rows'->0->>'amount'<>'10.00' then raise exception 'Pagination/decimal sort failed'; end if;
  r:=public.crm_quotation_page(query||'{"page":1}');
  if jsonb_array_length(r->'rows')<>1 or r->'rows'->0->>'amount'<>'210.00' then raise exception 'Second page failed'; end if;
  r:=public.crm_quotation_page(query||'{"direction":"desc"}');
  if r->'rows'->0->>'amount'<>'210.00' then raise exception 'Descending sort failed'; end if;
  r:=public.crm_quotation_page(query||'{"search":"Query fixture 21","status":"draft","owner":"mine"}');
  if r->>'total'<>'1' then raise exception 'Search/filter failed'; end if;
  if public.crm_quotation_page(query||'{"search":"%"}')->>'total'<>'0' then raise exception 'Search wildcard was not literal'; end if;
  if public.crm_quotation_page(query||'{"owner":"unassigned"}')->>'total'<>'0' then raise exception 'Unassigned filter failed'; end if;
  c:=public.crm_quotation_context(l,q);
  if c->>'canEdit'<>'true' or c->>'canCreate'<>'true' or c->>'canReadLead'<>'true' then raise exception 'Owner context failed'; end if;
  if jsonb_array_length(c->'rooms')<>1 or c->>'requirements' not like '%Minimalist fixture%' then raise exception 'Authorized room/requirements context missing'; end if;
  update crm_sales.leads set archived_at=now() where id=l;
  if public.crm_quotation_context(l,q)->>'canEdit'<>'false' then raise exception 'Archive edit gate failed'; end if;
  update crm_sales.leads set archived_at=null where id=l;
  denied:=false;
  begin perform public.crm_quotation_page(query||'{"sort":"amount;drop table"}'); exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Invalid sort accepted'; end if;
  denied:=false;
  begin perform public.crm_quotation_page(query||'{"page":-1}'); exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Invalid page accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
  if public.crm_quotation_page(query)->>'total'<>'0' then raise exception 'Cross-owner listing leaked'; end if;
  denied:=false;
  begin perform public.crm_quotation_context(l,q); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Cross-owner context leaked'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f,'role','authenticated')::text,true);
  if public.crm_quotation_page(query||jsonb_build_object('leadId',l))->>'total'<>'21' then raise exception 'Finance listing failed'; end if;
  c:=public.crm_quotation_context(null,q);
  if c->>'canReadLead'<>'false' or c->>'canEdit'<>'false' or c->'rooms'<>'[]'::jsonb or c->'requirements'<>'null'::jsonb then raise exception 'Finance received lead context'; end if;
end;
$$;
select 'quotation query checks passed';
rollback;