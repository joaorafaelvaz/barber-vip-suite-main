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

interface UpdateUserPayload {
  user_id: string
  display_name?: string
  role_base?: 'master' | 'franquia_admin' | 'unidade_gerente' | 'colaborador'
  org_id?: string | null
  unit_id?: string | null
  colaborador_id?: string | null
  login_alias?: string | null
  is_active?: boolean
  new_password?: string
}

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
      return new Response(
        JSON.stringify({ error: 'Sem permissão para atualizar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get caller's profile
    const { data: callerProfile, error: profileError } = await supabaseAuth
      .from('app_user_profiles')
      .select('role_base, org_id, unit_id')
      .eq('user_id', callerUserId)
      .single()

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: 'Perfil do administrador não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const payload: UpdateUserPayload = await req.json()

    if (!payload.user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Get target user's current profile
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('app_user_profiles')
      .select('*')
      .eq('user_id', payload.user_id)
      .single()

    if (targetError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerRole = callerProfile.role_base

    // Scope validation
    if (callerRole !== 'master') {
      // Cannot edit masters
      if (targetProfile.role_base === 'master') {
        return new Response(
          JSON.stringify({ error: 'Você não pode editar usuários Master' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Cannot promote to master
      if (payload.role_base === 'master') {
        return new Response(
          JSON.stringify({ error: 'Apenas Master pode criar outros Masters' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (callerRole === 'franquia_admin') {
        // Can only edit users in same org
        if (targetProfile.org_id !== callerProfile.org_id) {
          return new Response(
            JSON.stringify({ error: 'Você só pode editar usuários da sua organização' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else if (callerRole === 'unidade_gerente') {
        // Can only edit users in same unit
        if (targetProfile.unit_id !== callerProfile.unit_id) {
          return new Response(
            JSON.stringify({ error: 'Você só pode editar usuários da sua unidade' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Cannot change to admin roles
        if (payload.role_base && ['master', 'franquia_admin'].includes(payload.role_base)) {
          return new Response(
            JSON.stringify({ error: 'Gerentes de unidade não podem promover a administrador' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Prevent self-deactivation
    if (payload.user_id === callerUserId && payload.is_active === false) {
      return new Response(
        JSON.stringify({ error: 'Você não pode desativar sua própria conta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (payload.display_name !== undefined) updateData.display_name = payload.display_name
    if (payload.role_base !== undefined) updateData.role_base = payload.role_base
    if (payload.org_id !== undefined) updateData.org_id = payload.org_id
    if (payload.unit_id !== undefined) updateData.unit_id = payload.unit_id
    if (payload.colaborador_id !== undefined) updateData.colaborador_id = payload.colaborador_id
    if (payload.login_alias !== undefined) updateData.login_alias = payload.login_alias
    if (payload.is_active !== undefined) updateData.is_active = payload.is_active

    // Update profile
    const { error: updateError } = await supabaseAdmin
      .from('app_user_profiles')
      .update(updateData)
      .eq('user_id', payload.user_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar perfil do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update password if provided
    if (payload.new_password) {
      if (payload.new_password.length < 6 || payload.new_password.length > 128) {
        return new Response(
          JSON.stringify({ error: 'Nova senha deve ter entre 6 e 128 caracteres' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(
        payload.user_id,
        { password: payload.new_password }
      )

      if (pwError) {
        console.error('Password update error:', pwError)
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar senha' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log(`User ${payload.user_id} updated by ${callerUserId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuário atualizado com sucesso'
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
