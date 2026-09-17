import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Calendar,
  Clock,
  Flame,
  Download,
  History,
  TrendingUp,
  Users,
  UserCheck,
  Check,
  Loader2,
  Image as ImageIcon,
  LayoutDashboard,
  Save,
  ChevronDown
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine
} from 'recharts';
import { toPng } from 'html-to-image';
import { tasySnapshotService, TasyDailySnapshot, SlotSnapshot } from '../../services/tasySnapshotService';

interface TasySnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDataForSave?: {
    total: number;
    picoQtd: number;
    picoHora: string;
    mediaFormatada: string;
    mediaMinutos?: number;
    slots: SlotSnapshot[];
    usuarios: any[];
  };
}

export const TasySnapshotModal: React.FC<TasySnapshotModalProps> = ({
  isOpen,
  onClose,
  currentDataForSave
}) => {
  const [snapshots, setSnapshots] = useState<TasyDailySnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<TasyDailySnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingManual, setSavingManual] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'image'>('dashboard');
  const [exportingPng, setExportingPng] = useState<boolean>(false);

  const snapshotRef = useRef<HTMLDivElement>(null);

  // Carrega a lista de snapshots ao abrir o modal
  useEffect(() => {
    if (!isOpen) return;

    const loadSnapshots = async () => {
      setLoading(true);
      try {
        const list = await tasySnapshotService.listarSnapshots();
        setSnapshots(list);
        if (list.length > 0) {
          setSelectedSnapshot(list[0]);
        } else {
          setSelectedSnapshot(null);
        }
      } catch (err) {
        console.error('Erro ao carregar snapshots:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSnapshots();
  }, [isOpen]);

  if (!isOpen) return null;

  // Formata data YYYY-MM-DD para DD/MM/YYYY
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Exportar imagem PNG do dashboard do snapshot
  const handleDownloadPng = async () => {
    if (!snapshotRef.current || !selectedSnapshot) return;
    setExportingPng(true);
    try {
      const dataUrl = await toPng(snapshotRef.current, {
        cacheBust: true,
        backgroundColor: '#0f172a',
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = `Tasy_Fechamento_${selectedSnapshot.data_referencia}_2350.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao gerar print PNG:', err);
    } finally {
      setExportingPng(false);
    }
  };

  // Salvar snapshot atual (sob demanda / teste)
  const handleSaveCurrentSnapshot = async () => {
    if (!currentDataForSave) return;
    setSavingManual(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const totalLicencas = 150;
      const ativas = currentDataForSave.total;
      const percentOcupacao = Math.min(Math.round((ativas / totalLicencas) * 100), 100);

      const newSnapshot: TasyDailySnapshot = {
        data_referencia: today,
        total_conectados: currentDataForSave.total,
        pico_quantidade: currentDataForSave.picoQtd || currentDataForSave.total,
        pico_horario: currentDataForSave.picoHora || '-',
        percentual_ocupacao: percentOcupacao,
        media_tempo_formatada: currentDataForSave.mediaFormatada,
        media_tempo_minutos: currentDataForSave.mediaMinutos || 0,
        historico_slots: currentDataForSave.slots,
        usuarios_lista: currentDataForSave.usuarios
      };

      const saved = await tasySnapshotService.salvarSnapshot(newSnapshot);
      if (saved) {
        setSnapshots(prev => {
          const filtered = prev.filter(s => s.data_referencia !== today);
          return [saved, ...filtered];
        });
        setSelectedSnapshot(saved);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Erro ao salvar snapshot:', err);
    } finally {
      setSavingManual(false);
    }
  };

  // Encontra o slot de pico no snapshot selecionado
  const peakSlot = selectedSnapshot?.historico_slots?.find(s => s.isPeak) ||
    (selectedSnapshot && selectedSnapshot.historico_slots?.length > 0
      ? selectedSnapshot.historico_slots.reduce((max, s) => (s.quant > max.quant ? s : max), selectedSnapshot.historico_slots[0])
      : null);

  const totalLicencas = 150;
  const ativas = selectedSnapshot?.total_conectados || 0;
  const percentOcupacao = selectedSnapshot?.percentual_ocupacao || Math.min(Math.round((ativas / totalLicencas) * 100), 100);
  const livres = Math.max(totalLicencas - ativas, 0);

  const isCritical = percentOcupacao > 90;
  const isWarning = percentOcupacao >= 50 && percentOcupacao <= 90;
  const statusColor = isCritical
    ? 'text-rose-500 bg-rose-500/10 border-rose-500/20'
    : isWarning
      ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
      : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';

  const barColor = isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';
  const needleAngle = (percentOcupacao / 100) * 180 - 90;
  const arcLength = (percentOcupacao / 100) * 44;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Histórico de Fechamento Diário (Prints das 23:50)
              </h2>
              <p className="text-xs text-muted-foreground">
                Fotografia consolidada e automática gravada diariamente às 23:50 no ERP Tasy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão de Fechar */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Toolbar (Seleção de Data e Ações) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-border/60 bg-background/50">
          {/* Seletor de Data */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground">Data do Fechamento:</span>
            {snapshots.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedSnapshot?.data_referencia || ''}
                  onChange={(e) => {
                    const found = snapshots.find(s => s.data_referencia === e.target.value);
                    if (found) setSelectedSnapshot(found);
                  }}
                  className="pl-3 pr-8 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer appearance-none [&>option]:bg-card [&>option]:text-card-foreground dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
                >
                  {snapshots.map(s => (
                    <option key={s.data_referencia} value={s.data_referencia}>
                      {formatDateDisplay(s.data_referencia)} • 23:50 (Pico: {s.pico_quantidade} às {s.pico_horario})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">Nenhum registro gravado</span>
            )}
          </div>

          {/* Ações / Modos */}
          <div className="flex items-center gap-2 flex-wrap">
            {selectedSnapshot?.image_url && (
              <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs">
                <button
                  onClick={() => setViewMode('dashboard')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                    viewMode === 'dashboard'
                      ? 'bg-card text-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => setViewMode('image')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                    viewMode === 'image'
                      ? 'bg-card text-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Print Original</span>
                </button>
              </div>
            )}

            {/* Exportar PNG */}
            {selectedSnapshot && (
              <button
                onClick={handleDownloadPng}
                disabled={exportingPng}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50"
                title="Baixar print do snapshot em PNG de alta resolução"
              >
                {exportingPng ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-emerald-500" />
                )}
                <span>Baixar Print PNG</span>
              </button>
            )}

            {/* Salvar Snapshot de Hoje Agora */}
            {currentDataForSave && (
              <button
                onClick={handleSaveCurrentSnapshot}
                disabled={savingManual}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-xs font-semibold border border-primary/20 transition-all active:scale-95 disabled:opacity-50"
                title="Gravar fotografia atual como snapshot do dia no Supabase"
              >
                {savingManual ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>{saveSuccess ? 'Gravado!' : 'Gravar Snapshot Atual'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando snapshots do Supabase...</p>
            </div>
          ) : !selectedSnapshot ? (
            <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-dashed border-border bg-background/40 text-center space-y-3">
              <History className="h-10 w-10 text-muted-foreground/60" />
              <h3 className="text-base font-bold text-foreground">Nenhum snapshot das 23:50 registrado ainda</h3>
              <p className="text-xs text-muted-foreground max-w-md">
                O fluxo automático agendado no n8n ou no Supabase salvará os dados e o print todos os dias às 23:50 automaticamente.
              </p>
              {currentDataForSave && (
                <button
                  onClick={handleSaveCurrentSnapshot}
                  disabled={savingManual}
                  className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow hover:bg-primary/90 transition-all"
                >
                  <Save className="h-4 w-4" />
                  <span>Gravar Primeiro Snapshot com Dados Atuais</span>
                </button>
              )}
            </div>
          ) : viewMode === 'image' && selectedSnapshot.image_url ? (
            /* Visualização da Imagem Salva */
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border overflow-hidden bg-slate-950 p-2">
              <img
                src={selectedSnapshot.image_url}
                alt={`Print Fechamento ${selectedSnapshot.data_referencia}`}
                className="w-full h-auto object-contain rounded-xl max-h-[65vh]"
              />
            </div>
          ) : (
            /* Visualização do Dashboard do Snapshot */
            <div ref={snapshotRef} className="space-y-6 p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
              
              {/* Snapshot Header Info */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold text-foreground font-sans">
                    Fotografia de Fechamento • {formatDateDisplay(selectedSnapshot.data_referencia)} às 23:50
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2.5 py-1 rounded-md border border-border/40">
                  {selectedSnapshot.historico_slots?.length || 0} intervalos de 10 min capturados
                </span>
              </div>

              {/* KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Conectados */}
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/50 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Usuários Conectados
                    </p>
                    <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
                      <Users className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-foreground">
                      {selectedSnapshot.total_conectados}
                    </span>
                    <span className="text-xs text-muted-foreground">sessões às 23:50</span>
                  </div>
                </div>

                {/* Ocupação de Licenças */}
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/50 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Ocupação de Licenças
                    </p>
                    <div className={`p-1.5 rounded-lg border ${statusColor} flex items-center justify-center`}>
                      <svg viewBox="0 0 40 24" className="w-5 h-3.5 overflow-visible">
                        <path d="M 6 20 A 14 14 0 0 1 34 20" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.2" strokeLinecap="round" />
                        <path d="M 6 20 A 14 14 0 0 1 34 20" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${arcLength} 100`} strokeLinecap="round" />
                        <line x1="20" y1="20" x2="20" y2="7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ transformOrigin: '20px 20px', transform: `rotate(${needleAngle}deg)` }} />
                        <circle cx="20" cy="20" r="2.5" fill="currentColor" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-foreground">{percentOcupacao}%</span>
                    <span className="text-xs text-muted-foreground">({ativas} de {totalLicencas})</span>
                  </div>
                  <div className="mt-2 w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percentOcupacao}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                    <span>{livres} disponíveis</span>
                    <span className="font-mono">150 contratadas</span>
                  </div>
                </div>

                {/* Média de Tempo Logado */}
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/50 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Média de Tempo Logado
                    </p>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <Clock className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-foreground">
                      {selectedSnapshot.media_tempo_formatada || '-'}
                    </span>
                    <span className="text-xs text-muted-foreground">por sessão</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <UserCheck className="h-3 w-3 text-emerald-500" />
                    <span>Duração calculada</span>
                  </div>
                </div>

                {/* Pico Simultâneo do Dia */}
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/50 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Pico Simultâneo do Dia
                    </p>
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-foreground">
                      {selectedSnapshot.pico_quantidade}
                    </span>
                    <span className="text-xs text-muted-foreground">sessões máximas</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    <Flame className="h-3 w-3 text-amber-500" />
                    <span>Registrado às {selectedSnapshot.pico_horario}</span>
                  </div>
                </div>
              </div>

              {/* HISTÓRICO DE CONEXÕES POR INTERVALO (GRÁFICO COM 150 LICENÇAS E PICO + TABELA) */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2.5">
                    <History className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-sm font-bold text-foreground">
                      Curva de Conexões de 24h e Tabela de Intervalos
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                    Pico: {selectedSnapshot.pico_quantidade} sessões ({selectedSnapshot.pico_horario})
                  </span>
                </div>

                {selectedSnapshot.historico_slots && selectedSnapshot.historico_slots.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Gráfico */}
                    <div className="lg:col-span-7 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                        <span>00:00</span>
                        <span>23:50</span>
                      </div>
                      <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={selectedSnapshot.historico_slots} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="snapshotColorQuant" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                            <XAxis dataKey="hora" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={20} />
                            <YAxis tick={{ fontSize: 10 }} domain={[0, (dataMax: number) => Math.max(dataMax + 10, 160)]} />
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload as SlotSnapshot;
                                  return (
                                    <div className="bg-slate-900/95 border border-slate-700/60 backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-xl text-white text-xs space-y-1">
                                      <p className="font-bold text-slate-100">{data.diaMes} às {data.hora}</p>
                                      <p className="text-indigo-400 font-mono font-bold">{data.quant} conexões ativas</p>
                                      {data.isPeak && <p className="text-amber-300 font-semibold">Pico do dia!</p>}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />

                            {/* Linha Horizontal de Limite de 150 Licenças */}
                            <ReferenceLine
                              y={150}
                              stroke="#f43f5e"
                              strokeDasharray="4 4"
                              strokeWidth={1.5}
                              label={{
                                value: 'Limite 150 Licenças',
                                position: 'top',
                                fill: '#f43f5e',
                                fontSize: 10,
                                fontWeight: 600
                              }}
                            />

                            {/* Linha Vertical no Momento do Pico */}
                            {peakSlot && peakSlot.quant > 0 && (
                              <ReferenceLine
                                x={peakSlot.hora}
                                stroke="#f59e0b"
                                strokeDasharray="3 3"
                                strokeWidth={1.5}
                                label={{
                                value: `Pico: ${peakSlot.quant} (${peakSlot.hora})`,
                                position: 'insideTopLeft',
                                fill: '#f59e0b',
                                fontSize: 10,
                                fontWeight: 600
                              }}
                            />
                            )}

                            <Area
                              type="monotone"
                              dataKey="quant"
                              stroke="#6366f1"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#snapshotColorQuant)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Tabela de Intervalos */}
                    <div className="lg:col-span-5 space-y-2">
                      <div className="border border-border/60 rounded-xl overflow-hidden bg-background/40 max-h-[255px] overflow-y-auto custom-scrollbar shadow-inner">
                        <table className="w-full text-xs font-sans text-left border-collapse">
                          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm text-muted-foreground font-semibold uppercase tracking-wider text-[10px] border-b border-border">
                            <tr>
                              <th className="py-2.5 px-3">Dia/Mês</th>
                              <th className="py-2.5 px-3">Hora</th>
                              <th className="py-2.5 px-3 text-right">Quant.</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {[...selectedSnapshot.historico_slots].reverse().map((slot, idx) => (
                              <tr key={idx} className={slot.isPeak ? 'bg-amber-500/10 font-medium' : 'hover:bg-muted/40'}>
                                <td className="py-2 px-3 text-foreground font-mono">{slot.diaMes}</td>
                                <td className="py-2 px-3 font-mono font-bold text-foreground">{slot.hora}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{slot.quant}</td>
                                <td className="py-2 px-3 text-center">
                                  {slot.isPeak ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                      <Flame className="h-2.5 w-2.5" />
                                      Pico
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground font-mono">OK</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-4">
                    Nenhum intervalo registrado neste snapshot.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border/80 bg-muted/30 text-xs text-muted-foreground">
          <span>
            {selectedSnapshot
              ? `Exibindo snapshot gravado em ${selectedSnapshot.created_at ? new Date(selectedSnapshot.created_at).toLocaleString('pt-BR') : formatDateDisplay(selectedSnapshot.data_referencia)}`
              : 'Nenhum snapshot selecionado'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
