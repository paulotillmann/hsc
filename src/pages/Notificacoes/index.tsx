import React from 'react';
import { Routes, Route } from 'react-router-dom';
import NotificacoesList from './NotificacoesList';
import NotificacaoForm from './NotificacaoForm';

import NotificacoesGraficos from './NotificacoesGraficos';

const NotificacoesRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<NotificacoesList />} />
      <Route path="/graficos" element={<NotificacoesGraficos />} />
      <Route path="/nova" element={<NotificacaoForm />} />
      <Route path="/editar/:id" element={<NotificacaoForm />} />
    </Routes>
  );
};

export default NotificacoesRouter;
