// src/contexts/AuthContext.tsx
// Contexto global de autenticação via Supabase Auth com suporte a RBAC dinâmico

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Permissions, Role, Module } from '../types/permissions';

interface Profile {
  id: string;
  full_name: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  role: string;
  role_id: string | null;
  avatar_url: string | null;
  roles: Role | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  permissions: Permissions | null;
  userModules: Module[];
  loading: boolean;
  profileLoaded: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, phone: string, avatarUrl?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
}

const DEFAULT_PERMISSIONS: Permissions = {
  can_informes: false,
  can_holerites: false,
  can_config: false,
  can_upload: false,
  can_send_email: false,
  can_view_all: false,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [userModules, setUserModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // ── Busca o profile com JOIN em roles + módulos do perfil ──────────────────
  const fetchProfile = async (userId: string) => {
    try {
      // 1. Busca o perfil com o role vinculado
      const { data, error } = await supabase
        .from('profiles')
        .select('*, roles(*)')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AuthContext] Erro ao buscar perfil:', error.message);
        setPermissions(DEFAULT_PERMISSIONS);
        setUserModules([]);
        return;
      }

      if (data) {
        setProfile(data as Profile);

        const role = data.roles as Role | null;
        if (role) {
          setPermissions({
            can_informes: role.can_informes,
            can_holerites: role.can_holerites,
            can_config: role.can_config,
            can_upload: role.can_upload,
            can_send_email: role.can_send_email,
            can_view_all: role.can_view_all,
          });

          // 2. Busca os módulos que este perfil tem acesso
          if (data.role_id) {
            const { data: rmpData, error: rmpError } = await supabase
              .from('role_module_permissions')
              .select('modules(*)')
              .eq('role_id', data.role_id);

            if (rmpError) {
              console.error('[AuthContext] Erro ao buscar módulos:', rmpError.message);
              setUserModules([]);
            } else {
              // Extrai os módulos, filtra apenas os ativos e ordena
              const modules = (rmpData ?? [])
                .map((row: any) => row.modules as Module)
                .filter((m: Module) => m && m.is_active)
                .sort((a: Module, b: Module) => a.sort_order - b.sort_order);
              setUserModules(modules);
            }
          } else {
            setUserModules([]);
          }
        } else {
          // Fallback: campo role text ('admin' | 'colaborador')
          const isAdmin = data.role === 'admin';
          setPermissions({
            can_informes: true,
            can_holerites: true,
            can_config: isAdmin,
            can_upload: isAdmin,
            can_send_email: isAdmin,
            can_view_all: isAdmin,
          });
          setUserModules([]);
        }
      }
    } catch (err) {
      console.error('[AuthContext] Exceção ao buscar perfil:', err);
      setPermissions(DEFAULT_PERMISSIONS);
      setUserModules([]);
    } finally {
      setProfileLoaded(true);
    }
  };

  // ── 1. Listener de auth — SÍNCRONO, sem await ──────────────────────────────
  // NUNCA faça await de chamadas Supabase dentro do onAuthStateChange!
  // Isso causa deadlock pois o Supabase aguarda o callback antes de resolver
  // o signInWithPassword, mas o fetchProfile precisa da sessão já estabelecida.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (!session) {
          setProfile(null);
          setPermissions(null);
          setUserModules([]);
          setProfileLoaded(false);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── 2. Fetch do perfil em efeito separado — reage à mudança de user ────────
  // Separado do onAuthStateChange para evitar deadlock
  useEffect(() => {
    if (user?.id) {
      setProfileLoaded(false);
      fetchProfile(user.id);
    }
  }, [user?.id]);

  // ── Auth actions ────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'E-mail ou senha incorretos.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { error: 'Confirme seu e-mail antes de acessar.' };
      }
      return { error: 'Erro ao realizar login. Tente novamente.' };
    }
    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    avatarUrl?: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, telefone: phone, avatar_url: avatarUrl },
      },
    });

    if (error) {
      if (error.message.includes('User already registered')) {
        return { error: 'E-mail já cadastrado no sistema.' };
      }
      return { error: 'Erro ao realizar cadastro. Verifique os dados e tente novamente.' };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setPermissions(null);
    setUserModules([]);
    setProfileLoaded(false);
  };

  const refreshProfile = async () => {
    if (user?.id) {
      setProfileLoaded(false);
      await fetchProfile(user.id);
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      session, user, profile, permissions, userModules, loading, profileLoaded,
      signIn, signUp, signOut, refreshProfile, isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um <AuthProvider>');
  }
  return context;
};
