-- Synthetic, rollback-only fixtures. Run against the dedicated local database.
\set ON_ERROR_STOP on
begin isolation level repeatable read;
set local statement_timeout='30s';
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 x uuid:=gen_random_uuid(); y uuid:=gen_random_uuid(); z uuid:=gen_random_uuid();
 r jsonb; base_tasks jsonb; denied boolean; stamp timestamptz:=statement_timestamp();
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (a,'s17-report-'||a||'@example.test',now()),
 (b,'s17-report-'||b||'@example.test',now()),
 (c,'s17-report-'||c||'@example.test',now());
 insert into crm_access.user_roles(user_id,role_key) values
 (a,'super_admin'),(b,'sales_executive'),(c,'sales_executive');
 insert into crm_sales.leads(id,customer_name,source_code,created_by,assigned_user_id,created_at,archived_at) values
 (x,'Report visible','manual',a,b,'2060-01-01 20:00:00+00',null),
 (y,'Report hidden','manual',a,c,'2060-01-02 19:59:59+00',null),
 (z,'Archived report','phone',b,b,'2060-01-02 20:00:00+00',stamp);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 -- Midnight Dubai boundaries, not UTC dates. Scoped visibility is also enforced.
 r:=public.crm_lead_report('2060-01-02','2060-01-02','report');
 if r->'leads'->>'total'<>'1' or r->'leads'->>'archived'<>'0'
 or r::text like '%Report hidden%' then raise exception 'Boundary or scope failed'; end if;
 r:=public.crm_lead_report('2060-01-03','2060-01-03','dashboard');
 if r->'leads'->>'total'<>'1' or r->'leads'->>'archived'<>'1' then raise exception 'Archive disappeared'; end if;
 -- Actual authenticated role, rather than only simulating claims as postgres.
 execute 'set local role authenticated';
 r:=public.crm_lead_report('2060-01-02','2060-01-03','report');
 execute 'reset role';
 if r->'leads'->>'total'<>'2' or jsonb_array_length(r->'owners')<>1
 or jsonb_array_length(r->'sources')<>2 then raise exception 'Authenticated aggregate wrong'; end if;
 -- Intersect report scope with lead scope; never use permission as a boolean only.
 update crm_access.role_permissions set scope_key='own'
 where role_key='sales_executive' and permission_key='reports.view';
 r:=public.crm_lead_report('2060-01-02','2060-01-03','report');
 if r->'leads'->>'total'<>'1' then raise exception 'Report scope widened'; end if;
 update crm_access.role_permissions set scope_key='assigned'
 where role_key='sales_executive' and permission_key='reports.view';
 -- Company viewers see all three, with reconciled stages/sources/owners/trend.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 r:=public.crm_lead_report('2060-01-01','2060-02-01','report');
 if r->'leads'->>'total'<>'3'
 or (select sum((q->>'value')::integer) from jsonb_array_elements(r->'trend')q)<>3
 or (select sum((q->>'value')::integer) from jsonb_array_elements(r->'stages')q)<>3
 or (select sum((q->>'value')::integer) from jsonb_array_elements(r->'owners')q)<>3
 or jsonb_array_length(r->'trend')<>2 then raise exception 'Aggregate reconciliation failed'; end if;
 base_tasks:=public.crm_lead_report((stamp at time zone 'Asia/Dubai')::date-1,(stamp at time zone 'Asia/Dubai')::date+1,'report')->'followUps';
 -- Tasks use their own due dates, even when their lead was created in 2060.
 insert into crm_sales.follow_ups(id,lead_id,title,kind,priority,assigned_user_id,due_at,created_by,updated_by) values
 (gen_random_uuid(),x,'Past due','call','normal',b,stamp-interval '1 hour',a,a),
 (gen_random_uuid(),x,'Future due','call','normal',b,stamp+interval '1 hour',a,a),
 (gen_random_uuid(),x,'Previous owner','call','normal',c,stamp-interval '1 hour',a,a),
 (gen_random_uuid(),y,'Hidden task','call','normal',c,stamp-interval '1 hour',a,a),
 (gen_random_uuid(),z,'Archived lead task','call','normal',b,stamp-interval '1 hour',a,a);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 r:=public.crm_lead_report((stamp at time zone 'Asia/Dubai')::date-1,(stamp at time zone 'Asia/Dubai')::date+1,'report');
 if r->'leads'->>'total'<>'0' or r->'followUps'->>'total'<>'3'
 or r->'followUps'->>'overdue'<>'1' or r->'followUps'->>'upcoming'<>'1' then raise exception 'Task cohort/scope/active eligibility failed'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 r:=public.crm_lead_report((stamp at time zone 'Asia/Dubai')::date-1,(stamp at time zone 'Asia/Dubai')::date+1,'report');
 if (r->'followUps'->>'total')::int<>(base_tasks->>'total')::int+5 or (r->'followUps'->>'needsReview')::int<>(base_tasks->>'needsReview')::int+1
 or (r->'followUps'->>'overdue')::int<>(base_tasks->>'overdue')::int+2 then raise exception 'Team review counts failed'; end if;
 -- Terminal status counts reconcile without inventing delivery or conversion.
 insert into crm_sales.follow_ups(id,lead_id,title,kind,priority,assigned_user_id,due_at,status,actual_at,outcome,completed_activity_id,finalized_by,finalized_at,created_by,updated_by)
 values(gen_random_uuid(),x,'Completed task','call','normal',b,stamp,'completed',stamp,'Discussed requirements',gen_random_uuid(),b,stamp,a,a);
 insert into crm_sales.follow_ups(id,lead_id,title,kind,priority,assigned_user_id,due_at,status,cancellation_reason,finalized_by,finalized_at,created_by,updated_by)
 values(gen_random_uuid(),x,'Cancelled task','call','normal',b,stamp,'cancelled','No longer needed',b,stamp,a,a);
 r:=public.crm_lead_report((stamp at time zone 'Asia/Dubai')::date-1,(stamp at time zone 'Asia/Dubai')::date+1,'report');
 if (r->'followUps'->>'completed')::int<>(base_tasks->>'completed')::int+1 or (r->'followUps'->>'cancelled')::int<>(base_tasks->>'cancelled')::int+1
 or (r->'followUps'->>'open')::int<>(base_tasks->>'open')::int+5 then raise exception 'Terminal status counts failed'; end if;
 -- Current loss reason appears; reopening keeps the episode but removes current loss count.
 perform public.crm_transition_lead(gen_random_uuid(),y,1,'lose','{"reasonCode":"postponed"}');
 r:=public.crm_lead_report('2060-01-01','2060-01-31','report');
 if r->'lossReasons'->0->>'key'<>'postponed' or r->'lossReasons'->0->>'value'<>'1' then raise exception 'Current loss missing'; end if;
 perform public.crm_transition_lead(gen_random_uuid(),y,2,'reopen','{"reason":"Client resumed planning"}');
 r:=public.crm_lead_report('2060-01-01','2060-01-31','report');
 if jsonb_array_length(r->'lossReasons')<>0 or not exists(select 1 from crm_sales.losses where lead_id=y) then raise exception 'Loss history or reopening reporting failed'; end if;
 -- An unassigned lead must still flag old-owner tasks for review (SQL NULL guard).
 update crm_sales.leads set assigned_user_id=null where id=x;
 r:=public.crm_lead_report((stamp at time zone 'Asia/Dubai')::date-1,(stamp at time zone 'Asia/Dubai')::date+1,'report');
 if (r->'followUps'->>'needsReview')::int<>(base_tasks->>'needsReview')::int+3 then raise exception 'Unassigned owner review failed'; end if;
 -- Invalid inputs and unapproved mode values cannot bypass authorization.
 denied:=false; begin perform public.crm_lead_report('2060-01-03','2060-01-02','report'); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Reversed range accepted'; end if;
 denied:=false; begin perform public.crm_lead_report('2060-01-01','2061-01-01','report'); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Oversized range accepted'; end if;
 denied:=false; begin perform public.crm_lead_report('2060-01-01','2060-01-01','leads.view'); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Arbitrary permission accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 update auth.users set banned_until=now()+interval '1 day' where id=b;
 denied:=false; begin perform public.crm_lead_report('2060-01-01','2060-01-01','report'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Inactive account retained report access'; end if;
 update auth.users set banned_until=null where id=b;
 delete from crm_access.user_roles where user_id=b;
 denied:=false; begin perform public.crm_lead_report('2060-01-01','2060-01-01','report'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Revoked account retained report access'; end if;
 if has_function_privilege('anon','public.crm_lead_report(date,date,text)','execute')
 or has_function_privilege('service_role','public.crm_lead_report(date,date,text)','execute') then raise exception 'Unexpected public execution grant'; end if;
end;
$$;
rollback;