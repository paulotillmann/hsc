import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import SessionTimeoutManager from './components/SessionTimeoutManager';
import PrivateRoute from './components/PrivateRoute';
import DynamicRoute from './components/DynamicRoute';
import Login from './pages/Login';
import UpdatePassword from './pages/UpdatePassword';
import Perfil from './pages/Perfil';
import Layout from './components/Layout';
import EtiquetaVisita from './pages/Recepcao/EtiquetaVisita';
import Totem from './pages/Senhas/Totem';
import PainelTV from './pages/Senhas/PainelTV';
import PainelAtendente from './pages/Senhas/PainelAtendente';
import PacientesInternados from './pages/PacientesInternados';
import CentroCirurgico from './pages/CentroCirurgico';
import OrdemServico from './pages/OrdemServico';
import OrdemServicoMobile from './pages/OrdemServicoMobile';
import ProntoAtendimento from './pages/ProntoAtendimento';
import PainelTVPA from './pages/ProntoAtendimento/PainelTVPA';
import EscutaLanding from './pages/EscutaSantaCasa/EscutaLanding';
import NovaDenuncia from './pages/EscutaSantaCasa/NovaDenuncia';

const App: React.FC = () => {
  // Configuração Global de Tema
  useEffect(() => {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark && !document.documentElement.classList.contains('light')) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <AuthProvider>
      <SessionTimeoutManager />
      <BrowserRouter>
        <Routes>
          {/* Rota pública: Login */}
          <Route path="/" element={<Login />} />
          <Route path="/update-password" element={<UpdatePassword />} />

          {/* Canal de Escuta Público e Formulário (Totalmente Públicos - Sem Login) */}
          <Route path="/escuta-santa-casa" element={<EscutaLanding />} />
          <Route path="/escuta-santa-casa/nova-denuncia" element={<NovaDenuncia />} />

          {/* Rotas protegidas — exigem sessão ativa */}
          <Route element={<PrivateRoute />}>

            {/* Rota de Impressão (Sem Layout da aplicação) */}
            <Route path="/imprimir/etiqueta/:id" element={<EtiquetaVisita />} />

            {/* Rotas de Senhas (Sem Layout) */}
            <Route path="/totem" element={<Totem />} />
            <Route path="/painel-tv" element={<PainelTV />} />

            {/* Rota de Pacientes Internados (Sem Layout) */}
            <Route path="/pacientes-internados" element={<PacientesInternados />} />

            {/* Rota de Centro Cirúrgico (Sem Layout) */}
            <Route path="/centro-cirurgico" element={<CentroCirurgico />} />

            {/* Rota de Ordem de Serviço (Sem Layout) */}
            <Route path="/ordem-servico" element={<OrdemServico />} />
            <Route path="/ordem-servico-mobile" element={<OrdemServicoMobile />} />

            {/* Rotas de Pronto Atendimento e Painel TV PA (Sem Layout) */}
            <Route path="/pronto-atendimento" element={<ProntoAtendimento />} />
            <Route path="/pronto-atendimento/tv" element={<PainelTVPA />} />
            <Route path="/painel-pa" element={<PainelTVPA />} />

            <Route element={<Layout />}>
              {/* Perfil: rota pública para qualquer usuário autenticado */}
              <Route path="/perfil" element={<Perfil />} />

              {/* Rota Painel Atendente de Senhas */}
              <Route path="/senhas-atendente" element={<PainelAtendente />} />

              {/* Rota dinâmica: resolve qualquer módulo cadastrado no banco */}
              {/* A permissão e o componente são resolvidos em DynamicRoute */}
              <Route path="/:moduleSlug/*" element={<DynamicRoute />} />
            </Route>
          </Route>

          {/* Fallback: qualquer rota desconhecida vai para login */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;