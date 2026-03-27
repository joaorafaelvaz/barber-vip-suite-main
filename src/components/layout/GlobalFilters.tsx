import React, { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { useFilters } from '@/contexts/FiltersContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin } from 'lucide-react';

interface Org {
  id: string;
  nome: string;
}

interface Unit {
  id: string;
  nome: string;
  org_id: string;
}

export function GlobalFilters() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const { isMaster, isFranquiaAdmin } = usePermissions();
  const {
    selectedOrgId,
    setSelectedOrgId,
    selectedUnitId,
    setSelectedUnitId,
  } = useFilters();

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Fetch organizations for master users
  useEffect(() => {
    if (!isMaster) return;
    supabase
      .from('app_orgs')
      .select('id, nome')
      .eq('status', 'ativo')
      .order('nome')
      .then(({ data }) => setOrgs(data || []));
  }, [isMaster]);

  // Fetch units based on selected org or user's org
  useEffect(() => {
    const orgId = selectedOrgId || profile?.org_id;
    if (!orgId) return;
    supabase
      .from('app_units')
      .select('id, nome, org_id')
      .eq('org_id', orgId)
      .eq('status', 'ativo')
      .order('nome')
      .then(({ data }) => setUnits(data || []));
  }, [selectedOrgId, profile?.org_id]);

  // Initialize selected org from profile
  useEffect(() => {
    if (profile?.org_id && !selectedOrgId) {
      setSelectedOrgId(profile.org_id);
    }
  }, [profile?.org_id, selectedOrgId, setSelectedOrgId]);

  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    setSelectedUnitId(null);
  };

  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId === 'all' ? null : unitId);
  };

  const currentOrgName = orgs.find(o => o.id === selectedOrgId)?.nome ||
    (profile?.org_id && !isMaster ? 'Organização' : null);
  const currentUnitName = units.find(u => u.id === selectedUnitId)?.nome;

  const canSelectOrg = isMaster;
  const canSelectUnit = isMaster || isFranquiaAdmin;

  // Não renderizar nada se não houver contexto de org/unit relevante
  if (!canSelectOrg && !canSelectUnit && !currentOrgName) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-card/30 backdrop-blur-md border-b border-border/50">
      {/* Organization Selector (Master only) */}
      {canSelectOrg && orgs.length > 0 && (
        <Select value={selectedOrgId || ''} onValueChange={handleOrgChange}>
          <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs bg-card/50 border-border/50">
            <Building2 className="h-3.5 w-3.5 mr-1.5 text-primary" />
            <SelectValue placeholder={t('filters.organization')} />
          </SelectTrigger>
          <SelectContent>
            {orgs.map((org) => (
              <SelectItem key={org.id} value={org.id} className="text-xs">
                {org.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Unit Selector (Master and Franquia Admin) */}
      {canSelectUnit && units.length > 0 && (
        <Select value={selectedUnitId || 'all'} onValueChange={handleUnitChange}>
          <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs bg-card/50 border-border/50">
            <MapPin className="h-3.5 w-3.5 mr-1.5 text-primary" />
            <SelectValue placeholder={t('filters.unit')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              Todas as unidades
            </SelectItem>
            {units.map((unit) => (
              <SelectItem key={unit.id} value={unit.id} className="text-xs">
                {unit.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Badge estático para usuários sem seletor de unidade */}
      {!canSelectUnit && currentOrgName && (
        <Badge
          variant="outline"
          className="gap-1.5 px-2 py-1 text-xs border-primary/20 bg-primary/5 text-foreground"
        >
          <Building2 className="h-3 w-3 text-primary" />
          <span>{[currentOrgName, currentUnitName].filter(Boolean).join(' - ')}</span>
        </Badge>
      )}
    </div>
  );
}
