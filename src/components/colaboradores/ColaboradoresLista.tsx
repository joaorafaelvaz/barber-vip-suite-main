import React from 'react';
import { ColaboradorCard } from './ColaboradorCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { ColaboradorComDados } from '@/types/colaborador';

interface ColaboradoresListaProps {
  colaboradores: ColaboradorComDados[];
  isLoading: boolean;
  onVerDetalhes: (colaborador: ColaboradorComDados) => void;
}

export function ColaboradoresLista({ colaboradores, isLoading, onVerDetalhes }: ColaboradoresListaProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[260px] rounded-lg" />
        ))}
      </div>
    );
  }

  if (colaboradores.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhum colaborador encontrado</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {colaboradores.map(colaborador => (
        <ColaboradorCard
          key={colaborador.colaborador_id}
          colaborador={colaborador}
          onVerDetalhes={onVerDetalhes}
        />
      ))}
    </div>
  );
}
