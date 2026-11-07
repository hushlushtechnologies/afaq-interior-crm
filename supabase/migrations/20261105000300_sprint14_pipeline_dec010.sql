-- DEC-010 only. Additive history; no quotation/project work or role-grant changes.
begin;

create table crm_sales.lost_reasons (
 code text primary key,
 name text not null unique,
 requires_explanation boolean not null default false,
 active boolean not null default true
);

insert into crm_sales.lost_reasons(code,name,requires_explanation) values
 ('budget_too_high','Budget Too High',false),('chose_competitor','Chose Competitor',false),
 ('not_interested','Client Not Interested',false),('no_response','No Response from Client',false),
 ('postponed','Project Postponed',false),('cancelled','Project Cancelled',false),
 ('requirements_mismatch','Requirements Not Matching',false),('service_area','Location / Service Area Issue',false),
 ('timeline','Timeline Not Suitable',false),('duplicate','Duplicate Lead',false),('other','Other',true);

create table crm_sales.losses (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references crm_sales.leads(id) on delete restrict,
 actor_id uuid not null,
 reason_code text not null references crm_sales.lost_reasons(code),
 explanation text check(length(explanation) between 1 and 2000),
 internal_note text check(length(internal_note) between 1 and 2000),
 previous_stage text not null check(previous_stage in ('new','assigned','contacted','requirements','site-visit')),
 occurred_at timestamptz not null default now(),
 unique(lead_id,id)
);

create index losses_lead_history on crm_sales.losses(lead_id,occurred_at desc,id);

alter table crm_sales.leads add column current_loss_id uuid;
alter table crm_sales.leads add constraint leads_current_loss_fk
 foreign key(id,current_loss_id) references crm_sales.losses(lead_id,id) on delete restrict;

alter table crm_sales.leads drop constraint leads_stage_check;
alter table crm_sales.leads add constraint leads_stage_check
 check(stage in ('new','assigned','contacted','requirements','site-visit','lost'));

alter table crm_sales.leads add constraint leads_loss_state_check
 check((stage='lost')=(current_loss_id is not null));

alter table crm_sales.events drop constraint events_action_check;
alter table crm_sales.events add constraint events_action_check
 check(action in ('created','updated','assigned','archived','stage_changed','lost','reopened'));

-- Stage changes now have their own controlled RPC. Generic CRUD still rejects them.
create or replace function crm_sales.guard_identity()
returns trigger language plpgsql set search_path='' as $$
begin
 if (new.id,new.reference,new.created_by,new.created_at,new.source_code,new.external_id,new.qualification_status,new.initial_note)
    is distinct from
    (old.id,old.reference,old.created_by,old.created_at,old.source_code,old.external_id,old.qualification_status,old.initial_note) then
   raise exception using errcode='42501',message='Lead identity, source and initial evidence are immutable.';
 end if;
 return new;
end;
$$;

-- Preserve the existing CRUD implementation; keep its private entry point revoked.
alter function public.crm_save_lead(uuid,text,uuid,integer,jsonb) set schema crm_sales;

revoke all on function crm_sales.crm_save_lead(uuid,text,uuid,integer,jsonb)
 from public,anon,authenticated,service_role;

create function public.crm_save_lead(
 p_request_id uuid,
 p_command text,
 p_lead_id uuid,
 p_version integer,
 p_data jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l crm_sales.leads%rowtype;
begin
 perform pg_advisory_xact_lock(90310001::bigint);

 if p_command in ('update','assign') then
   select * into l from crm_sales.leads where id=p_lead_id for update;

   if found and l.stage='lost'
      and crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by)
      and crm_sales.allowed('leads.'||p_command,l.assigned_user_id,l.created_by) then
     -- An already committed exact retry may still be replayed; no new mutation.
     if not exists(
       select 1 from crm_sales.requests r
       where r.actor_id=auth.uid() and r.request_id=p_request_id
         and r.input=jsonb_build_object(
           'command',p_command,'id',p_lead_id,'version',p_version,'data',p_data
         )
     ) then
       raise exception using errcode='40001',
         message='Reopen the Lost lead before editing or assigning it.';
     end if;
   end if;

   if found and l.stage='assigned' and p_command='assign'
      and crm_sales.allowed('leads.assign',l.assigned_user_id,l.created_by)
      and (
        nullif(p_data->>'assigned_user_id','') is null
        or crm_sales.eligible_owner(nullif(p_data->>'assigned_user_id','')::uuid) is not true
      ) then
     raise exception using errcode='22023',
       message='Assigned requires an eligible owner. Move to New before unassigning.';
   end if;
 end if;

 return crm_sales.crm_save_lead(
   p_request_id,p_command,p_lead_id,p_version,p_data
 );
end;
$$;

