import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import VisaoGeral from './VisaoGeral';
import CadastroSetorLeitos from './CadastroSetorLeitos';
import SetorForm from './SetorForm';
import LancamentoTaxas from './LancamentoTaxas';
import LancamentoTaxaForm from './LancamentoTaxaForm';
import Relatorios from './Relatorios';

const TaxaOcupacao: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<VisaoGeral />} />
      <Route path="cadastro-setor-leitos" element={<CadastroSetorLeitos />} />
      <Route path="cadastro-setor-leitos/novo" element={<SetorForm />} />
      <Route path="cadastro-setor-leitos/editar/:id" element={<SetorForm />} />
      <Route path="lancamento-taxas" element={<LancamentoTaxas />} />
      <Route path="lancamento-taxas/novo" element={<LancamentoTaxaForm />} />
      <Route path="lancamento-taxas/editar/:id" element={<LancamentoTaxaForm />} />
      <Route path="relatorios" element={<Relatorios />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default TaxaOcupacao;
