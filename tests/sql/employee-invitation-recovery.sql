-- Dedicated local fixtures only. Every write is rolled back.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '5s';
DO $$
declare
  actor uuid := gen_random_uuid(); other_actor uuid := gen_random_uuid();
  target uuid := gen_random_uuid(); req uuid := gen_random_uuid();
  email text := 's11-recovery-' || gen_random_uuid()::text || '@example.test';
  invite uuid; first_result jsonb; retry_result jsonb; rejected boolean;
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (actor,'s11-admin-'||actor||'@example.test',now()),
    (other_actor,'s11-admin-'||other_actor||'@example.test',now());
  insert into crm_access.user_roles(user_id,role_key) values(actor,'super_admin'),(other_actor,'super_admin');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  first_result := public.crm_request_employee_invitation(gen_random_uuid(),'Recovery Fixture',email);
  invite := (first_result->>'invitationId')::uuid;
  first_result := public.crm_claim_local_employee_invitation(invite);
  insert into auth.users(id,email,invited_at) values(target,email,now());
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform public.crm_reconcile_local_employee_invitation(invite,(first_result->>'attemptId')::uuid,true);
  update crm_employees.invitations set delivery_started_at=now()-interval '2 minutes' where id=invite;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  rejected := false;
  begin perform public.crm_prepare_local_invitation_recovery(invite,req,false);
  exception when invalid_parameter_value then rejected := true; end;
  if not rejected then raise exception 'Missing review was accepted'; end if;
  first_result := public.crm_prepare_local_invitation_recovery(invite,req,true);
  if first_result->>'status'<>'send' or first_result->>'kind'<>'invite' then raise exception 'Expected invite replacement'; end if;
  retry_result := public.crm_prepare_local_invitation_recovery(invite,req,true);
  if retry_result->>'status'<>'busy' then raise exception 'Fresh attempt was repeated'; end if;
  update crm_employees.invitations set delivery_started_at=now()-interval '2 minutes' where id=invite;
  retry_result := public.crm_prepare_local_invitation_recovery(invite,req,true);
  if retry_result->>'status'<>'check' or retry_result->>'attemptId'<>first_result->>'attemptId' then raise exception 'Retry did not preserve attempt'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_actor,'role','authenticated')::text,true);
  rejected := false;
  begin perform public.crm_prepare_local_invitation_recovery(invite,req,true);
  exception when invalid_parameter_value then rejected := true; end;
  if not rejected then raise exception 'Cross-actor receipt was accepted'; end if;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform public.crm_reconcile_local_employee_invitation(invite,(first_result->>'attemptId')::uuid,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  retry_result := public.crm_prepare_local_invitation_recovery(invite,req,true);
  if retry_result->>'status'<>'delivered' then raise exception 'Completed receipt did not replay'; end if;
  if (select auth_user_id from crm_employees.invitations where id=invite)<>target then raise exception 'Identity was changed'; end if;
  update auth.users set email_confirmed_at=now() where id=target;
  update crm_employees.invitations set delivery_started_at=now()-interval '2 minutes' where id=invite;
  first_result := public.crm_prepare_local_invitation_recovery(invite,gen_random_uuid(),true);
  if first_result->>'kind'<>'recovery' then raise exception 'Verified identity did not use recovery'; end if;
  if (select count(*) from crm_employees.invitation_events where invitation_id=invite and event='replacement_authorized_after_review' and actor_id=actor)<>2 then raise exception 'Audit actor or event count incorrect'; end if;
  if jsonb_array_length(public.crm_find_local_invitation(email)->'events')<4 then raise exception 'Lifecycle history missing'; end if;
  if exists(select 1 from crm_access.user_roles where user_id=target) then raise exception 'Recovery assigned roles'; end if;
  -- A changed Auth email must never redirect a bound invitation to a new identity.
  update auth.users set email='moved-'||auth.users.email where id=target;
  insert into auth.users(id,email,invited_at) values(gen_random_uuid(),email,now());
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform public.crm_reconcile_local_employee_invitation(invite,(first_result->>'attemptId')::uuid,true);
  if (select auth_user_id from crm_employees.invitations where id=invite)<>target or
     (select status from crm_employees.invitations where id=invite)<>'delivery_uncertain' then
    raise exception 'Reconciliation reassigned the bound identity';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  update crm_employees.invitations set status='accepted',accepted_at=now() where id=invite;
  retry_result := public.crm_prepare_local_invitation_recovery(invite,gen_random_uuid(),true);
  if retry_result->>'status'<>'accepted' then raise exception 'Accepted invitation was resent'; end if;
  first_result := public.crm_request_employee_invitation(gen_random_uuid(),'Unrelated Identity Fixture','other-'||email);
  invite := (first_result->>'invitationId')::uuid;
  perform public.crm_claim_local_employee_invitation(invite);
  update crm_employees.invitations set status='delivery_uncertain',delivery_started_at=now()-interval '2 minutes' where id=invite;
  insert into auth.users(id,email,invited_at) values(gen_random_uuid(),'other-'||email,now()-interval '1 day');
  rejected := false;
  begin perform public.crm_prepare_local_invitation_recovery(invite,gen_random_uuid(),true);
  exception when invalid_parameter_value then rejected := true; end;
  if not rejected then raise exception 'Unrelated Auth identity was recovered'; end if;
  delete from crm_access.user_roles where user_id=actor;
  rejected := false;
  begin perform public.crm_find_local_invitation(email);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Revoked actor read history'; end if;
  rejected := false;
  begin perform public.crm_prepare_local_invitation_recovery(invite,gen_random_uuid(),true);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Revoked actor recovered invitation'; end if;
  if has_table_privilege('authenticated','crm_employees.invitation_events','SELECT') or
     has_table_privilege('service_role','crm_employees.invitation_recovery_requests','INSERT') or
     has_function_privilege('anon','public.crm_find_local_invitation(text)','EXECUTE') or
     has_function_privilege('service_role','public.crm_prepare_local_invitation_recovery(uuid,uuid,boolean)','EXECUTE') then
    raise exception 'Direct or anonymous privileges leaked';
  end if;
end;
$$;
ROLLBACK;