alter table crm_sales.lost_reasons enable row level security;
alter table crm_sales.losses enable row level security;

create policy lost_reason_read on crm_sales.lost_reasons
 for select to authenticated
 using(public.crm_has_permission('leads.view'));

create policy loss_read on crm_sales.losses
 for select to authenticated
 using(exists(select 1 from crm_sales.leads l where l.id=lead_id));

revoke all on crm_sales.lost_reasons,crm_sales.losses
 from public,anon,authenticated,service_role;

grant select on crm_sales.lost_reasons,crm_sales.losses to authenticated;

create function public.crm_transition_lead(
 p_request_id uuid,
 p_lead_id uuid,
 p_version integer,
 p_command text,
 p_data jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid();
 l crm_sales.leads%rowtype;
 previous jsonb;
 target text;
 receipt crm_sales.requests%rowtype;
 loss crm_sales.losses%rowtype;
 reason text;
 explanation text;
 note text;
 loss_id uuid;
 fingerprint jsonb:=jsonb_build_object(
   'command','pipeline.'||p_command,
   'id',p_lead_id,
   'version',p_version,
   'data',p_data
 );
begin
 perform pg_advisory_xact_lock(90310001::bigint);

 if actor is null
    or auth.role() is distinct from 'authenticated'
    or crm_sales.eligible_owner(actor) is not true then
   raise exception using errcode='42501',
     message='Active authorized Sales account required.';
 end if;

 if p_request_id is null or p_lead_id is null
    or p_version is null or p_version<1
    or p_command is null or p_command not in ('move','lose','reopen')
    or p_data is null or jsonb_typeof(p_data)<>'object' then
   raise exception using errcode='22023',message='Invalid pipeline request.';
 end if;

 perform pg_advisory_xact_lock(
   hashtextextended(actor::text||p_request_id::text,13)
 );

 select * into l from crm_sales.leads where id=p_lead_id for update;

 if not found
    or crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by) is not true
    or crm_sales.allowed(
      case when p_command='move' then 'leads.update' else 'leads.mark_lost' end,
      l.assigned_user_id,l.created_by
    ) is not true then
   raise exception using errcode='42501',
     message='Pipeline operation is not permitted.';
 end if;

 select * into receipt from crm_sales.requests
 where actor_id=actor and request_id=p_request_id;

 if found then
   if receipt.input<>fingerprint then
     raise exception using errcode='22023',
       message='Request ID already used for different input.';
   end if;
   return jsonb_build_object(
     'lead',to_jsonb(l),'replayed',true,'possibleDuplicate',false
   );
 end if;

 if l.version<>p_version or l.archived_at is not null then
   raise exception using errcode='40001',
     message='Lead changed or was archived. Reload before trying again.';
 end if;

 previous:=to_jsonb(l);

 if p_command='move' then
   if exists(select 1 from jsonb_object_keys(p_data) k where k<>'stage')
      or jsonb_typeof(p_data->'stage') is distinct from 'string' then
     raise exception using errcode='22023',
       message='A target working stage is required.';
   end if;

   target:=p_data->>'stage';

   if target not in ('new','assigned','contacted','requirements','site-visit') then
     raise exception using errcode='22023',
       message='Quotation, negotiation and Won require their approved workflows. Use the Lost workflow for Lost.';
   end if;

   if l.stage='lost' then
     raise exception using errcode='40001',message='Reopen the Lost lead first.';
   end if;

   if target='assigned' and (
     l.assigned_user_id is null
     or crm_sales.eligible_owner(l.assigned_user_id) is not true
   ) then
     raise exception using errcode='22023',
       message='Assigned requires an eligible active Sales owner.';
   end if;

   if target=l.stage then
     insert into crm_sales.requests(actor_id,request_id,input,lead_id)
     values(actor,p_request_id,fingerprint,l.id);

     return jsonb_build_object(
       'lead',to_jsonb(l),'replayed',false,'possibleDuplicate',false
     );
   end if;

 elsif p_command='lose' then
   if exists(
     select 1 from jsonb_object_keys(p_data) k
     where k not in ('reasonCode','explanation','note')
   )
      or jsonb_typeof(p_data->'reasonCode') is distinct from 'string'
      or (
        p_data ? 'explanation'
        and jsonb_typeof(p_data->'explanation') not in ('string','null')
      )
      or (
        p_data ? 'note'
        and jsonb_typeof(p_data->'note') not in ('string','null')
      ) then
     raise exception using errcode='22023',message='Invalid Lost details.';
   end if;

   if l.stage='lost' then
     raise exception using errcode='40001',message='Lead is already Lost.';
   end if;

   reason:=p_data->>'reasonCode';

   explanation:=nullif(
     regexp_replace(
       coalesce(p_data->>'explanation',''),
       '^[[:space:]]+|[[:space:]]+$','','g'
     ),''
   );

   note:=nullif(
     regexp_replace(
       coalesce(p_data->>'note',''),
       '^[[:space:]]+|[[:space:]]+$','','g'
     ),''
   );

   if length(explanation)>2000 or length(note)>2000
      or not exists(
        select 1 from crm_sales.lost_reasons r
        where r.code=reason and r.active
          and (not r.requires_explanation or explanation is not null)
      ) then
     raise exception using errcode='22023',
       message='Choose an active Lost reason and explain Other.';
   end if;

   insert into crm_sales.losses(
     lead_id,actor_id,reason_code,explanation,internal_note,previous_stage
   )
   values(l.id,actor,reason,explanation,note,l.stage)
   returning id into loss_id;

   target:='lost';

 else
   if exists(select 1 from jsonb_object_keys(p_data) k where k<>'reason')
      or jsonb_typeof(p_data->'reason') is distinct from 'string' then
     raise exception using errcode='22023',
       message='A reopening reason is required.';
   end if;

   note:=nullif(
     regexp_replace(
       p_data->>'reason','^[[:space:]]+|[[:space:]]+$','','g'
     ),''
   );

   if note is null or length(note)>2000 then
     raise exception using errcode='22023',
       message='Enter a reopening reason of up to 2000 characters.';
   end if;

   if l.stage<>'lost' then
     raise exception using errcode='40001',
       message='Only Lost leads can be reopened.';
   end if;

   select * into loss from crm_sales.losses
   where id=l.current_loss_id and lead_id=l.id;

   target:=loss.previous_stage;

   if target is null
      or target not in ('new','assigned','contacted','requirements','site-visit')
      or (
        target='assigned' and (
          l.assigned_user_id is null
          or crm_sales.eligible_owner(l.assigned_user_id) is not true
        )
      ) then
     target:='new';
   end if;

   loss_id:=l.current_loss_id;
 end if;

 update crm_sales.leads
 set stage=target,
     current_loss_id=case when p_command='lose' then loss_id else null end,
     version=version+1,
     updated_at=now()
 where id=l.id
 returning * into l;

 insert into crm_sales.events(
   lead_id,actor_id,action,before_data,after_data
 )
 values(
   l.id,
   actor,
   case p_command
     when 'move' then 'stage_changed'
     when 'lose' then 'lost'
     else 'reopened'
   end,
   previous,
   to_jsonb(l)||jsonb_build_object(
     'pipeline_reason',case when p_command='lose' then reason else note end,
     'loss_id',loss_id
   )
 );

 insert into crm_sales.requests(actor_id,request_id,input,lead_id)
 values(actor,p_request_id,fingerprint,l.id);

 return jsonb_build_object(
   'lead',to_jsonb(l),'replayed',false,'possibleDuplicate',false
 );
