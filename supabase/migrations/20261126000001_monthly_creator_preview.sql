-- A prévia acompanha o snapshot e usa as mesmas permissões do perfil no portal.
alter table public.creators
  add column monthly_preview jsonb,
  add constraint creators_monthly_preview_current_only
    check (monthly_preview is null or (in_current_hall and jsonb_typeof(monthly_preview) = 'object'));
