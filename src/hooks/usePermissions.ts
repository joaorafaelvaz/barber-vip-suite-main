import { useAuth } from '@/contexts/AuthContext';
import { Database } from '@/integrations/supabase/types';

type RoleBase = Database['public']['Enums']['app_role_base'];

interface Permissions {
  canViewDashboard: boolean;
  canViewVendas: boolean;
  canViewClientes: boolean;
  canViewProdutos: boolean;
  canViewColaboradores: boolean;
  canViewMetas: boolean;
  canViewComissoes: boolean;
  canViewRelatorios: boolean;
  canAccessAdmin: boolean;
  canManageUsers: boolean;
  canManageOrg: boolean;
  canManageUnits: boolean;
  canManageRoles: boolean;
  canManageGrants: boolean;
  canViewAudit: boolean;
  canManageSecurity: boolean;
  isMaster: boolean;
  isOrgAdmin: boolean;
  isUnitManager: boolean;
  isTeamLead: boolean;
  isColaborador: boolean;
  // Legacy aliases for backward compatibility
  isFranquiaAdmin: boolean;
  isUnidadeGerente: boolean;
}

export function usePermissions(): Permissions {
  const { profile } = useAuth();
  
  const roleBase = profile?.role_base;
  
  // New role checks (5-level hierarchy)
  const isMaster = roleBase === 'master';
  const isOrgAdmin = roleBase === 'org_admin' || roleBase === 'franquia_admin';
  const isUnitManager = roleBase === 'unit_manager' || roleBase === 'unidade_gerente';
  const isTeamLead = roleBase === 'team_lead';
  const isColaborador = roleBase === 'colaborador';
  
  // Legacy aliases
  const isFranquiaAdmin = isOrgAdmin;
  const isUnidadeGerente = isUnitManager;
  
  // Hierarquia: master > org_admin > unit_manager > team_lead > colaborador
  const isAdminLevel = isMaster || isOrgAdmin;
  const isManagerLevel = isAdminLevel || isUnitManager;
  const isLeadLevel = isManagerLevel || isTeamLead;
  
  return {
    // Visualizações básicas - todos podem ver
    canViewDashboard: !!profile,
    canViewVendas: !!profile,
    canViewClientes: !!profile,
    canViewProdutos: !!profile,
    canViewColaboradores: isManagerLevel,
    
    // Gestão - apenas gerentes e acima
    canViewMetas: isLeadLevel,
    canViewComissoes: isLeadLevel,
    canViewRelatorios: isManagerLevel,
    
    // Administração
    canAccessAdmin: isAdminLevel || isUnitManager,
    canManageUsers: isAdminLevel || isUnitManager,
    canManageOrg: isMaster,
    canManageUnits: isAdminLevel,
    canManageRoles: isMaster,
    canManageGrants: isAdminLevel || isUnitManager,
    canViewAudit: isAdminLevel,
    canManageSecurity: isMaster,
    
    // Role checks
    isMaster,
    isOrgAdmin,
    isUnitManager,
    isTeamLead,
    isColaborador,
    
    // Legacy aliases
    isFranquiaAdmin,
    isUnidadeGerente,
  };
}
