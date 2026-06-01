import React from 'react';
import { Routes, Route } from 'react-router-dom';
import EscutaLanding from './EscutaLanding';
import NovaDenuncia from './NovaDenuncia';
import GestaoDenuncias from './GestaoDenuncias';

export default function EscutaSantaCasa() {
  return (
    <Routes>
      <Route path="/" element={<EscutaLanding />} />
      <Route path="/nova-denuncia" element={<NovaDenuncia />} />
      <Route path="/gestao" element={<GestaoDenuncias />} />
    </Routes>
  );
}
