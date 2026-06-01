import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import GestaoDenuncias from './GestaoDenuncias';

export default function EscutaSantaCasa() {
  return (
    <Routes>
      <Route path="/" element={<GestaoDenuncias />} />
      <Route path="/gestao" element={<GestaoDenuncias />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
