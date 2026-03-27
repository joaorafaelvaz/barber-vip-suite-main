-- 1. Renomear organização para "Barbearia VIP"
UPDATE public.app_orgs 
SET nome = 'Barbearia VIP' 
WHERE id = '50bbbbea-cd17-4764-ba36-ac1bb5f26d75';

-- 2. Criar unidade "Joinville"
INSERT INTO public.app_units (nome, org_id, status)
VALUES ('Joinville', '50bbbbea-cd17-4764-ba36-ac1bb5f26d75', 'active')
ON CONFLICT DO NOTHING;

-- 3. Vincular usuário Master à organização e unidade
UPDATE public.app_user_profiles
SET 
  org_id = '50bbbbea-cd17-4764-ba36-ac1bb5f26d75',
  unit_id = (SELECT id FROM public.app_units WHERE nome = 'Joinville' AND org_id = '50bbbbea-cd17-4764-ba36-ac1bb5f26d75' LIMIT 1)
WHERE user_id = '9c99b2c2-9ade-47d4-bbe3-51efe8591d0b';