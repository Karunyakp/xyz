import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { rows, type QueryOptions, type TableName } from '../services/repository';
import type { DataRow } from '../domain/models';
import { useApp } from './context';
export function useRows<T = DataRow>(table: TableName, options: QueryOptions = {}) {
  const { institutionId } = useApp();
  return useQuery({
    queryKey: ['rows', table, institutionId, options],
    queryFn: () => rows<T>(table, institutionId, options),
    enabled: !!institutionId,
  });
}
export function useAction() {
  const q = useQueryClient();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: async <T>(
      work: () => Promise<T>,
      message = 'Saved successfully',
    ): Promise<T | undefined> => {
      setBusy(true);
      try {
        const result = await work();
        await q.invalidateQueries();
        toast.success(message);
        return result;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Action failed');
        return undefined;
      } finally {
        setBusy(false);
      }
    },
  };
}
