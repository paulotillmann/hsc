import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import VisaoGeral from './VisaoGeral';
import Visitantes from './Visitantes';
import Terceiros from './Terceiros';

import VisitanteForm from './VisitanteForm';

const Recepcao: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<VisaoGeral />} />
      <Route path="/visitantes" element={<Visitantes />} />
      <Route path="/visitantes/novo" element={<VisitanteForm />} />
      <Route path="/visitantes/editar/:id" element={<VisitanteForm />} />
      <Route path="/terceiros" element={<Terceiros />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default Recepcao;
