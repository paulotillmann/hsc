import React from 'react';
import { Users } from 'lucide-react';

const VisaoGeral: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Users className="h-6 w-6 text-primary" />
          </div>
          Recepção: Visão Geral
        </h1>
        <p className="text-muted-foreground">
          Acompanhe os dados de visitas, visitantes e prestadores em tempo real.
        </p>
      </div>
      
      <div className="flex flex-1 items-center justify-center border-2 border-dashed rounded-lg p-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Módulo em Construção</h2>
          <p className="text-muted-foreground max-w-sm">
            O banco de dados e as funcionalidades principais serão implementadas em breve.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VisaoGeral;
