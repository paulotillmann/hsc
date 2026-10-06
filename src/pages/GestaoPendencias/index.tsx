import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import GestaoPendencias from './GestaoPendencias';
import ConsultaFaturamentos from './ConsultaFaturamentos';
import RepassesMedicos from './RepassesMedicos';

const GestaoPendenciasRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<GestaoPendencias />} />
      <Route path="consulta-faturamentos" element={<ConsultaFaturamentos />} />
      <Route path="repasses-medicos" element={<RepassesMedicos />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default GestaoPendenciasRouter;
