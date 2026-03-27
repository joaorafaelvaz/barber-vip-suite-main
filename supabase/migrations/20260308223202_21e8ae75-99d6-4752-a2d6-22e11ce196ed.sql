CREATE POLICY "authenticated_delete_mensagem_envios"
ON public.mensagem_envios
FOR DELETE
TO authenticated
USING (true);