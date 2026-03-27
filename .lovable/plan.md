

## Plano: Comissão separada (Serviços vs Produtos) nos Relatórios Semanais

### Problema

Hoje o `useRelatorioSemanalBarbeiros` calcula comissão como `faturamento_total × comissao_pct_mensal`. Mas na realidade:
- **Serviços (base + extras)** usam faixas escalonadas (ex: 35%, 37%, 40%)
- **Produtos** usam regra diferente (percentual fixo ou faixas próprias)

O resultado é que a comissão exibida na aba Barbeiros e na mensagem WhatsApp está incorreta.

### Solução

Reutilizar a lógica do `useComissoes` para calcular corretamente a comissão semanal com breakdown por tipo, e exibir os dados de produtos na UI e nas mensagens.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useRelatorioSemanalBarbeiros.ts` | Buscar breakdown de `vw_vendas_kpi_base` para a semana, carregar regras do mês, calcular comissão separada (base, extras, produtos) |
| `src/components/dashboard/types.ts` | Adicionar campos opcionais ao `ByColaborador`: `faturamento_produtos`, `faturamento_servicos_base`, `comissao_servicos`, `comissao_produtos`, `comissao_extras`, `comissao_pct_servicos`, `comissao_pct_produtos` |
| `src/components/relatorios/SemanalEnvioBarbeiros.tsx` | Exibir breakdown de comissão (serviços/produtos) nos cards e KPIs do dialog |
| `src/hooks/useRelatorioSemanalMensagens.ts` | Adicionar variáveis de template: `{{comissao_servicos}}`, `{{comissao_produtos}}`, `{{faturamento_produtos}}`; atualizar `gerarAnaliseTexto` para mencionar produtos |

### Detalhes técnicos

**1. `useRelatorioSemanalBarbeiros.ts` — Cálculo correto**

Para cada semana:
1. Chamar `rpc_dashboard_period` (já faz) → dados semanais base
2. Chamar `rpc_dashboard_period` mês inteiro (já faz) → `comissao_pct` mensal
3. **Novo**: Buscar `vw_vendas_kpi_base` para a semana → separar base/extras/produtos por barbeiro
4. **Novo**: Carregar `regras_comissao_periodo` + `faixas_comissao_periodo` do mês
5. Usar `calcularComissaoPorRegraComBaseDiferente(faturamento_total_mensal, faturamento_semanal_base, regraServicos)` para comissão de serviços (faixa baseada no total mensal, aplicada ao valor semanal)
6. Idem para extras e produtos

O resultado enriche o `ByColaborador` com os campos novos.

```typescript
// Pseudo-código do cálculo
const faixaBase = encontrarFaixa(faturamentoTotalMensal, faixasServicos);
const comissaoBase = faturamentoSemanalBase * (faixaBase.percentual / 100);
const comissaoExtras = faturamentoSemanalExtras * (faixaBase.percentual / 100);
const comissaoProdutos = faturamentoSemanalProdutos * (pctProdutos / 100);
// comissao_total = comissaoBase + comissaoExtras + comissaoProdutos
```

**2. `ByColaborador` — Campos novos (opcionais)**

```typescript
// Adições opcionais para não quebrar código existente
faturamento_produtos?: number;
faturamento_servicos_base?: number;
comissao_servicos?: number;    // base + extras
comissao_produtos?: number;
comissao_extras?: number;
comissao_pct_servicos?: number;
comissao_pct_produtos?: number;
```

**3. UI — Cards e dialog**

No `BarbeiroPill`:
- Abaixo da comissão total, mostrar sub-linha: `Serv: R$X · Prod: R$Y`

No `SendDialog` KPIs:
- Adicionar cards: "Fat. Serviços", "Fat. Produtos", "Com. Serviços", "Com. Produtos"

**4. Mensagens — Novas variáveis**

No `fillTemplate`:
- `{{comissao_servicos}}` → comissão de serviços (base+extras)
- `{{comissao_produtos}}` → comissão de produtos
- `{{faturamento_servicos}}` → fat. serviços
- `{{faturamento_produtos}}` → fat. produtos

No `gerarAnaliseTexto`:
- Se produtos > 0, mencionar: "📦 Produtos: {fmtMoney} com {pct}% de comissão"

### Nota de performance

A query em `vw_vendas_kpi_base` para 1 semana (~100-300 rows) é leve. As regras de comissão são cacheadas via react-query. O impacto é mínimo.

