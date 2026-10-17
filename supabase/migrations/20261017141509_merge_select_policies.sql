-- =============================================================================
-- Una sola política SELECT por tabla (adultos OR pantallas vinculadas).
-- Mismo acceso que antes; recomendación de rendimiento de los asesores de
-- Supabase (multiple_permissive_policies): Postgres evalúa una sola expresión.
-- =============================================================================

drop policy families_select_adults on public.families;
drop policy families_select_devices on public.families;
create policy families_select on public.families for select to authenticated using (
  id in (select private.my_adult_family_ids())
  or id in (select private.my_device_family_ids())
);

drop policy family_members_select_adults on public.family_members;
drop policy family_members_select_devices on public.family_members;
create policy family_members_select on public.family_members for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or family_id in (select private.my_device_family_ids())
);

drop policy event_categories_select_adults on public.event_categories;
drop policy event_categories_select_devices on public.event_categories;
create policy event_categories_select on public.event_categories for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or family_id in (select private.my_device_family_ids())
);

drop policy calendar_events_select_adults on public.calendar_events;
drop policy calendar_events_select_devices on public.calendar_events;
create policy calendar_events_select on public.calendar_events for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or (family_id in (select private.my_device_family_ids()) and private.device_can_see_event(id))
);

drop policy event_participants_select_adults on public.event_participants;
drop policy event_participants_select_devices on public.event_participants;
create policy event_participants_select on public.event_participants for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or (family_id in (select private.my_device_family_ids()) and private.device_can_see_event(event_id))
);

drop policy task_occurrences_select_adults on public.task_occurrences;
drop policy task_occurrences_select_devices on public.task_occurrences;
create policy task_occurrences_select on public.task_occurrences for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or exists (
    select 1 from private.my_device() d
    where d.family_id = task_occurrences.family_id
      and (
        (d.scope = 'home' and task_occurrences.visibility = 'family')
        or (d.scope = 'child' and task_occurrences.kind <> 'household'
            and task_occurrences.assignee_member_id = d.member_id)
      )
  )
);

drop policy member_point_accounts_select_adults on public.member_point_accounts;
drop policy member_point_accounts_select_devices on public.member_point_accounts;
create policy member_point_accounts_select on public.member_point_accounts for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or exists (
    select 1 from private.my_device() d
    where d.family_id = member_point_accounts.family_id
      and (d.scope = 'home' or d.member_id = member_point_accounts.member_id)
  )
);

drop policy points_ledger_select_adults on public.points_ledger;
drop policy points_ledger_select_child_device on public.points_ledger;
create policy points_ledger_select on public.points_ledger for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or exists (select 1 from private.my_device() d
             where d.family_id = points_ledger.family_id and d.scope = 'child'
               and d.member_id = points_ledger.member_id)
);

drop policy rewards_select_adults on public.rewards;
drop policy rewards_select_child_device on public.rewards;
create policy rewards_select on public.rewards for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or (archived_at is null
      and exists (select 1 from private.my_device() d where d.family_id = rewards.family_id and d.scope = 'child'))
);

drop policy reward_members_select_adults on public.reward_members;
drop policy reward_members_select_child_device on public.reward_members;
create policy reward_members_select on public.reward_members for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or exists (select 1 from private.my_device() d
             where d.family_id = reward_members.family_id and d.scope = 'child'
               and d.member_id = reward_members.member_id)
);

drop policy reward_redemptions_select_adults on public.reward_redemptions;
drop policy reward_redemptions_select_child_device on public.reward_redemptions;
create policy reward_redemptions_select on public.reward_redemptions for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or exists (select 1 from private.my_device() d
             where d.family_id = reward_redemptions.family_id and d.scope = 'child'
               and d.member_id = reward_redemptions.member_id)
);

drop policy paired_devices_select_adults on public.paired_devices;
drop policy paired_devices_select_self on public.paired_devices;
create policy paired_devices_select on public.paired_devices for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or auth_user_id = (select auth.uid())
);
