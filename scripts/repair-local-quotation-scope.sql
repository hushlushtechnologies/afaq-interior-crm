-- Local compatibility repair for failed migration 20261113000500.
-- Adds the intended block label without depending on indentation or line endings.
begin;

set local client_min_messages='warning';

do $repair$
declare
  function_id oid:=to_regprocedure(
    'public.crm_save_quotation_draft(jsonb)'
  );

  body text;
  definition text;
  repaired_body text;
begin
  if function_id is null then
    raise exception
      'Draft function is missing. Migration 20261113000400 must be applied first.';
  end if;

  select p.prosrc into body
  from pg_proc p
  join pg_language l on l.oid=p.prolang
  where p.oid=function_id
    and l.lanname='plpgsql';

  if body is null then
    raise exception
      'Unexpected draft function language. Stop and review.';
  end if;

  if body ~* '^[[:space:]]*<<crm_save_quotation_draft>>[[:space:]]*declare[[:space:]]' then
    raise notice
      'The required quotation block label is already present.';
  else
    if body !~* '^[[:space:]]*declare[[:space:]]' then
      raise exception
        'Unexpected draft block structure. Stop and review.';
    end if;

    repaired_body:=regexp_replace(
      body,
      '^([[:space:]]*)declare([[:space:]])',
      E'\\1<<crm_save_quotation_draft>>\ndeclare\\2',
      'i'
    );

    definition:=pg_get_functiondef(function_id);

    if (
      length(definition)-length(replace(definition,body,''))
    )<>length(body) then
      raise exception
        'Could not uniquely locate the existing function body. Stop and review.';
    end if;

    execute replace(definition,body,repaired_body);
  end if;

  if not exists(
    select 1
    from pg_proc p
    where p.oid=function_id
      and p.prosrc ~* '^[[:space:]]*<<crm_save_quotation_draft>>[[:space:]]*declare[[:space:]]'
  ) then
    raise exception
      'Quotation scope label verification failed.';
  end if;
end;
$repair$;

notify pgrst,'reload schema';

commit;

select
  p.prosrc ~* '^[[:space:]]*<<crm_save_quotation_draft>>[[:space:]]*declare[[:space:]]'
from pg_proc p
where p.oid=to_regprocedure(
  'public.crm_save_quotation_draft(jsonb)'
);