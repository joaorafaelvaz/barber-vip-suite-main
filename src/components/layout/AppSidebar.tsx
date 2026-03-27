import React from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { usePermissions } from '@/hooks/usePermissions';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  UserCheck,
  Target,
  DollarSign,
  FileBarChart,
  Settings,
  Sparkles,
  CalendarRange,
  TrendingUp,
} from 'lucide-react';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  permissionKey?: keyof ReturnType<typeof usePermissions>;
  comingSoon?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function AppSidebar() {
  const { t } = useI18n();
  const permissions = usePermissions();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const navGroups: NavGroup[] = [
    {
      label: t('nav.principal'),
      items: [
        { title: t('nav.dashboard'), url: '/app/dashboard', icon: LayoutDashboard, permissionKey: 'canViewDashboard' },
        { title: t('nav.dashboardMensal') || 'Dashboard Mensal', url: '/app/dashboard-mensal', icon: CalendarRange, permissionKey: 'canViewDashboard' },
        { title: 'Faturamento', url: '/app/faturamento', icon: TrendingUp, permissionKey: 'canViewDashboard' },
        { title: t('nav.clientes'), url: '/app/clientes', icon: Users, permissionKey: 'canViewClientes' },
        { title: t('nav.raioxClientes') || 'RaioX - Clientes', url: '/app/raiox-clientes', icon: Sparkles, permissionKey: 'canViewClientes' },
        { title: 'Serviços', url: '/app/servicos', icon: Package, permissionKey: 'canViewProdutos' },
      ],
    },
    {
      label: t('nav.gestao'),
      items: [
        { title: t('nav.colaboradores'), url: '/app/colaboradores', icon: UserCheck, permissionKey: 'canViewColaboradores' },
        { title: t('nav.metas'), url: '/app/metas', icon: Target, permissionKey: 'canViewMetas', comingSoon: true },
        { title: t('nav.comissoes'), url: '/app/comissoes', icon: DollarSign, permissionKey: 'canViewComissoes' },
      ],
    },
    {
      label: t('nav.analise'),
      items: [
        { title: t('nav.relatorios'), url: '/app/relatorios', icon: FileBarChart, permissionKey: 'canViewRelatorios' },
      ],
    },
    {
      label: t('nav.config'),
      items: [
        { title: t('admin.title'), url: '/app/administracao', icon: Settings, permissionKey: 'canAccessAdmin' },
      ],
    },
  ];

  const isActive = (url: string) => location.pathname === url;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          {!collapsed && (
            <span className="text-lg font-bold text-gradient-gold">
              {t('app.name')}
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navGroups.map((group) => {
          // Filter items based on permissions
          const visibleItems = group.items.filter((item) => {
            if (!item.permissionKey) return true;
            return permissions[item.permissionKey];
          });

          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider px-2">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const active = isActive(item.url);
                    if (item.comingSoon) {
                      return (
                        <SidebarMenuItem key={item.url}>
                          <div
                            className="flex items-center gap-3 px-3 py-2 rounded-md opacity-40 cursor-not-allowed select-none"
                            title="Em breve"
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && (
                              <>
                                <span className="font-medium flex-1">{item.title}</span>
                                <span className="text-[9px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground rounded px-1 py-0.5">
                                  Em breve
                                </span>
                              </>
                            )}
                          </div>
                        </SidebarMenuItem>
                      );
                    }
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={collapsed ? item.title : undefined}
                        >
                          <NavLink
                            to={item.url}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200
                              ${active
                                ? 'bg-primary/15 text-primary border-l-2 border-primary'
                                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
                              }`}
                            activeClassName=""
                          >
                            <item.icon className={`h-4 w-4 ${active ? 'text-primary' : ''}`} />
                            <span className="font-medium">{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {!collapsed && (
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} VIP Data
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
