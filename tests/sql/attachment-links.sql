-- Local synthetic references only. No Storage objects/files are created. All changes roll back.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
do $$
declare admin uuid:=gen_random_uuid(); sales uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid();
 lead_uuid uuid; other_uuid uuid; room_uuid uuid:=gen_random_uuid(); other_room uuid:=gen_random_uuid(); visit_uuid uuid:=gen_random_uuid();
 file_uuid uuid:=gen_random_uuid(); link_uuid uuid; cmd jsonb; visit_cmd jsonb; result jsonb; denied boolean; i integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values(admin,'s15ref-'||admin||'@example.test',now()),
 (sales,'s15ref-'||sales||'@example.test',now()),(stranger,'s15ref-'||stranger||'@example.test',now()),(manager,'s15ref-'||manager||'@example.test',now());
 insert into crm_access.user_roles(user_id,role_key) values(admin,'super_admin'),(sales,'sales_executive'),(stranger,'sales_executive'),(manager,'management_director');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 lead_uuid:=(public.crm_save_lead(gen_random_uuid(),'create',null,null,jsonb_build_object('customer_name','Reference fixture','assigned_user_id',sales,'source_code','manual','priority','normal','inquiry_on','2026-11-10'))->'lead'->>'id')::uuid;
 other_uuid:=(public.crm_save_lead(gen_random_uuid(),'create',null,null,jsonb_build_object('customer_name','Other reference fixture','assigned_user_id',stranger,'source_code','manual','priority','normal','inquiry_on','2026-11-10'))->'lead'->>'id')::uuid;
 perform public.crm_save_lead_detail(jsonb_build_object('requestId',gen_random_uuid(),'leadId',lead_uuid,'recordId',room_uuid,'command','save_room','version',null,
   'data',jsonb_build_object('name','Living room','room_type',null,'sort_order',0,'requirements_notes',null,'measurement_notes',null,'deliverables_notes',null)));
 perform public.crm_save_lead_detail(jsonb_build_object('requestId',gen_random_uuid(),'leadId',other_uuid,'recordId',other_room,'command','save_room','version',null,
   'data',jsonb_build_object('name','Other room','room_type',null,'sort_order',0,'requirements_notes',null,'measurement_notes',null,'deliverables_notes',null)));
 visit_cmd:=jsonb_build_object('requestId',gen_random_uuid(),'leadId',lead_uuid,'visitId',visit_uuid,'command','create','version',null,
   'data',jsonb_build_object('scheduled_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'assigned_user_id',sales,'location',null,'notes',null,'measurements',null,'observations',null));
 perform public.crm_save_site_visit(visit_cmd);
 -- Metadata-only fixture represents an already validated file; no real upload is claimed.
 insert into crm_sales.attachments(id,lead_id,actor_id,request_id,filename,mime,bytes,sha256,storage_path,state)
   values(file_uuid,lead_uuid,admin,gen_random_uuid(),'Fixture.png','image/png',20,repeat('a',64),lead_uuid||'/'||file_uuid||'.png','ready');
 cmd:=jsonb_build_object('requestId',gen_random_uuid(),'leadId',lead_uuid,'attachmentId',file_uuid,'command','link','data',jsonb_build_object('kind','room','targetId',room_uuid));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sales,'role','authenticated')::text,true);
 result:=public.crm_save_attachment_link(cmd); link_uuid:=(result->>'id')::uuid;
 if public.crm_save_attachment_link(cmd)->>'replayed'<>'true' then raise exception 'Reference retry failed'; end if;
 if public.crm_save_attachment_link(cmd||jsonb_build_object('requestId',gen_random_uuid()))->>'id'<>link_uuid::text
   or (select count(*) from crm_sales.attachment_link_events where link_id=link_uuid)<>1 then raise exception 'Duplicate link fabricated history'; end if;
 denied:=false;
 begin perform public.crm_save_attachment_link(cmd||jsonb_build_object('data',jsonb_build_object('kind','visit','targetId',visit_uuid)));
 exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Changed input reused receipt'; end if;
 denied:=false;
 begin perform public.crm_save_attachment_link(cmd||jsonb_build_object('requestId',gen_random_uuid(),'data',jsonb_build_object('kind','room','targetId',other_room)));
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Cross-lead room linked'; end if;
 denied:=false;
 begin perform public.crm_save_attachment_link(cmd||jsonb_build_object('requestId',gen_random_uuid(),'command','unlink','data',jsonb_build_object('linkId',link_uuid,'version',1)));
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Sales bypassed unlink authority'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_save_attachment_link(cmd||jsonb_build_object('requestId',gen_random_uuid(),'command','unlink','data',jsonb_build_object('linkId',link_uuid,'version',2)));
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Stale unlink accepted'; end if;
 execute format('alter table crm_sales.attachment_link_events add constraint s15_reference_fault check(link_id<>%L::uuid) not valid',link_uuid);
 denied:=false;
 begin perform public.crm_save_attachment_link(cmd||jsonb_build_object('requestId',gen_random_uuid(),'command','unlink','data',jsonb_build_object('linkId',link_uuid,'version',1)));
 exception when check_violation then denied:=true; end;
 if not denied or (select archived_at from crm_sales.attachment_links where id=link_uuid) is not null then raise exception 'Unlink audit was not atomic'; end if;
 alter table crm_sales.attachment_link_events drop constraint s15_reference_fault;
 perform public.crm_save_attachment_link(cmd||jsonb_build_object('requestId',gen_random_uuid(),'command','unlink','data',jsonb_build_object('linkId',link_uuid,'version',1)));
 perform public.crm_save_attachment_link(cmd||jsonb_build_object('requestId',gen_random_uuid()));
 result:=public.crm_attachment_links(lead_uuid,file_uuid,'room',0,0);
 if result->>'total'<>'2' then raise exception 'Unlinked history was lost'; end if;
 cmd:=cmd||jsonb_build_object('requestId',gen_random_uuid(),'data',jsonb_build_object('kind','visit','targetId',visit_uuid));
 result:=public.crm_save_attachment_link(cmd); link_uuid:=(result->>'id')::uuid;
 perform public.crm_save_site_visit(visit_cmd||jsonb_build_object('requestId',gen_random_uuid(),'command','complete','version',1,
   'data',jsonb_build_object('actual_at',to_char((now()-interval '1 hour') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'outcome','Fixture completed')));
 denied:=false;
 begin perform public.crm_save_attachment_link(cmd||jsonb_build_object('requestId',gen_random_uuid(),'command','unlink','data',jsonb_build_object('linkId',link_uuid,'version',1)));
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Finalized visit reference changed'; end if;
 if public.crm_save_attachment_link(cmd)->>'replayed'<>'true' then raise exception 'Committed visit link replay failed'; end if;
 if exists(select 1 from jsonb_array_elements(public.crm_attachment_links(lead_uuid,file_uuid,'visit',0,0)->'links') x
   where x->>'kind'='visit' and x->>'canUnlink' is distinct from 'false') then raise exception 'Finalized link offered mutation'; end if;
 perform public.crm_archive_lead_detail(jsonb_build_object('requestId',gen_random_uuid(),'leadId',lead_uuid,'recordId',room_uuid,'version',1));
 result:=public.crm_attachment_links(lead_uuid,file_uuid,'room',0,0);
 if exists(select 1 from jsonb_array_elements(result->'links') x where x->>'canUnlink' is distinct from 'false') then
   raise exception 'Archived room/finalized visit references offered mutation'; end if;
 denied:=false;
 begin perform public.crm_save_attachment_link(cmd||jsonb_build_object('requestId',gen_random_uuid(),'data',jsonb_build_object('kind','room','targetId',room_uuid)));
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Archived room accepted a new reference'; end if;
 for i in 1..21 loop
   insert into crm_sales.attachment_links(lead_id,attachment_id,room_id,created_by,archived_by,archived_at)
     values(lead_uuid,file_uuid,room_uuid,admin,admin,now());
 end loop;
 if jsonb_array_length(public.crm_attachment_links(lead_uuid,file_uuid,'room',0,0)->'links')<>20
   or jsonb_array_length(public.crm_attachment_links(lead_uuid,file_uuid,'room',0,1)->'links')<>4 then raise exception 'Reference pagination failed'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated')::text,true);
 if public.crm_attachment_links(lead_uuid,file_uuid)->>'canLink'<>'false' then raise exception 'Management acquired write access'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from crm_sales.attachment_links where lead_id=lead_uuid)
   or exists(select 1 from crm_sales.attachment_link_events where link_id=link_uuid) then raise exception 'Cross-lead RLS exposed references'; end if;
 denied:=false;
 begin perform public.crm_attachment_links(lead_uuid,file_uuid); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Cross-lead RPC exposed references'; end if;
 reset role;
 raise notice 'Attachment reference assertions passed';
end;
$$;
rollback;