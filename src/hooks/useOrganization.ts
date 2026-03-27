import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Organization {
  id: string;
  nome: string;
}

interface Unit {
  id: string;
  nome: string;
  org_id: string;
}

interface OrganizationData {
  organization: Organization | null;
  unit: Unit | null;
  loading: boolean;
}

export function useOrganization(): OrganizationData {
  const { profile } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrgData = async () => {
      if (!profile?.org_id && !profile?.unit_id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch organization
        if (profile.org_id) {
          const { data: orgData } = await supabase
            .from('app_orgs')
            .select('id, nome')
            .eq('id', profile.org_id)
            .single();
          
          if (orgData) {
            setOrganization(orgData);
          }
        }

        // Fetch unit
        if (profile.unit_id) {
          const { data: unitData } = await supabase
            .from('app_units')
            .select('id, nome, org_id')
            .eq('id', profile.unit_id)
            .single();
          
          if (unitData) {
            setUnit(unitData);
          }
        }
      } catch (error) {
        console.error('Error fetching organization data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrgData();
  }, [profile?.org_id, profile?.unit_id]);

  return { organization, unit, loading };
}
