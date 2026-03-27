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

interface UpdateRequest {
  inicio: string // YYYY-MM-DD
  fim: string // YYYY-MM-DD
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

    // Check if user is master or admin
    const { data: profile } = await supabase
      .from('app_user_profiles')
      .select('role_base')
      .eq('user_id', user.id)
      .single()

    if (!profile || !['master', 'franquia_admin', 'unidade_gerente'].includes(profile.role_base)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Permission denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: UpdateRequest = await req.json()
    const { inicio, fim } = body

    if (!inicio || !fim) {
      return new Response(
        JSON.stringify({ ok: false, error: 'inicio and fim are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[update-dimensoes] Starting dimension update for period ${inicio} to ${fim}`)

    // Get counts before update
    const { count: clientesBefore } = await supabase
      .from('dimensao_clientes')
      .select('*', { count: 'exact', head: true })

    const { count: colaboradoresBefore } = await supabase
      .from('dimensao_colaboradores')
      .select('*', { count: 'exact', head: true })

    const { count: produtosBefore } = await supabase
      .from('dimensao_produtos')
      .select('*', { count: 'exact', head: true })

    // Call admin_atualizar_dimensoes_periodo
    const { data: result, error: rpcError } = await supabase
      .rpc('admin_atualizar_dimensoes_periodo', { p_inicio: inicio, p_fim: fim })

    if (rpcError) {
      console.error('[update-dimensoes] Error calling dimension update:', rpcError)
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to update dimensions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[update-dimensoes] admin_atualizar_dimensoes_periodo result:', result)

    // Get counts after update
    const { count: clientesAfter } = await supabase
      .from('dimensao_clientes')
      .select('*', { count: 'exact', head: true })

    const { count: colaboradoresAfter } = await supabase
      .from('dimensao_colaboradores')
      .select('*', { count: 'exact', head: true })

    const { count: produtosAfter } = await supabase
      .from('dimensao_produtos')
      .select('*', { count: 'exact', head: true })

    const functionResult = Array.isArray(result) ? result[0] : result

    return new Response(
      JSON.stringify({
        ok: functionResult?.ok ?? true,
        message: functionResult?.message || 'Dimensions updated successfully',
        periodo_inicio: inicio,
        periodo_fim: fim,
        stats: {
          clientes: {
            before: clientesBefore || 0,
            after: clientesAfter || 0,
            added: (clientesAfter || 0) - (clientesBefore || 0),
          },
          colaboradores: {
            before: colaboradoresBefore || 0,
            after: colaboradoresAfter || 0,
            added: (colaboradoresAfter || 0) - (colaboradoresBefore || 0),
          },
          produtos: {
            before: produtosBefore || 0,
            after: produtosAfter || 0,
            added: (produtosAfter || 0) - (produtosBefore || 0),
          },
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[update-dimensoes] Unexpected error:', error)
    return new Response(
      JSON.stringify({ ok: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
