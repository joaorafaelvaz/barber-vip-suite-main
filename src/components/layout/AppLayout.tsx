import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { GlobalFilters } from './GlobalFilters';
import { FiltersProvider } from '@/contexts/FiltersContext';

function PageContentLoader() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="relative h-7 w-7">
        <div className="absolute inset-0 rounded-full border-[1.5px] border-primary/10" />
        <div className="absolute inset-0 rounded-full border-[1.5px] border-transparent border-t-primary animate-spin" />
      </div>
    </div>
  );
}

interface AppLayoutProps {
  showFilters?: boolean;
}

export function AppLayout({ showFilters = true }: AppLayoutProps) {
  return (
    <FiltersProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex flex-col flex-1 min-w-0">
            <Header />
            {showFilters && <GlobalFilters />}
            <main className="flex-1 overflow-auto p-4 md:p-6 min-w-0">
              <Suspense fallback={<PageContentLoader />}>
                <Outlet />
              </Suspense>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </FiltersProvider>
  );
}
