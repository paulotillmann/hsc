import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, CheckCircle2, AlertCircle, Database, Pause, Play, RotateCcw, Calendar } from 'lucide-react';

interface BubbleSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface SyncPhaseState {
  phase: string;
  status: string;
  last_cursor: number;
  total_processed: number;
  total_skipped: number;
}

const PHASES = ['setores', 'leitos', 'ocupacao_dia', 'ocupacao_dia_setor_leito'] as const;
type Phase = typeof PHASES[number];

const PHASE_LABELS: Record<Phase, string> = {
  setores: 'Setores',
  leitos: 'Leitos',
  ocupacao_dia: 'Ocupação Dia',
  ocupacao_dia_setor_leito: 'Ocupação Dia / Leito',
};

const BUBBLE_BASE = 'https://hsc.santacasaaraguari.org.br/version-test/api/1.1/obj';
const BUBBLE_TOKEN = '6cef9c22a917ef1a16aff85793284e7b';

export function BubbleSyncModal({ isOpen, onClose, onSuccess }: BubbleSyncModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [counts, setCounts] = useState<Record<string, { processed: number; skipped: number }>>({});
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressPhase, setProgressPhase] = useState('');

  // Pause/Resume
  const shouldStopRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasPausedState, setHasPausedState] = useState(false);
  const [pausedPhaseLabel, setPausedPhaseLabel] = useState('');
  const [checkingState, setCheckingState] = useState(true);

  // Date filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (isOpen) {
      checkPausedState();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ==========================================
  // SYNC STATE HELPERS
  // ==========================================

  async function checkPausedState() {
    setCheckingState(true);
    try {
      const { data } = await supabase.from('sync_bubble_state').select('*').eq('status', 'paused');
      if (data && data.length > 0) {
        setHasPausedState(true);
        setPausedPhaseLabel(PHASE_LABELS[data[0].phase as Phase] || data[0].phase);
      } else {
        setHasPausedState(false);
        setPausedPhaseLabel('');
      }
    } catch (e) { console.error(e); }
    finally { setCheckingState(false); }
  }

  async function loadSyncStates(): Promise<Record<string, SyncPhaseState>> {
    const { data } = await supabase.from('sync_bubble_state').select('*');
    const map: Record<string, SyncPhaseState> = {};
    data?.forEach(row => { map[row.phase] = row; });
    return map;
  }

  async function saveSyncState(phase: string, status: string, lastCursor: number, totalProcessed: number, totalSkipped: number) {
    await supabase.from('sync_bubble_state').upsert({
      phase, status, last_cursor: lastCursor,
      total_processed: totalProcessed, total_skipped: totalSkipped,
      updated_at: new Date().toISOString()
    }, { onConflict: 'phase' });
  }

  async function clearSyncStates() {
    await supabase.from('sync_bubble_state').delete().neq('phase', '');
  }

  // ==========================================
  // BUBBLE API HELPERS
  // ==========================================

  function buildConstraints(dateField: string): string {
    if (!dateFrom && !dateTo) return '';
    const constraints: any[] = [];
    if (dateFrom) constraints.push({ key: dateField, constraint_type: 'greater than', value: `${dateFrom}T00:00:00.000Z` });
    if (dateTo) constraints.push({ key: dateField, constraint_type: 'less than', value: `${dateTo}T23:59:59.999Z` });
    return `&constraints=${encodeURIComponent(JSON.stringify(constraints))}`;
  }

  async function fetchBubblePage(tableName: string, cursor: number, constraintsStr: string = '', limit: number = 100) {
    const url = `${BUBBLE_BASE}/${tableName}?cursor=${cursor}&limit=${limit}${constraintsStr}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${BUBBLE_TOKEN}`, 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(`Erro API Bubble (${tableName}): ${response.status}`);
    const data = await response.json();
    if (!data.response?.results) throw new Error(`Resposta inesperada da API (${tableName}).`);
    return { results: data.response.results as any[], remaining: data.response.remaining as number };
  }

  async function fetchAllBubbleData(tableName: string) {
    let all: any[] = [], cursor = 0, hasMore = true;
    while (hasMore) {
      const page = await fetchBubblePage(tableName, cursor);
      all = [...all, ...page.results];
      if (page.remaining > 0) cursor += page.results.length; else hasMore = false;
    }
    return all;
  }

  // ==========================================
  // SYNC LOGIC
  // ==========================================

  function updateCount(phase: string, processed: number, skipped: number) {
    setCounts(prev => ({ ...prev, [phase]: { processed, skipped } }));
  }

  async function handleSync(resume: boolean) {
    try {
      setLoading(true); setIsPaused(false); setError(null); setSuccess(false);
      shouldStopRef.current = false; setCounts({}); setProgressPercent(0);

      let states: Record<string, SyncPhaseState> = {};
      if (resume) { states = await loadSyncStates(); } else { await clearSyncStates(); }

      // === PHASE 1: SETORES ===
      setProgressPhase('Setores'); setStatusText('Baixando setores...'); setProgressPercent(2);
      const bubbleSectors = await fetchAllBubbleData('HSC_Setor');
      if (bubbleSectors.length > 0) {
        const mapped = bubbleSectors.map((s: any) => {
          let tipo = s.LeitosTipo || null;
          if (tipo === 'Particular ou Convênio') tipo = 'Particular ou convênio';
          return {
            bubble_id: s._id, nome_setor: s.Nome || 'Sem Nome', nome_identificacao: s.NomeIdentificacao || null,
            total_leitos: s.TotalLeitos || 0, total_leitos_sus: s.TotalLeitosSUS || 0,
            ativo: s.ativo !== undefined ? s.ativo : true, calcular_taxa: s.CalculaTaxaEm || null,
            leitos_tipo: tipo, updated_at: new Date().toISOString()
          };
        });
        const { error: err } = await supabase.from('taxa_setores').upsert(mapped, { onConflict: 'bubble_id' });
        if (err) throw err;
        updateCount('setores', mapped.length, 0);
      }
      await saveSyncState('setores', 'completed', 0, bubbleSectors.length, 0);
      setProgressPercent(5);
      if (shouldStopRef.current) { await doPause('setores', 0, 0, 0); return; }

      // === PHASE 2: MAP SETORES UUID ===
      setStatusText('Mapeando setores...');
      const { data: supSectors } = await supabase.from('taxa_setores').select('id, bubble_id').not('bubble_id', 'is', null);
      const sectorMap: Record<string, string> = {};
      supSectors?.forEach(s => { sectorMap[s.bubble_id] = s.id; });
      setProgressPercent(8);

      // === PHASE 3: LEITOS ===
      setProgressPhase('Leitos'); setStatusText('Baixando leitos...');
      const bubbleBeds = await fetchAllBubbleData('HSC_Leitos');
      if (bubbleBeds.length > 0) {
        const mapped = bubbleBeds.filter((b: any) => b.Setor && sectorMap[b.Setor]).map((b: any) => ({
          bubble_id: b._id, setor_id: sectorMap[b.Setor], nome_leito: b.Nome || 'Leito S/N',
          nome_identificacao: b.NomeIdentificacao || null, padrao: b.Padrao === true,
          qtd_leitos: b.QtdeLeitos ?? 1, qtd_leitos_sus: b.QtdeLeitosSUS ?? 0, updated_at: new Date().toISOString()
        }));
        if (mapped.length > 0) {
          const { error: err } = await supabase.from('taxa_leitos').upsert(mapped, { onConflict: 'bubble_id' });
          if (err) throw err;
          updateCount('leitos', mapped.length, bubbleBeds.length - mapped.length);
        }
      }
      await saveSyncState('leitos', 'completed', 0, bubbleBeds.length, 0);
      setProgressPercent(12);
      if (shouldStopRef.current) { await doPause('leitos', 0, 0, 0); return; }

      // === PHASE 4: OCUPAÇÃO DIA (incremental, filtro por período) ===
      const p4 = states['ocupacao_dia'];
      const skipP4 = p4?.status === 'completed';
      const constraintsOcupacao = buildConstraints('Data');

      if (!skipP4) {
        setProgressPhase('Ocupação Dia');
        const startCursor = (resume && p4?.status === 'paused') ? p4.last_cursor : 0;
        let proc = (resume && p4?.status === 'paused') ? p4.total_processed : 0;
        let skip = (resume && p4?.status === 'paused') ? p4.total_skipped : 0;
        let cursor = startCursor, hasMore = true;

        while (hasMore && !shouldStopRef.current) {
          const page = await fetchBubblePage('HSC_OcupacaoDia', cursor, constraintsOcupacao);
          if (page.results.length === 0) { hasMore = false; break; }
          const valid = page.results.filter((o: any) => o.Setor && o.HorarioEnvio && sectorMap[o.Setor]);
          const mapped = valid.map((o: any) => ({
            bubble_id: o._id, data: o.Data ? o.Data.split('T')[0] : null,
            setor_id: sectorMap[o.Setor], horario_envio: o.HorarioEnvio,
            total_leitos: o.TotalLeitos || 0, total_leitos_sus: o.TotalLeitosSUS || 0, created_by: null,
          })).filter((o: any) => o.data !== null);

          if (mapped.length > 0) {
            const { error: err } = await supabase.from('taxa_ocupacao_dia').upsert(mapped, { onConflict: 'bubble_id' });
            if (err) throw err;
          }
          proc += mapped.length; skip += page.results.length - mapped.length;
          cursor += page.results.length;
          updateCount('ocupacao_dia', proc, skip);
          const est = proc + skip + page.remaining;
          setProgressPercent(Math.min(12 + Math.round(((proc + skip) / est) * 23), 35));
          setStatusText(`Ocupação Dia: ${proc.toLocaleString('pt-BR')} importados, ${skip.toLocaleString('pt-BR')} ignorados`);
          await saveSyncState('ocupacao_dia', 'in_progress', cursor, proc, skip);
          if (page.remaining <= 0) hasMore = false;
        }
        if (shouldStopRef.current) { await doPause('ocupacao_dia', cursor, proc, skip); return; }
        await saveSyncState('ocupacao_dia', 'completed', cursor, proc, skip);
      } else { updateCount('ocupacao_dia', p4.total_processed, p4.total_skipped); }
      setProgressPercent(35);

      // === PHASE 5: LOAD UUID MAPS ===
      setStatusText('Carregando mapas de relacionamento...');
      const ocupacaoMap: Record<string, string> = {};
      let ocCur = 0, ocMore = true;
      while (ocMore) {
        const { data: rows, error: err } = await supabase
          .from('taxa_ocupacao_dia').select('id, bubble_id').not('bubble_id', 'is', null).range(ocCur, ocCur + 999);
        if (err) throw err;
        if (!rows || rows.length === 0) { ocMore = false; break; }
        rows.forEach(r => { ocupacaoMap[r.bubble_id] = r.id; });
        ocCur += rows.length;
        if (rows.length < 1000) ocMore = false;
      }
      const leitoMap: Record<string, string> = {};
      const leitoPadraoMap: Record<string, boolean> = {};
      const { data: leitoRows } = await supabase.from('taxa_leitos').select('id, bubble_id, padrao').not('bubble_id', 'is', null);
      leitoRows?.forEach(r => { 
        leitoMap[r.bubble_id] = r.id; 
        leitoPadraoMap[r.bubble_id] = r.padrao;
      });
      setProgressPercent(38);

      // === PHASE 6: SETOR LEITO (incremental, filtro por Created Date) ===
      const p5 = states['ocupacao_dia_setor_leito'];
      const skipP5 = p5?.status === 'completed';
      const constraintsDetail = buildConstraints('Created Date');

      if (!skipP5) {
        setProgressPhase('Ocupação Dia / Leito');
        const startCursor = (resume && p5?.status === 'paused') ? p5.last_cursor : 0;
        let proc = (resume && p5?.status === 'paused') ? p5.total_processed : 0;
        let skip = (resume && p5?.status === 'paused') ? p5.total_skipped : 0;
        let cursor = startCursor, hasMore = true;

        while (hasMore && !shouldStopRef.current) {
          const page = await fetchBubblePage('HSC_OcupacaoDiaSetorLeito', cursor, constraintsDetail);
          if (page.results.length === 0) { hasMore = false; break; }
          const valid = page.results.filter((r: any) =>
            r.OcupacaoDia && r.Leito && ocupacaoMap[r.OcupacaoDia] && leitoMap[r.Leito]
          );
          const mapped = valid.map((r: any) => ({
            bubble_id: r._id, ocupacao_dia_id: ocupacaoMap[r.OcupacaoDia],
            leito_id: leitoMap[r.Leito], padrao: leitoPadraoMap[r.Leito] ?? false,
            qtd_leitos_dia: r.QtdeLeitoDiaHSC ?? 0, qtd_leitos_sus: r.QtdeLeitoDiaSUS ?? 0,
          }));

          if (mapped.length > 0) {
            const { error: err } = await supabase.from('taxa_ocupacao_dia_setor_leito').upsert(mapped, { onConflict: 'bubble_id' });
            if (err) throw err;
          }
          proc += mapped.length; skip += page.results.length - mapped.length;
          cursor += page.results.length;
          updateCount('ocupacao_dia_setor_leito', proc, skip);
          const est = proc + skip + page.remaining;
          setProgressPercent(Math.min(38 + Math.round(((proc + skip) / est) * 60), 98));
          setStatusText(`Detalhe Leitos: ${proc.toLocaleString('pt-BR')} importados, ${skip.toLocaleString('pt-BR')} ignorados`);
          await saveSyncState('ocupacao_dia_setor_leito', 'in_progress', cursor, proc, skip);
          if (page.remaining <= 0) hasMore = false;
        }
        if (shouldStopRef.current) { await doPause('ocupacao_dia_setor_leito', cursor, proc, skip); return; }
        await saveSyncState('ocupacao_dia_setor_leito', 'completed', cursor, proc, skip);
      } else { updateCount('ocupacao_dia_setor_leito', p5.total_processed, p5.total_skipped); }

      // === DONE ===
      setProgressPercent(100); setStatusText(''); setProgressPhase('');
      setSuccess(true); setHasPausedState(false);
      await clearSyncStates();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error syncing:', err);
      setError(err.message || 'Erro desconhecido durante a sincronização.');
      setStatusText(''); setProgressPhase('');
    } finally { setLoading(false); }
  }

  async function doPause(phase: string, cursor: number, processed: number, skipped: number) {
    await saveSyncState(phase, 'paused', cursor, processed, skipped);
    setIsPaused(true); setLoading(false); setHasPausedState(true);
    setPausedPhaseLabel(PHASE_LABELS[phase as Phase] || phase);
    setStatusText(`Pausado em: ${PHASE_LABELS[phase as Phase] || phase}`);
  }

  function handlePauseClick() {
    shouldStopRef.current = true;
    setStatusText('Finalizando lote atual e pausando...');
  }

  const showDateFilter = !loading && !success;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-xl border shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Database className="w-5 h-5 text-primary" />
            <h2>Integração Bubble.io</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted" disabled={loading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Sincronização em cadeia:
            <strong className="text-foreground"> Setores</strong> →
            <strong className="text-foreground"> Leitos</strong> →
            <strong className="text-foreground"> Ocupação Dia</strong> →
            <strong className="text-foreground"> Detalhe por Leito</strong>.
          </p>

          {/* Date filter */}
          {showDateFilter && (
            <div className="bg-muted/20 border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                Filtro por Período (opcional)
              </div>
              <p className="text-xs text-muted-foreground">
                Se informado, as fases de Ocupação serão filtradas pelo período. Setores e Leitos são sempre sincronizados por completo.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Data Início</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Data Fim</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
                </div>
              </div>
            </div>
          )}

          {/* Paused banner */}
          {!loading && hasPausedState && !success && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex gap-3">
              <Pause className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-foreground/80">
                Sincronização pausada em <strong>"{pausedPhaseLabel}"</strong>.
              </div>
            </div>
          )}

          {!loading && !hasPausedState && !success && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm text-foreground/80">
                Registros existentes serão atualizados. Ocupações sem Setor ou Horário serão ignoradas. Você pode pausar a qualquer momento.
              </div>
            </div>
          )}

          {/* Progress */}
          {(loading || isPaused) && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-foreground">{progressPhase && `Fase: ${progressPhase}`}</span>
                <span className="text-muted-foreground font-mono">{progressPercent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ease-out ${isPaused ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${progressPercent}%` }} />
              </div>
              {statusText && (
                <p className={`text-xs text-center ${isPaused ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground animate-pulse'}`}>
                  {statusText}
                </p>
              )}
            </div>
          )}

          {/* Counters */}
          {(loading || isPaused || success) && Object.keys(counts).length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(counts).map(([phase, { processed, skipped }]) => (
                <div key={phase} className="bg-muted/30 border rounded-md px-3 py-2">
                  <div className="font-semibold text-foreground truncate">{PHASE_LABELS[phase as Phase] || phase}</div>
                  <div className="text-muted-foreground">
                    {processed.toLocaleString('pt-BR')} importados
                    {skipped > 0 && <span className="text-amber-600 dark:text-amber-400"> · {skipped.toLocaleString('pt-BR')} ignorados</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3">{error}</div>}
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm rounded-lg p-3 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-5 h-5" /> Sincronização concluída!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground bg-background border hover:bg-muted transition-colors rounded-md disabled:opacity-50" disabled={loading}>Fechar</button>

          {loading && (
            <button onClick={handlePauseClick}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors rounded-md">
              <Pause className="w-4 h-4" /> Pausar
            </button>
          )}

          {!loading && hasPausedState && !success && (
            <>
              <button onClick={() => handleSync(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-background border hover:bg-muted transition-colors rounded-md">
                <RotateCcw className="w-4 h-4" /> Recomeçar
              </button>
              <button onClick={() => handleSync(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors rounded-md min-w-[160px] justify-center">
                <Play className="w-4 h-4" /> Continuar
              </button>
            </>
          )}

          {!loading && !hasPausedState && !success && (
            <button onClick={() => handleSync(false)} disabled={checkingState}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors rounded-md disabled:opacity-50 min-w-[180px] justify-center">
              <Database className="w-4 h-4" /> Iniciar Sincronização
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
