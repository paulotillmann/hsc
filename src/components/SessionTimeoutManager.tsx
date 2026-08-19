import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchSessionSettings } from '../services/settingsService';
import { supabase } from '../lib/supabase';

// Fallback padrão: 30 minutos em milissegundos
const DEFAULT_TIMEOUT_MINUTES = 30;
// Intervalo de checagem periódica (15 segundos)
const CHECK_INTERVAL_MS = 15 * 1000;
// Throttling de registro de atividade (10 segundos)
const THROTTLE_ACTIVITY_MS = 10 * 1000;

export const SessionTimeoutManager: React.FC = () => {
  const { session, profile, profileLoaded, signOut } = useAuth();
  const lastRecordedActivityRef = useRef<number>(Date.now());
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(DEFAULT_TIMEOUT_MINUTES);

  // Carrega configuração de timeout do banco de dados e ouve alterações em tempo real
  useEffect(() => {
    fetchSessionSettings().then(s => {
      if (s.inactivity_timeout_minutes > 0) {
        setTimeoutMinutes(s.inactivity_timeout_minutes);
      }
    });

    const channel = supabase
      .channel('app_settings_timeout_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.session_inactivity_timeout_minutes' },
        (payload) => {
          const newVal = (payload.new as any)?.value;
          if (newVal) {
            const minutes = parseInt(newVal, 10);
            if (!isNaN(minutes) && minutes > 0) {
              setTimeoutMinutes(minutes);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    // Não ativa se não houver usuário autenticado ou perfil não carregado
    if (!session || !profileLoaded || !profile) return;

    // Se o usuário possui a flag de exceção (TV/Painel/Totem), não aplica o timeout por inatividade
    if (profile.exempt_session_timeout) {
      return;
    }

    // Inicializa o timestamp de atividade caso não exista
    const currentStoredActivity = localStorage.getItem('hsc_last_activity');
    if (!currentStoredActivity) {
      localStorage.setItem('hsc_last_activity', Date.now().toString());
    }

    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle para evitar escritas constantes no localStorage
      if (now - lastRecordedActivityRef.current >= THROTTLE_ACTIVITY_MS) {
        lastRecordedActivityRef.current = now;
        localStorage.setItem('hsc_last_activity', now.toString());
      }
    };

    // Eventos monitorados
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    const inactivityTimeoutMs = timeoutMinutes * 60 * 1000;

    // Timer de checagem periódica da inatividade
    const intervalId = setInterval(() => {
      const storedLastActivity = Number(localStorage.getItem('hsc_last_activity') || Date.now());
      const idleTime = Date.now() - storedLastActivity;

      if (idleTime >= inactivityTimeoutMs) {
        console.warn(`[SessionTimeoutManager] Sessão expirada por inatividade (${Math.round(idleTime / 60000)} minutos sem uso / limite: ${timeoutMinutes} min). Desconectando usuário.`);
        sessionStorage.setItem('hsc_logout_reason', 'inactivity');
        signOut();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      clearInterval(intervalId);
    };
  }, [session, profile, profileLoaded, signOut, timeoutMinutes]);

  return null;
};

export default SessionTimeoutManager;
