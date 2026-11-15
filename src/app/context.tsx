import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../infrastructure/supabase';
import { authService } from '../services';
import { can, type UserContext, type CampusEvent, type Institution } from '../domain/models';
interface AppContext {
  session: Session | null;
  authLoading: boolean;
  context?: UserContext;
  institution?: Institution;
  institutionId: string;
  setInstitution: (id: string) => void;
  contextLoading: boolean;
  error: unknown;
  can: (permission: string, scope?: CampusEvent | string) => boolean;
  refresh: () => Promise<void>;
}
const Context = createContext<AppContext | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [institutionId, setId] = useState(localStorage.getItem('planora.institution') || '');
  const client = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (live) {
        setSession(data.session);
        setAuthLoading(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthLoading(false);
      client.clear();
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [client]);
  const context = useQuery({
    queryKey: ['context', session?.user.id],
    queryFn: authService.context,
    enabled: !!session,
    retry: 1,
  });
  const institutions = context.data?.institutions || [];
  const institution = institutions.find((i) => i.id === institutionId) || institutions[0];
  const selectedId = institution?.id || '';
  const setInstitution = (id: string) => {
    setId(id);
    localStorage.setItem('planora.institution', id);
    client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'context' });
  };
  useEffect(() => {
    if (!supabase || !selectedId) return;
    const channel = supabase
      .channel('planora:' + selectedId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: 'institution_id=eq.' + selectedId,
        },
        () => client.invalidateQueries({ queryKey: ['rows', 'notifications'] }),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: 'institution_id=eq.' + selectedId,
        },
        () => {
          client.invalidateQueries({ queryKey: ['participants'] });
          client.invalidateQueries({ queryKey: ['analytics'] });
          client.invalidateQueries({ queryKey: ['rows', 'attendance'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: 'institution_id=eq.' + selectedId },
        () => client.invalidateQueries({ queryKey: ['rows', 'tasks'] }),
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [selectedId, client]);
  return (
    <Context.Provider
      value={{
        session,
        authLoading,
        context: context.data,
        institution,
        institutionId: selectedId,
        setInstitution,
        contextLoading: context.isLoading,
        error: context.error,
        can: (p, s) => can(context.data, selectedId, p, s),
        refresh: async () => {
          await client.invalidateQueries();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const c = useContext(Context);
  if (!c) throw new Error('Missing app context');
  return c;
}
