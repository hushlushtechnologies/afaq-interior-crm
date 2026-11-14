-- Private arithmetic only. No business writes, public RPCs or tax defaults.
begin;
create schema crm_quotes;
revoke all on schema crm_quotes from public, anon, authenticated, service_role;
alter default privileges in schema crm_quotes
  revoke execute on functions from public, anon, authenticated, service_role;

create function crm_quotes.exact_keys(p_value jsonb, p_keys text[])
returns void language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p_value) is distinct from 'object' then
    raise exception using errcode='22023', message='Expected an object.';
  end if;
  if (select array_agg(k order by k) from jsonb_object_keys(p_value) k)
     is distinct from (select array_agg(k order by k) from unnest(p_keys) k) then
    raise exception using errcode='22023', message='Unexpected or missing fields.';
  end if;
end;
$$;

create function crm_quotes.decimal_value(p_value jsonb, p_digits integer, p_scale integer)
returns numeric language plpgsql immutable set search_path = '' as $$
declare v text;
begin
  if p_digits is null or p_digits not between 1 and 16
     or p_scale is null or p_scale not between 1 and 6
     or jsonb_typeof(p_value) is distinct from 'string' then
    raise exception using errcode='22023', message='Expected an exact decimal string.';
  end if;
  v := p_value #>> '{}';
  if length(v)>p_digits+p_scale+1
     or v !~ ('^(0|[1-9][0-9]{0,'||(p_digits-1)||'})([.][0-9]{1,'||p_scale||'})?$')
     or v ~ '[[:space:]]' then
    raise exception using errcode='22023', message='Invalid decimal precision or value.';
  end if;
  return v::numeric;
end;
$$;

create function crm_quotes.discount_value(p_discount jsonb, p_base numeric)
returns numeric language plpgsql immutable set search_path = '' as $$
declare v numeric; r numeric;
begin
  case p_discount->>'mode'
    when 'none' then
      perform crm_quotes.exact_keys(p_discount,array['mode']);
      v := 0;
    when 'fixed' then
      perform crm_quotes.exact_keys(p_discount,array['mode','amount']);
      v := crm_quotes.decimal_value(p_discount->'amount',16,2);
    when 'percent' then
      perform crm_quotes.exact_keys(p_discount,array['mode','rate']);
      r := crm_quotes.decimal_value(p_discount->'rate',3,6);
      if r>100 then
        raise exception using errcode='22023', message='Discount rate exceeds 100.';
      end if;
      v := round(p_base*r/100,2);
    else
      raise exception using errcode='22023', message='Invalid discount mode.';
  end case;
  if v>p_base then
    raise exception using errcode='22023', message='Discount exceeds remaining subtotal.';
  end if;
  return v;
end;
$$;

create function crm_quotes.money_text(p_value numeric)
returns text language plpgsql immutable set search_path = '' as $$
begin
  if p_value is null or p_value<0 or p_value>9999999999999999.99
     or p_value<>round(p_value,2) then
    raise exception using errcode='22023', message='Quotation money is out of range.';
  end if;
  return p_value::numeric(18,2)::text;
end;
$$;

