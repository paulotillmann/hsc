import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Tesouraria from './Tesouraria';
import PlantaoMedico from './PlantaoMedico';

const FinanceiroRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="tesouraria" element={<Tesouraria />} />
      <Route path="plantao-medico" element={<PlantaoMedico />} />
      <Route path="*" element={<Navigate to="tesouraria" replace />} />
    </Routes>
  );
};


export default FinanceiroRouter;
