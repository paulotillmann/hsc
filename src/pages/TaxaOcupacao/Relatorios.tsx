import React from 'react';
import { BarChart3 } from 'lucide-react';

const Relatorios: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          Relatórios de Ocupação
        </h1>
        <p className="text-muted-foreground">
          Extração de dados e gráficos sobre a ocupação hospitalar.
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

export default Relatorios;