create function crm_quotes.calculate(p_input jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  item jsonb; d jsonb; t jsonb; item_id text; section_id text;
  ids text[] := array[]::text[];
  gross numeric; line_discount numeric; rate numeric; net numeric; tax numeric;
  subtotal numeric := 0; discounts numeric := 0; base numeric := 0;
  overall numeric; net_total numeric := 0; tax_total numeric := 0;
  allocations numeric[] := array[]::numeric[];
  shares numeric[] := array[]::numeric[];
  remainders numeric[] := array[]::numeric[];
  work jsonb := '[]'; result jsonb := '[]';
  leftover integer; i integer; best integer; count_items integer;
  uuid_pattern constant text := '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$';
begin
  perform crm_quotes.exact_keys(p_input,array['policyId','currency','items','overallDiscount']);
  if p_input->>'policyId' is distinct from 's18-exclusive-discount-before-tax-half-up-v1'
     or p_input->>'currency' is distinct from 'AED'
     or jsonb_typeof(p_input->'items') is distinct from 'array' then
    raise exception using errcode='22023', message='Unsupported pricing policy, currency or items.';
  end if;
  count_items := jsonb_array_length(p_input->'items');
  if count_items>200 then
    raise exception using errcode='22023', message='Maximum 200 items.';
  end if;
  for item in select value from jsonb_array_elements(p_input->'items') loop
    perform crm_quotes.exact_keys(item,array['id','sectionId','description','unit','quantity','unitPrice','discount','tax']);
    item_id := lower(item->>'id');
    section_id := lower(item->>'sectionId');
    if jsonb_typeof(item->'id') is distinct from 'string'
       or item_id !~ uuid_pattern or item_id=any(ids)
       or (item->'sectionId'<>'null'::jsonb and
         (jsonb_typeof(item->'sectionId') is distinct from 'string' or section_id !~ uuid_pattern))
       or jsonb_typeof(item->'description') is distinct from 'string'
       or length(btrim(item->>'description')) not between 1 and 2000
       or jsonb_typeof(item->'unit') is distinct from 'string'
       or length(btrim(item->>'unit')) not between 1 and 40 then
      raise exception using errcode='22023', message='Invalid item identity, section, description or unit.';
    end if;
    ids := array_append(ids,item_id);
    net := crm_quotes.decimal_value(item->'quantity',14,4);
    if net=0 then
      raise exception using errcode='22023', message='Quantity must be positive.';
    end if;
    gross := round(net*crm_quotes.decimal_value(item->'unitPrice',12,6),2);
    perform crm_quotes.money_text(gross);
    line_discount := crm_quotes.discount_value(item->'discount',gross);
    net := gross-line_discount;
    t := item->'tax';
    case t->>'treatment'
      when 'taxable' then
        perform crm_quotes.exact_keys(t,array['treatment','rate']);
        rate := crm_quotes.decimal_value(t->'rate',3,6);
        if rate<=0 or rate>100 then
          raise exception using errcode='22023', message='Tax rate must be positive and at most 100.';
        end if;
      when 'zero_rated', 'exempt' then
        perform crm_quotes.exact_keys(t,array['treatment']);
        rate := 0;
      else
        raise exception using errcode='22023', message='Explicit tax treatment is required.';
    end case;
    subtotal := subtotal+gross;
    discounts := discounts+line_discount;
    base := base+net;
    work := work||jsonb_build_array(jsonb_build_object(
      'id',item_id,'gross',gross,'discount',line_discount,'net',net,
      'rate',rate,'treatment',t->>'treatment'));
  end loop;
  perform crm_quotes.money_text(subtotal);
  perform crm_quotes.money_text(discounts);
  perform crm_quotes.money_text(base);
  overall := crm_quotes.discount_value(p_input->'overallDiscount',base);
  leftover := 0;
  for i in 1..count_items loop
    net := (work->(i-1)->>'net')::numeric;
    -- Work in integer cents. div() avoids finite-scale division near huge boundaries.
    allocations[i] := case when overall=0 then 0
      else div((overall*100)*(net*100),base*100) end;
    remainders[i] := case when overall=0 then 0
      else mod((overall*100)*(net*100),base*100) end;
    shares[i] := allocations[i];
  end loop;
  leftover := (overall*100-coalesce((select sum(v) from unnest(allocations) v),0))::integer;
  while leftover>0 loop
    best := null;
    for i in 1..count_items loop
      if best is null or remainders[i]>remainders[best]
         or (remainders[i]=remainders[best] and ids[i] collate "C"<ids[best] collate "C") then
        best := i;
      end if;
    end loop;
    if best is null or remainders[best]<0 then
      raise exception using errcode='22023', message='Discount allocation failed.';
    end if;
    shares[best] := shares[best]+1;
    remainders[best] := -1;
    leftover := leftover-1;
  end loop;
  for i in 1..count_items loop
    d := work->(i-1);
    net := (d->>'net')::numeric-shares[i]/100;
    rate := (d->>'rate')::numeric;
    tax := round(net*rate/100,2);
    net_total := net_total+net;
    tax_total := tax_total+tax;
    result := result||jsonb_build_array(jsonb_build_object(
      'id',d->>'id','subtotal',crm_quotes.money_text((d->>'gross')::numeric),
      'lineDiscount',crm_quotes.money_text((d->>'discount')::numeric),
      'overallDiscount',crm_quotes.money_text(shares[i]/100),
      'net',crm_quotes.money_text(net),'taxTreatment',d->>'treatment',
      'taxRate',rate::numeric(9,6)::text,'tax',crm_quotes.money_text(tax),
      'total',crm_quotes.money_text(net+tax)));
  end loop;
  if net_total<>base-overall then
    raise exception using errcode='22023', message='Quotation totals do not reconcile.';
  end if;
  return jsonb_build_object('currency','AED','policy',jsonb_build_object(
    'id','s18-exclusive-discount-before-tax-half-up-v1','priceBasis','exclusive',
    'rounding','half_up','moneyScale',2,'quantityScale',4,'unitPriceScale',6,
    'percentageScale',6,'discountOrder','line_then_overall_then_tax',
    'allocation','largest_remainder_stable_item_id'), 'lines',result,
    'totals',jsonb_build_object('subtotal',crm_quotes.money_text(subtotal),
      'lineDiscount',crm_quotes.money_text(discounts),'netSubtotal',crm_quotes.money_text(base),
      'overallDiscount',crm_quotes.money_text(overall),'discount',crm_quotes.money_text(discounts+overall),
      'net',crm_quotes.money_text(net_total),'tax',crm_quotes.money_text(tax_total),
      'grandTotal',crm_quotes.money_text(net_total+tax_total)));
end;
$$;

revoke all on all functions in schema crm_quotes from public, anon, authenticated, service_role;
comment on schema crm_quotes is 'Private quotation implementation; no direct API access.';
comment on function crm_quotes.calculate(jsonb) is
  'Exact arithmetic only; neither resource authorization nor approval of tax treatment/rates.';
commit;