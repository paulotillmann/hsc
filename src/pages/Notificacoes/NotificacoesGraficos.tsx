import React from 'react';
import { motion } from 'framer-motion';

export default function NotificacoesGraficos() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 w-full px-[40px] max-w-none"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Gráficos de Notificações</h1>
          <p className="text-sm text-muted-foreground">Visão analítica dos registros epidemiológicos</p>
        </div>
      </div>
      
      <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-muted-foreground">Em Construção</h2>
          <p className="text-sm text-muted-foreground">Painel de gráficos será implementado aqui.</p>
        </div>
      </div>
    </motion.div>
  );
}
