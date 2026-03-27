import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, AccessGuard } from "@/components/auth";
import { AppLayout } from "@/components/layout";
import { lazy, Suspense } from "react";

// Pages — lazy loaded para reduzir bundle inicial
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const Clientes = lazy(() => import("./pages/app/Clientes"));
const Servicos = lazy(() => import("./pages/app/Servicos"));
const Colaboradores = lazy(() => import("./pages/app/Colaboradores"));
const ColaboradorDetalhe = lazy(() => import("./pages/app/ColaboradorDetalhe"));
const Metas = lazy(() => import("./pages/app/Metas"));
const Comissoes = lazy(() => import("./pages/app/Comissoes"));
const Relatorios = lazy(() => import("./pages/app/Relatorios"));
const RelatoriosSemanal = lazy(() => import("./pages/app/RelatoriosSemanal"));
const Perfil = lazy(() => import("./pages/app/Perfil"));
const Administracao = lazy(() => import("./pages/app/Administracao"));
const DashboardMensal = lazy(() => import("./pages/app/DashboardMensal"));
const FaturamentoDrill = lazy(() => import("./pages/app/FaturamentoDrill"));
const RaioXClientes = lazy(() => import("./pages/app/RaioXClientes"));

function PageLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-3.5">
      <div className="relative h-9 w-9">
        <div className="absolute inset-0 rounded-full border-[1.5px] border-primary/10" />
        <div className="absolute inset-0 rounded-full border-[1.5px] border-transparent border-t-primary animate-spin" />
      </div>
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary/35">
        Barber VIP
      </span>
    </div>
  );
}


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <TooltipProvider>
          <div className="dark">
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
                  <Route path="/auth" element={<Auth />} />

                  {/* Protected app routes */}
                  <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="dashboard-mensal" element={<DashboardMensal />} />
                    <Route path="faturamento" element={<FaturamentoDrill />} />
                    <Route path="clientes" element={<Clientes />} />
                    <Route path="raiox-clientes" element={<RaioXClientes />} />

                    <Route path="servicos" element={<Servicos />} />
                    <Route path="colaboradores" element={<Colaboradores />} />
                    <Route path="colaboradores/:id" element={<ColaboradorDetalhe />} />
                    <Route path="metas" element={<Metas />} />
                    <Route path="comissoes" element={<Comissoes />} />
                    <Route path="relatorios" element={<Relatorios />}>
                      <Route path="semanais" element={<RelatoriosSemanal />} />
                    </Route>
                    <Route path="perfil" element={<Perfil />} />

                    {/* Admin route - protected by permission */}
                    <Route path="administracao" element={
                      <AccessGuard permission="canAccessAdmin">
                        <Administracao />
                      </AccessGuard>
                    } />
                  </Route>

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </div>
        </TooltipProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
