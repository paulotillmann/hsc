import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import GestaoPendencias from './GestaoPendencias';
import ConsultaFaturamentos from './ConsultaFaturamentos';

const GestaoPendenciasRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<GestaoPendencias />} />
      <Route path="consulta-faturamentos" element={<ConsultaFaturamentos />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default GestaoPendenciasRouter;
