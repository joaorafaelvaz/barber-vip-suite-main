import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { startOfMonth, endOfMonth, subDays, format } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

interface FiltersContextType {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string | null) => void;
  selectedUnitId: string | null;
  setSelectedUnitId: (id: string | null) => void;
  resetFilters: () => void;
  formatDateRange: () => string;
}

const FiltersContext = createContext<FiltersContextType | undefined>(undefined);

const getDefaultDateRange = (): DateRange => ({
  from: startOfMonth(new Date()),
  to: endOfMonth(new Date()),
});

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const resetFilters = useCallback(() => {
    setDateRange(getDefaultDateRange());
    setSelectedOrgId(null);
    setSelectedUnitId(null);
  }, []);

  const formatDateRange = useCallback(() => {
    return `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`;
  }, [dateRange]);

  return (
    <FiltersContext.Provider value={{
      dateRange,
      setDateRange,
      selectedOrgId,
      setSelectedOrgId,
      selectedUnitId,
      setSelectedUnitId,
      resetFilters,
      formatDateRange,
    }}>
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FiltersContext);
  if (!context) {
    throw new Error('useFilters must be used within a FiltersProvider');
  }
  return context;
}
