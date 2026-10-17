-- =============================================================================
-- Borrado completo de una familia (operación sensible y explícita).
--
-- Al borrar `families`, la cascada elimina integrantes, categorías y eventos.
-- Las FK compuestas hacia integrantes y categorías eran NO ACTION y bloqueaban
-- esa cascada según el orden en que se procesaban las filas.
--
-- Los clientes no tienen privilegio DELETE sobre family_members ni
-- event_categories (se archivan), así que estas acciones solo se ejecutan al
-- borrar la familia entera o desde un proceso de servidor.
-- =============================================================================

alter table public.event_participants
  drop constraint event_participants_member_fk,
  add constraint event_participants_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id) on delete cascade;

alter table public.adult_memberships
  drop constraint adult_memberships_member_fk,
  add constraint adult_memberships_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id) on delete cascade;

alter table public.family_invitations
  drop constraint family_invitations_member_fk,
  add constraint family_invitations_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id) on delete cascade;

alter table public.task_occurrences
  drop constraint task_occurrences_assignee_fk,
  add constraint task_occurrences_assignee_fk
    foreign key (family_id, assignee_member_id) references public.family_members (family_id, id) on delete cascade;

-- Un evento sin categoría sigue siendo válido: solo se limpia la columna.
alter table public.calendar_events
  drop constraint calendar_events_category_fk,
  add constraint calendar_events_category_fk
    foreign key (family_id, category_id) references public.event_categories (family_id, id)
    on delete set null (category_id);
