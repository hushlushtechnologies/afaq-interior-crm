-- Add an explicit PL/pgSQL label for qualified local variable references.
-- Keep the already-applied local migration intact; preserve function ACLs/body.
begin;
do $$
declare
  definition text:=pg_get_functiondef('public.crm_save_quotation_draft(jsonb)'::regprocedure);
  original text:=E'\ndeclare\n  actor uuid:=auth.uid();';
  repaired text:=E'\n<<crm_save_quotation_draft>>\ndeclare\n  actor uuid:=auth.uid();';
begin
  if position(original in definition)=0 then
    raise exception 'Unexpected quotation function definition; review before repairing.';
  end if;
  execute replace(definition,original,repaired);
end;
$$;
notify pgrst,'reload schema';
commit;