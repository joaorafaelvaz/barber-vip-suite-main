import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://vipdata.lovable.app',
  'https://id-preview--cceb0038-597f-4d74-b61a-5290ef5cb066.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  }
}

interface SyncRequest {
  inicio: string // YYYY-MM-DD
  fim: string // YYYY-MM-DD
  unidade_id?: string
}

interface VendaPayload {
  vendaId: string
  vendaData: string
  produto: string
  valorBruto: number
  valorLiquido: number
  formaPagamento: string
  convenio?: string
  colaboradorId: string
  colaborador: string
  colaboradorNome?: string
  caixaId: string
  caixaNome?: string
  clienteId?: string
  clienteNome?: string
  telefone?: string
  [key: string]: unknown
}

// Date format validation (YYYY-MM-DD)
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function sanitizeString(val: unknown, maxLen = 500): string | null {
  if (val == null) return null
  const str = String(val).substring(0, maxLen)
  return str
}

function sanitizeNumber(val: unknown): number | null {
  if (val == null) return null
  const num = Number(val)
  return isFinite(num) ? num : null
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is authenticated and has permission
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is master or admin and get their profile
    const { data: profile } = await supabase
      .from('app_user_profiles')
      .select('role_base, org_id, unit_id')
      .eq('user_id', user.id)
      .single()

    if (!profile || !['master', 'franquia_admin', 'unidade_gerente'].includes(profile.role_base)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Permission denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: SyncRequest = await req.json()
    const { inicio, fim } = body
    let { unidade_id } = body

    if (!inicio || !fim) {
      return new Response(
        JSON.stringify({ ok: false, error: 'inicio and fim are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate date format
    if (!DATE_REGEX.test(inicio) || !DATE_REGEX.test(fim)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid date format. Use YYYY-MM-DD' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Scope validation: unidade_gerente can only sync their own unit
    if (profile.role_base === 'unidade_gerente') {
      if (!profile.unit_id) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Unit not configured for user' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      // Force unidade_id to user's own unit
      if (unidade_id && unidade_id !== profile.unit_id) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Cannot sync other units' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      unidade_id = profile.unit_id
    }

    console.log(`[sync-vendas] Starting sync for period ${inicio} to ${fim}, user: ${user.id}, role: ${profile.role_base}`)

    // Get API credentials from secrets
    const apiBaseUrl = Deno.env.get('API_BASE_URL')
    const apiUnidadeId = unidade_id || Deno.env.get('API_UNIDADE_ID')
    const apiHash = Deno.env.get('API_HASH')

    if (!apiBaseUrl || !apiUnidadeId || !apiHash) {
      console.error('[sync-vendas] Missing API credentials')
      return new Response(
        JSON.stringify({ ok: false, error: 'API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Format dates for API (DD/MM/YYYY)
    const formatDateForApi = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-')
      return `${day}/${month}/${year}`
    }

    const inicioFormatted = formatDateForApi(inicio)
    const fimFormatted = formatDateForApi(fim)
    
    const apiUrl = `${apiBaseUrl}?unidade=${apiUnidadeId}&inicio=${inicioFormatted}&fim=${fimFormatted}&hash=${apiHash}`
    
    console.log(`[sync-vendas] Calling external API for period ${inicioFormatted} - ${fimFormatted}`)

    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    })

    const responseText = await apiResponse.text()
    
    if (!apiResponse.ok) {
      console.error(`[sync-vendas] API error: ${apiResponse.status}`)
      return new Response(
        JSON.stringify({ ok: false, error: 'External API returned an error' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to parse as JSON
    let apiData: unknown
    try {
      apiData = JSON.parse(responseText)
    } catch {
      console.error(`[sync-vendas] API returned non-JSON response`)
      return new Response(
        JSON.stringify({ ok: false, error: 'External API returned invalid response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Handle different API response formats
    const vendas: VendaPayload[] = Array.isArray(apiData) ? apiData : ((apiData as Record<string, unknown>).vendas || (apiData as Record<string, unknown>).data || []) as VendaPayload[]
    
    console.log(`[sync-vendas] Received ${vendas.length} records from API`)

    if (vendas.length === 0) {
      return new Response(
        JSON.stringify({ 
          ok: true, 
          message: 'No data returned from API for this period',
          fetched_count: 0,
          inserted_count: 0,
          deleted_count: 0,
          periodo_inicio: inicio,
          periodo_fim: fim
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Clear tmp table first
    const { error: truncateError } = await supabase
      .from('vendas_api_raw_tmp')
      .delete()
      .neq('id', 0) // Delete all rows

    if (truncateError) {
      console.error('[sync-vendas] Error clearing tmp table:', truncateError)
    }

    // Parse date from API format (DD/MM/YYYY HH:mm or DD/MM/YYYY)
    const parseApiDate = (dateStr: string | undefined): string | null => {
      if (!dateStr) return null
      try {
        const parts = dateStr.split(' ')
        const dateParts = parts[0].split('/')
        if (dateParts.length !== 3) return null
        
        const [day, month, year] = dateParts
        const time = parts[1] || '00:00'
        const [hour, minute] = time.split(':')
        
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00-03:00`
      } catch {
        return null
      }
    }

    // Transform and insert data into tmp table with validation
    const sourceRunId = crypto.randomUUID()
    const transformedRecords = vendas.map((v: VendaPayload) => ({
      source: 'api',
      source_run_id: sourceRunId,
      payload: v,
      venda_id: sanitizeString(v.vendaId, 100) || crypto.randomUUID(),
      venda_data_text: sanitizeString(v.vendaData, 50),
      venda_data_ts: parseApiDate(v.vendaData),
      produto: sanitizeString(v.produto, 255),
      valor_bruto: sanitizeNumber(v.valorBruto),
      valor_liquido: sanitizeNumber(v.valorLiquido),
      forma_pagamento: sanitizeString(v.formaPagamento, 100),
      convenio: sanitizeString(v.convenio, 100),
      colaborador_id: sanitizeString(v.colaboradorId, 100),
      colaborador: sanitizeString(v.colaborador, 255),
      colaborador_nome: sanitizeString(v.colaboradorNome || v.colaborador, 255),
      caixa_id: sanitizeString(v.caixaId, 100),
      caixa_nome: sanitizeString(v.caixaNome, 255),
      cliente_id: sanitizeString(v.clienteId, 100),
      cliente_nome: sanitizeString(v.clienteNome, 255),
      telefone: sanitizeString(v.telefone, 30),
    }))

    // Insert in batches to avoid size limits
    const batchSize = 500
    let insertedCount = 0
    
    for (let i = 0; i < transformedRecords.length; i += batchSize) {
      const batch = transformedRecords.slice(i, i + batchSize)
      const { error: insertError, data: insertedData } = await supabase
        .from('vendas_api_raw_tmp')
        .insert(batch)
        .select('id')

      if (insertError) {
        console.error(`[sync-vendas] Error inserting batch ${i / batchSize + 1}:`, insertError)
        return new Response(
          JSON.stringify({ ok: false, error: 'Failed to insert data into staging table' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      insertedCount += insertedData?.length || batch.length
      console.log(`[sync-vendas] Inserted batch ${i / batchSize + 1}, total: ${insertedCount}`)
    }

    console.log(`[sync-vendas] All data inserted into tmp table. Total: ${insertedCount}`)

    // Call fn_raw_replace_period to move from tmp to raw
    const { data: replaceResult, error: replaceError } = await supabase
      .rpc('fn_raw_replace_period', { p_inicio: inicio, p_fim: fim })

    if (replaceError) {
      console.error('[sync-vendas] Error calling data processing function:', replaceError)
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to process synced data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[sync-vendas] Data processing completed:', replaceResult)

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Sync completed successfully',
        fetched_count: vendas.length,
        inserted_count: replaceResult?.inserted_raw || insertedCount,
        deleted_count: replaceResult?.deleted_raw || 0,
        periodo_inicio: inicio,
        periodo_fim: fim,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[sync-vendas] Unexpected error:', error)
    return new Response(
      JSON.stringify({ ok: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})