end;
$$;

create function public.crm_pipeline_detail(p_lead_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'authenticated'
    or not exists(
      select 1 from crm_sales.leads l
      where l.id=p_lead_id
        and crm_sales.allowed('leads.view',l.assigned_user_id,l.created_by)
    ) then
   raise exception using errcode='42501',message='Lead visibility required.';
 end if;

 return jsonb_build_object(
   'reasons',(
     select jsonb_agg(to_jsonb(r) order by r.code)
     from crm_sales.lost_reasons r where r.active
   ),
   'losses',coalesce((
     select jsonb_agg(to_jsonb(l) order by l.occurred_at,l.id)
     from crm_sales.losses l where l.lead_id=p_lead_id
   ),'[]'::jsonb),
   'events',coalesce((
     select jsonb_agg(
       jsonb_build_object(
         'id',e.id,
         'actor_id',e.actor_id,
         'action',e.action,
         'occurred_at',e.occurred_at,
         'previous_stage',e.before_data->>'stage',
         'new_stage',e.after_data->>'stage',
         'reason',e.after_data->>'pipeline_reason',
         'loss_id',e.after_data->>'loss_id'
       ) order by e.id
     )
     from crm_sales.events e
     where e.lead_id=p_lead_id
       and e.action in ('stage_changed','lost','reopened')
   ),'[]'::jsonb)
 );
end;
$$;

revoke all on function
 public.crm_save_lead(uuid,text,uuid,integer,jsonb),
 public.crm_transition_lead(uuid,uuid,integer,text,jsonb),
 public.crm_pipeline_detail(uuid)
 from public,anon,authenticated,service_role;

grant execute on function
 public.crm_save_lead(uuid,text,uuid,integer,jsonb),
 public.crm_transition_lead(uuid,uuid,integer,text,jsonb),
 public.crm_pipeline_detail(uuid)
 to authenticated;

notify pgrst,'reload schema';
commit;