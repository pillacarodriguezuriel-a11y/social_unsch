'use client';

import { useCallback, useEffect, useState } from 'react';
import { CatalogData, groupSchoolsByFaculty, loadCatalogs, SchoolGroup } from './catalogs';

export type CatalogStatus = 'loading' | 'ready' | 'error';

export interface UseCatalogsResult {
  status: CatalogStatus;
  catalog: CatalogData | null;
  groups: SchoolGroup[];
  retry: () => void;
}

/**
 * Estado del catálogo persistido. Mientras status !== 'ready' no hay opciones de escuela:
 * los formularios deben deshabilitar la selección en lugar de recurrir a constantes locales.
 */
export function useCatalogs(): UseCatalogsResult {
  const [status, setStatus] = useState<CatalogStatus>('loading');
  const [catalog, setCatalog] = useState<CatalogData | null>(null);

  const load = useCallback((force: boolean) => {
    let active = true;
    setStatus('loading');
    loadCatalogs({ force })
      .then((data) => {
        if (!active) return;
        setCatalog(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setCatalog(null);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(false), [load]);

  return {
    status,
    catalog,
    groups: catalog ? groupSchoolsByFaculty(catalog) : [],
    retry: () => {
      load(true);
    },
  };
}
