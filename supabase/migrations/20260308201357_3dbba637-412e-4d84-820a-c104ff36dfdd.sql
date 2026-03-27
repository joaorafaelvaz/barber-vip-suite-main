
INSERT INTO public.mensagem_templates (categoria, codigo, titulo, corpo) VALUES
('ESPACANDO', 'ESPACANDO_PADRAO', 'Cliente espaçando – lembrete gentil', 'Oi {{nome}}! Notamos que seu último corte foi há {{dias}} dias. Quer manter o visual em dia? Me diz um horário bom pra você que eu já te encaixo. ✂️'),
('PRIMEIRA_VEZ', 'PRIMEIRA_VEZ_PADRAO', 'Primeira vez – boas-vindas', 'Oi {{nome}}! Foi um prazer te receber na VIP! Como foi sua experiência? Esperamos te ver novamente em breve! Se quiser agendar, é só me chamar. 💈'),
('REGULAR', 'REGULAR_PADRAO', 'Regular – manter ritmo', 'Oi {{nome}}! Seu horário habitual está chegando. Quer garantir sua vaga esta semana? Me diz o melhor dia/horário pra você. 💈'),
('ASSIDUO', 'ASSIDUO_PADRAO', 'Assíduo – agradecimento', 'Oi {{nome}}! Obrigado por ser um cliente fiel da VIP! Temos uma surpresa pra você na próxima visita. Quando quer vir? 💈')
ON CONFLICT DO NOTHING;
