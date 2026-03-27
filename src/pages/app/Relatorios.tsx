import React from 'react';
import { Outlet, NavLink, useLocation, Navigate } from 'react-router-dom';
import { FileBarChart, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const SUB_ROUTES = [
  {
    path: 'semanais',
    label: 'Semanais',
    icon: Calendar
  }
  // Futuros relatórios podem ser adicionados aqui
];

export default function Relatorios() {
  const location = useLocation();
  
  // Se estiver na rota base, redireciona para semanais
  if (location.pathname === '/app/relatorios') {
    return <Navigate to="/app/relatorios/semanais" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Sub-navegação */}
      <div className="flex items-center gap-1 border-b border-border pb-2">
        {SUB_ROUTES.map((route) => (
          <NavLink
            key={route.path}
            to={`/app/relatorios/${route.path}`}
            className={({ isActive }) => cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
              isActive 
                ? 'bg-primary/10 text-primary border-b-2 border-primary -mb-[2px]' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <route.icon className="h-4 w-4" />
            {route.label}
          </NavLink>
        ))}
      </div>
      
      {/* Conteúdo da sub-rota */}
      <Outlet />
    </div>
  );
}
