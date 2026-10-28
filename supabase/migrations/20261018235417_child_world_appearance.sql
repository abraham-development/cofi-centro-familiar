-- Apariencia del mundo infantil, independiente de la identidad familiar de agenda.
alter table public.family_members
  add column child_accent_color text check (child_accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column child_avatar_key text check (child_avatar_key in
    ('initials', 'cat', 'dog', 'rabbit', 'bird', 'fish', 'turtle', 'rocket', 'flower'));

-- No se conceden UPDATE directos sobre estos campos. El destino se deduce
-- del vínculo vigente, nunca de un identificador enviado por el cliente.
create function private.save_child_appearance(p_accent_color text, p_avatar_key text)
returns table (accent_color text, avatar_key text)
language plpgsql security definer set search_path = '' as $$
declare
  v_device public.paired_devices;
begin
  if auth.uid() is null then perform private.raise_domain('SESSION_REQUIRED'); end if;
  if not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    perform private.raise_domain('FORBIDDEN');
  end if;
  -- Serializar frente a la revocación: si ya ocurrió, no se modifica nada.
  select * into v_device from public.paired_devices d
  where d.auth_user_id = (select auth.uid()) and d.revoked_at is null and d.scope = 'child'
  for share;
  if not found then perform private.raise_domain('FORBIDDEN'); end if;
  if (p_accent_color is not null and p_accent_color !~ '^#[0-9A-Fa-f]{6}$')
    or (p_avatar_key is not null and p_avatar_key not in
      ('initials', 'cat', 'dog', 'rabbit', 'bird', 'fish', 'turtle', 'rocket', 'flower')) then
    perform private.raise_domain('INVALID');
  end if;
  return query update public.family_members m
    set child_accent_color = upper(p_accent_color), child_avatar_key = p_avatar_key
    where m.id = v_device.member_id and m.family_id = v_device.family_id
      and m.kind = 'child' and m.archived_at is null
    returning m.child_accent_color, m.child_avatar_key;
  if not found then perform private.raise_domain('FORBIDDEN'); end if;
end;
$$;

create function public.save_child_appearance(p_accent_color text, p_avatar_key text)
returns table (accent_color text, avatar_key text)
language sql security invoker set search_path = '' as $$
  select * from private.save_child_appearance(p_accent_color, p_avatar_key);
$$;

revoke all on function private.save_child_appearance(text, text), public.save_child_appearance(text, text)
  from public, anon, authenticated;
grant execute on function private.save_child_appearance(text, text), public.save_child_appearance(text, text)
  to authenticated;
