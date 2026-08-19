// src/components/SessionTimeoutManager.tsx
// Gerenciador global de tempo de inatividade da sessão (30 minutos)
// Ignorado para usuários configurados com exempt_session_timeout = true (TVs/Painéis/Totens)

import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

// 30 minutos em milissegundos
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
// Intervalo de checagem periódica (15 segundos)
const CHECK_INTERVAL_MS = 15 * 1000;
// Throttling de registro de atividade (10 segundos)
const THROTTLE_ACTIVITY_MS = 10 * 1000;

export const SessionTimeoutManager: React.FC = () => {
  const { session, profile, profileLoaded, signOut } = useAuth();
  const lastRecordedActivityRef = useRef<number>(Date.now());

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

    // Timer de checagem periódica da inatividade
    const intervalId = setInterval(() => {
      const storedLastActivity = Number(localStorage.getItem('hsc_last_activity') || Date.now());
      const idleTime = Date.now() - storedLastActivity;

      if (idleTime >= INACTIVITY_TIMEOUT_MS) {
        console.warn(`[SessionTimeoutManager] Sessão expirada por inatividade (${Math.round(idleTime / 60000)} minutos sem uso). Desconectando usuário.`);
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
  }, [session, profile, profileLoaded, signOut]);

  return null;
};

export default SessionTimeoutManager;
