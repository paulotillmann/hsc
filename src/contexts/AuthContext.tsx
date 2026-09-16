// src/contexts/AuthContext.tsx
// Contexto global de autenticação via Supabase Auth com suporte a RBAC dinâmico

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Permissions, Role, Module } from '../types/permissions';
import { fetchActiveUsers, sendUserHeartbeat, OnlineUser } from '../services/settingsService';

export type { OnlineUser };

interface Profile {
  id: string;
  full_name: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  role: string;
  role_id: string | null;
  avatar_url: string | null;
  default_module_slug: string | null;
  roles: Role | null;
  is_blocked: boolean;
  setor_usuarios?: string | null;
  exempt_session_timeout?: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  permissions: Permissions | null;
  userModules: Module[];
  loading: boolean;
  profileLoaded: boolean;
  defaultModuleSlug: string | null;
  activeUsers: OnlineUser[];
  refreshActiveUsers: () => Promise<OnlineUser[]>;
  terminateUserSessions: (userIds: string[]) => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, phone: string, avatarUrl?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
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

// Helper para fornecer módulos padrão como fallback seguro quando o banco estiver vazio ou perfil não configurado
const getDefaultModules = (isAdmin: boolean): Module[] => {
  const baseModules: Module[] = [
    {
      id: 'm-dashboard',
      name: 'Dashboard',
      slug: 'dashboard',
      icon: 'LayoutDashboard',
      is_active: true,
      sort_order: 10,
      is_system: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'm-informes',
      name: 'Informes de Rendimento',
      slug: 'informes',
      icon: 'FileText',
      is_active: true,
      sort_order: 20,
      is_system: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'm-holerites',
      name: 'Holerites',
      slug: 'holerites',
      icon: 'Receipt',
      is_active: true,
      sort_order: 30,
      is_system: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  if (isAdmin) {
    baseModules.push(
      {
        id: 'm-notificacoes',
        name: 'Notificações',
        slug: 'notificacoes',
        icon: 'AlertTriangle',
        is_active: true,
        sort_order: 50,
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'm-recepcao',
        name: 'Recepção',
        slug: 'recepcao',
        icon: 'Users',
        is_active: true,
        sort_order: 60,
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'm-taxa-ocupacao',
        name: 'Taxa de Ocupação',
        slug: 'taxa-ocupacao',
        icon: 'TrendingUp',
        is_active: true,
        sort_order: 70,
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'm-gestao-escuta',
        name: 'Gestão Escuta Santa Casa',
        slug: 'gestao-escuta-santa-casa',
        icon: 'ShieldAlert',
        is_active: true,
        sort_order: 80,
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'm-gestao-prontuarios',
        name: 'Gestão de Prontuários',
        slug: 'gestao-prontuarios',
        icon: 'FileSpreadsheet',
        is_active: true,
        sort_order: 85,
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'm-financeiro',
        name: 'Financeiro',
        slug: 'financeiro',
        icon: 'Wallet',
        is_active: true,
        sort_order: 86,
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'm-equipamentos',
        name: 'Equipamentos',
        slug: 'equipamentos',
        icon: 'Monitor',
        is_active: true,
        sort_order: 38,
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'm-custos-ti',
        name: 'Custos TI',
        slug: 'custos-ti',
        icon: 'Coins',
        is_active: true,
        sort_order: 39,
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'm-usuarios-tasy',
        name: 'Usuários Tasy',
        slug: 'usuarios-tasy',
        icon: 'Users',
        is_active: true,
        sort_order: 40,
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'm-configuracoes',
        name: 'Configurações',
        slug: 'configuracoes',
        icon: 'Settings',
        is_active: true,
        sort_order: 90,
        is_system: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );
  }

  return baseModules;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [userModules, setUserModulesState] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const setUserModules = (modules: Module[]) => {
    setUserModulesState([...modules].sort((a, b) => a.sort_order - b.sort_order));
  };

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
        if (data.is_blocked) {
          console.warn('[AuthContext] Usuário bloqueado tentou acessar.');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setPermissions(null);
          setUserModules([]);
          setProfileLoaded(true);
          return;
        }

        setProfile(data as Profile);

        const role = data.roles as Role | null;
        const isAdmin = data.role === 'admin';
        const hasRoleId = !!data.role_id;

        if (hasRoleId && role) {
          setPermissions({
            can_informes: role.can_informes,
            can_holerites: role.can_holerites,
            can_config: role.can_config,
            can_upload: role.can_upload,
            can_send_email: role.can_send_email,
            can_view_all: role.can_view_all,
          });

          // 2. Busca os módulos que este perfil tem acesso
          const { data: rmpData, error: rmpError } = await supabase
            .from('role_module_permissions')
            .select('modules(*)')
            .eq('role_id', data.role_id);

          if (rmpError) {
            console.error('[AuthContext] Erro ao buscar módulos:', rmpError.message);
            setUserModules(isAdmin ? getDefaultModules(true) : []);
          } else {
            // Extrai os módulos, filtra apenas os ativos e ordena
            const modules = (rmpData ?? [])
              .map((row: any) => row.modules as Module)
              .filter((m: Module) => m && m.is_active)
              .sort((a: Module, b: Module) => a.sort_order - b.sort_order);

            if (isAdmin) {
              // Para administradores, mescla os módulos do banco com todos os módulos padrão do sistema
              const defaultMods = getDefaultModules(true);
              const existingSlugs = new Set(modules.map((m: Module) => m.slug));
              const merged = [...modules];
              defaultMods.forEach(dm => {
                if (!existingSlugs.has(dm.slug)) {
                  merged.push(dm);
                }
              });
              setUserModules(merged);
            } else if (modules.length === 0) {
              // Se a tabela modules estiver totalmente vazia no banco, usamos o fallback para admin.
              // Caso contrário, se há módulos cadastrados mas nenhuma permissão vinculada, mantemos vazia.
              const { count, error: countError } = await supabase
                .from('modules')
                .select('*', { count: 'exact', head: true });

              if (!countError && count === 0) {
                setUserModules(isAdmin ? getDefaultModules(true) : []);
              } else {
                setUserModules([]);
              }
            } else {
              setUserModules(modules);
            }
          }
        } else {
          // Fallback para quando o usuário não possui perfil (role_id) definido no banco de dados
          if (isAdmin) {
            setPermissions({
              can_informes: true,
              can_holerites: true,
              can_config: true,
              can_upload: true,
              can_send_email: true,
              can_view_all: true,
            });
            setUserModules(getDefaultModules(true));
          } else {
            // Usuário comum sem perfil definido: não apresenta nenhum módulo e zera as permissões
            setPermissions(DEFAULT_PERMISSIONS);
            setUserModules([]);
          }
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

  // ── 3. Ações de saída e Heartbeat ──────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setPermissions(null);
    setUserModules([]);
    setProfileLoaded(false);

    // Limpa timestamp de atividade
    localStorage.removeItem('hsc_last_activity');

    // Limpa o cache de pendências e outros caches de sessão por segurança
    try {
      sessionStorage.removeItem('hsc_gestao_pendencias_data');
      sessionStorage.removeItem('hsc_gestao_pendencias_sync_time');
      sessionStorage.removeItem('hsc_gestao_pendencias_is_demo');
      sessionStorage.removeItem('hsc_gestao_pendencias_sync_status');
      
      sessionStorage.removeItem('hsc_faturamentos_cache_data');
      sessionStorage.removeItem('hsc_faturamentos_cache_time');
      sessionStorage.removeItem('hsc_faturamentos_cache_is_demo');
      sessionStorage.removeItem('hsc_faturamentos_cache_status');
      sessionStorage.removeItem('hsc_faturamentos_cache_from');
      sessionStorage.removeItem('hsc_faturamentos_cache_to');
    } catch (e) {
      console.error('Erro ao limpar cache na saída:', e);
    }
  }, []);

  const broadcastChannelRef = useRef<any>(null);
  const [activeUsers, setActiveUsers] = useState<OnlineUser[]>([]);

  const refreshActiveUsers = useCallback(async (): Promise<OnlineUser[]> => {
    try {
      const list = await fetchActiveUsers(5); // Considera ativos quem esteve online nos últimos 5 minutos
      setActiveUsers(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (!user?.id || !profileLoaded || !profile) {
      setActiveUsers([]);
      if (broadcastChannelRef.current) {
        supabase.removeChannel(broadcastChannelRef.current);
        broadcastChannelRef.current = null;
      }
      return;
    }

    // 1. Envia heartbeat inicial ao logar/carregar perfil
    sendUserHeartbeat(user.id);

    // 2. Inscreve em canal leve de BROADCAST PURO (Zero presence, zero mensagens contínuas)
    // Só consome mensagem se algum admin explicitamente disparar FORCE_LOGOUT
    const channel = supabase.channel('global-user-events');
    broadcastChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'FORCE_LOGOUT' }, (payload) => {
        const targetUserIds = payload?.payload?.targetUserIds as string[] | undefined;
        if (targetUserIds && targetUserIds.includes(user.id)) {
          console.warn('[AuthContext] Sessão encerrada remotamente pelo administrador.');
          sessionStorage.setItem('hsc_logout_reason', 'forced');
          signOut();
        }
      })
      .subscribe();

    return () => {
      if (broadcastChannelRef.current) {
        supabase.removeChannel(broadcastChannelRef.current);
        broadcastChannelRef.current = null;
      }
    };
  }, [user?.id, profileLoaded, signOut]);

  const terminateUserSessions = async (userIds: string[]) => {
    if (userIds.length === 0) return;

    // 1. Dispara broadcast para forçar logout remoto imediato
    if (broadcastChannelRef.current) {
      await broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'FORCE_LOGOUT',
        payload: { targetUserIds: userIds },
      });
    }

    // 2. Limpa last_seen_at no banco para sair imediatamente da lista de ativos
    try {
      await supabase
        .from('profiles')
        .update({ last_seen_at: null })
        .in('id', userIds);
    } catch (err: any) {
      console.warn('[AuthContext] Erro ao limpar last_seen_at dos usuários desconectados:', err.message);
    }

    // 3. Atualiza estado local
    setActiveUsers(prev => prev.filter(u => !userIds.includes(u.id)));

    // Se o próprio usuário atual estiver na lista
    if (user?.id && userIds.includes(user.id)) {
      sessionStorage.setItem('hsc_logout_reason', 'forced');
      await signOut();
    }
  };


  // ── Auth actions ────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'E-mail ou senha incorretos.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { error: 'Confirme seu e-mail antes de acessar.' };
      }
      return { error: 'Erro ao realizar login. Tente novamente.' };
    }

    // Check if user is blocked (envelopado com segurança)
    if (data?.user) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('is_blocked')
          .eq('id', data.user.id)
          .single();
          
        if (profileError) {
          console.error('[AuthContext] Erro ao verificar bloqueio de usuário:', profileError.message);
        } else if (profile?.is_blocked) {
          await supabase.auth.signOut();
          return { error: 'Usuário bloqueado. Você está impedido de usar o sistema.' };
        }
      } catch (err) {
        console.error('[AuthContext] Exceção ao verificar bloqueio no signIn:', err);
      }
    }

    // Registra timestamp de atividade inicial
    localStorage.setItem('hsc_last_activity', Date.now().toString());

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

  const resetPassword = async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) {
      if (error.message.includes('User not found')) {
        return { error: 'E-mail não encontrado.' };
      }
      return { error: 'Erro ao enviar e-mail de recuperação. Tente novamente.' };
    }
    return { error: null };
  };

  const updatePassword = async (password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return { error: 'Erro ao atualizar a senha. Tente novamente ou solicite um novo link.' };
    }
    return { error: null };
  };

  const refreshProfile = async () => {
    if (user?.id) {
      setProfileLoaded(false);
      await fetchProfile(user.id);
    }
  };

  const isAdmin = profile?.role === 'admin';
  const defaultModuleSlug = profile?.default_module_slug ?? null;

  return (
    <AuthContext.Provider value={{
      session, user, profile, permissions, userModules, loading, profileLoaded,
      defaultModuleSlug, activeUsers, refreshActiveUsers, terminateUserSessions,
      signIn, signUp, signOut, resetPassword, updatePassword, refreshProfile, isAdmin,
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
