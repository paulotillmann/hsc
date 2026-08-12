import React, { useState } from 'react';
import { Calendar, RefreshCw, ChevronDown, Check } from 'lucide-react';
import { PeriodOption, DateRange } from './types';

interface DashboardHeaderProps {
  period: PeriodOption;
  onPeriodChange: (p: PeriodOption) => void;
  customRange?: DateRange;
  onCustomRangeChange: (range: DateRange) => void;
  npsFilter: 'all' | 'promoter' | 'neutral' | 'detractor';
  onNpsFilterChange: (f: 'all' | 'promoter' | 'neutral' | 'detractor') => void;
  onRefresh: () => void;
  loading: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  period,
  onPeriodChange,
  customRange,
  onCustomRangeChange,
  npsFilter,
  onNpsFilterChange,
  onRefresh,
  loading
}) => {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [tempStart, setTempStart] = useState(customRange?.startDate || '');
  const [tempEnd, setTempEnd] = useState(customRange?.endDate || '');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const periodLabels: Record<PeriodOption, string> = {
    today: 'Hoje',
    yesterday: 'Ontem',
    '7d': 'Últimos 7 dias',
    '30d': 'Últimos 30 dias',
    this_month: 'Este mês',
    last_month: 'Mês anterior',
    this_year: 'Este ano',
    custom: 'Período personalizado'
  };

  const handleSelectPeriod = (p: PeriodOption) => {
    setDropdownOpen(false);
    if (p === 'custom') {
      setShowCustomModal(true);
    } else {
      onPeriodChange(p);
    }
  };

  const handleApplyCustom = () => {
    if (tempStart && tempEnd) {
      onCustomRangeChange({ startDate: tempStart, endDate: tempEnd });
      onPeriodChange('custom');
      setShowCustomModal(false);
    }
  };

  return (
    <div className="w-full bg-card rounded-2xl border border-border px-6 py-5 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              Gestão da Pesquisa NPS
            </h1>
            <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              Ao vivo
            </span>
          </div>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Indicadores de experiência e satisfação dos usuários no hospital
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs md:text-sm px-3.5 py-2 rounded-xl transition-all cursor-pointer border border-border"
            >
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{periodLabels[period]}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-card rounded-2xl shadow-xl border border-border py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                {(Object.keys(periodLabels) as PeriodOption[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelectPeriod(p)}
                    className={`w-full text-left px-4 py-2 text-xs md:text-sm flex items-center justify-between transition-colors cursor-pointer ${
                      period === p
                        ? 'bg-muted text-foreground font-bold'
                        : 'text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span>{periodLabels[p]}</span>
                    {period === p && <Check className="w-4 h-4 text-emerald-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center bg-muted p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => onNpsFilterChange('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                npsFilter === 'all'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => onNpsFilterChange('promoter')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                npsFilter === 'promoter'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-900'
              }`}
            >
              Promotores
            </button>
            <button
              type="button"
              onClick={() => onNpsFilterChange('neutral')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                npsFilter === 'neutral'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-700 dark:text-amber-400 hover:text-amber-900'
              }`}
            >
              Neutros
            </button>
            <button
              type="button"
              onClick={() => onNpsFilterChange('detractor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                npsFilter === 'detractor'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 dark:text-rose-400 hover:text-rose-900'
              }`}
            >
              Detratores
            </button>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded-xl transition-all cursor-pointer border border-border disabled:opacity-50"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {showCustomModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-border space-y-4">
            <h3 className="text-lg font-bold text-foreground">Selecionar Intervalo Personalizado</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={tempStart}
                  onChange={(e) => setTempStart(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Data Final
                </label>
                <input
                  type="date"
                  value={tempEnd}
                  onChange={(e) => setTempEnd(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyCustom}
                disabled={!tempStart || !tempEnd}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                Aplicar Filtro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
