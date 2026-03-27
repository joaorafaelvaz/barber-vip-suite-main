DROP POLICY IF EXISTS "authenticated_select_security_settings" ON public.app_security_settings;

CREATE POLICY "authenticated_select_security_settings"
  ON public.app_security_settings FOR SELECT
  TO authenticated
  USING (
    public.app_is_master()
    OR
    (
      org_id IS NOT NULL
      AND org_id = public.get_user_org_id(auth.uid())
    )
    OR
    (
      unit_id IS NOT NULL
      AND unit_id = public.get_user_unit_id(auth.uid())
    )
  );