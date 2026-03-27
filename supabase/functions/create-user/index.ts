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

interface CreateUserPayload {
  email: string
  password: string
  display_name: string
  role_base: 'master' | 'franquia_admin' | 'unidade_gerente' | 'colaborador'
  org_id?: string
  unit_id?: string
  colaborador_id?: string
  login_alias?: string
}

const VALID_ROLES = ['master', 'franquia_admin', 'unidade_gerente', 'colaborador']

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify the calling user's token
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsError } = await supabaseAuth.auth.getClaims(token)
    
    if (claimsError || !claims?.claims) {
      console.error('Claims error:', claimsError)
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerUserId = claims.claims.sub as string

    // Check if caller can manage users
    const { data: canManage, error: permError } = await supabaseAuth.rpc('can_manage_users', { 
      _user_id: callerUserId 
    })

    if (permError || !canManage) {
      console.error('Permission check failed:', permError)
      return new Response(
        JSON.stringify({ error: 'Sem permissão para criar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get caller's profile for scope validation
    const { data: callerProfile, error: profileError } = await supabaseAuth
      .from('app_user_profiles')
      .select('role_base, org_id, unit_id')
      .eq('user_id', callerUserId)
      .single()

    if (profileError || !callerProfile) {
      console.error('Profile lookup failed:', profileError)
      return new Response(
        JSON.stringify({ error: 'Perfil do administrador não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const payload: CreateUserPayload = await req.json()

    // Validate required fields
    if (!payload.email || !payload.password || !payload.display_name || !payload.role_base) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: email, password, display_name, role_base' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(payload.email) || payload.email.length > 255) {
      return new Response(
        JSON.stringify({ error: 'Formato de email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate password length
    if (payload.password.length < 6 || payload.password.length > 128) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter entre 6 e 128 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate display_name length
    if (payload.display_name.length > 255) {
      return new Response(
        JSON.stringify({ error: 'Nome deve ter no máximo 255 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role_base
    if (!VALID_ROLES.includes(payload.role_base)) {
      return new Response(
        JSON.stringify({ error: 'Papel inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Scope validation based on caller's role
    const callerRole = callerProfile.role_base

    // Only master can create other masters
    if (payload.role_base === 'master' && callerRole !== 'master') {
      return new Response(
        JSON.stringify({ error: 'Apenas Master pode criar outros Masters' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Non-master admins can only create users within their org/unit
    if (callerRole !== 'master') {
      if (callerRole === 'franquia_admin') {
        if (payload.org_id && payload.org_id !== callerProfile.org_id) {
          return new Response(
            JSON.stringify({ error: 'Você só pode criar usuários na sua organização' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        payload.org_id = callerProfile.org_id || undefined
      } else if (callerRole === 'unidade_gerente') {
        if (payload.unit_id && payload.unit_id !== callerProfile.unit_id) {
          return new Response(
            JSON.stringify({ error: 'Você só pode criar usuários na sua unidade' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        payload.org_id = callerProfile.org_id || undefined
        payload.unit_id = callerProfile.unit_id || undefined
        
        if (['master', 'franquia_admin'].includes(payload.role_base)) {
          return new Response(
            JSON.stringify({ error: 'Gerentes de unidade não podem criar administradores' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Create admin client for user creation
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      
      if (authError.message?.includes('already registered')) {
        return new Response(
          JSON.stringify({ error: 'Este email já está cadastrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao criar usuário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newUserId = authData.user.id

    // Create profile in app_user_profiles
    const { error: profileInsertError } = await supabaseAdmin
      .from('app_user_profiles')
      .insert({
        user_id: newUserId,
        display_name: payload.display_name,
        role_base: payload.role_base,
        org_id: payload.org_id || null,
        unit_id: payload.unit_id || null,
        colaborador_id: payload.colaborador_id || null,
        login_alias: payload.login_alias || null,
        is_active: true
      })

    if (profileInsertError) {
      console.error('Profile insert error:', profileInsertError)
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      
      return new Response(
        JSON.stringify({ error: 'Erro ao criar perfil do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`User created successfully: ${newUserId} by ${callerUserId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: newUserId,
        message: 'Usuário criado com sucesso'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})