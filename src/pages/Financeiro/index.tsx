import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Tesouraria from './Tesouraria';

const FinanceiroRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="tesouraria" element={<Tesouraria />} />
      <Route path="*" element={<Navigate to="tesouraria" replace />} />
    </Routes>
  );
};

export default FinanceiroRouter;
