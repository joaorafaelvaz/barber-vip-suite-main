import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import { useAuditLog } from '@/hooks/useAuditLog';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollText, ChevronLeft, ChevronRight, Eye, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AuditLogEntry } from '@/hooks/useAuditLog';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/10 text-green-500 border-green-500/30',
  update: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  delete: 'bg-red-500/10 text-red-500 border-red-500/30',
  login: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  logout: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
};

export function TabAuditoria() {
  const { t } = useI18n();
  const { logs, loading, error, totalCount, page, pageSize, setPage } = useAuditLog();
  const { canViewAudit } = usePermissions();
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const totalPages = Math.ceil(totalCount / pageSize);

  if (!canViewAudit) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Shield className="h-12 w-12 mb-4" />
        <p>{t('errors.unauthorized')}</p>
      </div>
    );
  }

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('auditoria.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('auditoria.subtitle')}</p>
      </div>

      {/* Logs Table */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ScrollText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{totalCount} Registros</CardTitle>
              <CardDescription className="text-xs">Histórico de atividades do sistema</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <p>{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ScrollText className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum registro de auditoria encontrado</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-foreground">{log.actor_name}</span>
                      <Badge variant="outline" className={ACTION_COLORS[log.action] || 'bg-muted text-foreground'}>
                        {log.action}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{log.entity}{log.entity_id && <span className="text-xs ml-1 opacity-50">({log.entity_id.slice(0, 8)}...)</span>}</span>
                      <span className="text-xs">{format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} className="h-7 px-2 text-xs">
                      <Eye className="h-3.5 w-3.5 mr-1" /> Detalhes
                    </Button>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('auditoria.data')}</TableHead>
                    <TableHead>{t('auditoria.usuario')}</TableHead>
                    <TableHead>{t('auditoria.acao')}</TableHead>
                    <TableHead>{t('auditoria.entidade')}</TableHead>
                    <TableHead className="text-right">{t('auditoria.detalhes')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{log.actor_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ACTION_COLORS[log.action] || 'bg-muted text-foreground'}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.entity}
                        {log.entity_id && (
                          <span className="text-xs ml-1 opacity-50">({log.entity_id.slice(0, 8)}...)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} className="h-8 w-8 p-0">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Registro</DialogTitle>
            <DialogDescription>
              Informações completas do log de auditoria
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Data/Hora</p>
                  <p className="text-sm font-medium">
                    {format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Usuário</p>
                  <p className="text-sm font-medium">{selectedLog.actor_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ação</p>
                  <Badge
                    variant="outline"
                    className={ACTION_COLORS[selectedLog.action] || ''}
                  >
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Entidade</p>
                  <p className="text-sm font-medium">{selectedLog.entity}</p>
                </div>
              </div>

              {selectedLog.entity_id && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ID da Entidade</p>
                  <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded text-xs">
                    {selectedLog.entity_id}
                  </p>
                </div>
              )}

              {selectedLog.diff && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Alterações (diff)</p>
                  <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto max-h-48">
                    {JSON.stringify(selectedLog.diff, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.meta && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Metadados</p>
                  <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto max-h-48">
                    {JSON.stringify(selectedLog.meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
