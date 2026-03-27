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
        JSON.stringify({ error: 'Sem permissão para listar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get caller's profile for scope filtering
    const { data: callerProfile, error: profileError } = await supabaseAuth
      .from('app_user_profiles')
      .select('role_base, org_id, unit_id')
      .eq('user_id', callerUserId)
      .single()

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse query params
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
    const rawSearch = url.searchParams.get('search') || ''
    const roleFilter = url.searchParams.get('role') || ''
    const statusFilter = url.searchParams.get('status') || ''

    // Sanitize search input: escape SQL wildcards and limit length
    const search = rawSearch
      .replace(/[%_\\]/g, '\\$&')
      .replace(/[<>"']/g, '')
      .substring(0, 100)

    // Use admin client to get all user data including emails
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Build query
    let query = supabaseAdmin
      .from('app_user_profiles')
      .select(`
        user_id,
        display_name,
        role_base,
        org_id,
        unit_id,
        colaborador_id,
        login_alias,
        is_active,
        created_at,
        updated_at,
        app_orgs!app_user_profiles_org_id_fkey(id, nome),
        app_units!app_user_profiles_unit_id_fkey(id, nome)
      `, { count: 'exact' })

    // Apply scope filter based on caller's role
    const callerRole = callerProfile.role_base
    
    if (callerRole === 'franquia_admin' && callerProfile.org_id) {
      query = query.eq('org_id', callerProfile.org_id)
    } else if (callerRole === 'unidade_gerente' && callerProfile.unit_id) {
      query = query.eq('unit_id', callerProfile.unit_id)
    }
    // Master sees all users

    // Apply filters
    if (search) {
      query = query.or(`display_name.ilike.%${search}%,login_alias.ilike.%${search}%`)
    }

    if (roleFilter) {
      query = query.eq('role_base', roleFilter)
    }

    if (statusFilter === 'active') {
      query = query.eq('is_active', true)
    } else if (statusFilter === 'inactive') {
      query = query.eq('is_active', false)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query
      .order('created_at', { ascending: false })
      .range(from, to)

    const { data: profiles, error: queryError, count } = await query

    if (queryError) {
      console.error('Query error:', queryError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar usuários' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get emails from auth.users for each profile
    const userIds = profiles?.map(p => p.user_id) || []
    
    let usersWithEmail: any[] = profiles || []
    
    if (userIds.length > 0) {
      // Fetch auth users to get emails
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000
      })

      const emailMap = new Map(
        authUsers?.users?.map(u => [u.id, u.email]) || []
      )

      usersWithEmail = (profiles || []).map((profile: any) => ({
        ...profile,
        email: emailMap.get(profile.user_id) || null,
        org_name: (profile.app_orgs as any)?.nome || null,
        unit_name: (profile.app_units as any)?.nome || null
      }))
    }

    console.log(`Listed ${usersWithEmail.length} users for ${callerUserId}`)

    return new Response(
      JSON.stringify({
        users: usersWithEmail,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
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
