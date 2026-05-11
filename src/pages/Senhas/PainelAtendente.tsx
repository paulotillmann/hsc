import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { senhaService, Senha, ConfiguracaoTV } from '../../services/senhaService';
import { Play, CheckCircle2, MonitorPlay, Save, Users, RefreshCw, Volume2, ChevronLeft, ChevronRight } from 'lucide-react';

const PainelAtendente: React.FC = () => {
  const [fila, setFila] = useState<Senha[]>([]);
  const [historico, setHistorico] = useState<Senha[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageRef = React.useRef(1);
  const itemsPerPage = 10;

  const [configTV, setConfigTV] = useState<ConfiguracaoTV | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [guiche, setGuiche] = useState('1'); 
  const [loading, setLoading] = useState(false);

  const setPage = (page: number) => {
    setCurrentPage(page);
    pageRef.current = page;
    carregarDados();
  };

  useEffect(() => {
    carregarDados();

    const subscription = supabase
      .channel('senhas_atendente')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'senhas' }, () => {
        carregarDados();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const carregarDados = async () => {
    try {
      const pFila = await senhaService.listarFila();
      const pHistorico = await senhaService.listarHistorico(pageRef.current, itemsPerPage);
      const pConfig = await senhaService.obterConfiguracaoTV();

      setFila(pFila);
      setHistorico(pHistorico.data);
      setTotalCount(pHistorico.count);
      if (pConfig) {
        setConfigTV(pConfig);
        setVideoUrl(pConfig.youtube_url);
      }
    } catch (error) {
      console.error('Erro ao carregar dados', error);
    }
  };

  const chamarProxima = async () => {
    try {
      setLoading(true);
      const senha = await senhaService.chamarProxima(guiche);
      if (!senha) {
        alert('Fila vazia!');
      }
    } catch (error) {
      console.error('Erro ao chamar', error);
      alert('Erro ao chamar próxima senha.');
    } finally {
      setLoading(false);
    }
  };

  const concluirAtendimento = async (id: string) => {
    try {
      await senhaService.concluirSenha(id);
    } catch (error) {
      console.error('Erro ao concluir', error);
    }
  };

  const rechamar = async (id: string) => {
    try {
      await senhaService.rechamarSenha(id);
    } catch (error) {
      console.error('Erro ao rechamar', error);
      alert('Erro ao rechamar senha.');
    }
  };

  const salvarConfigTV = async () => {
    try {
      setLoading(true);
      await senhaService.atualizarConfiguracaoTV(videoUrl);
      alert('Configuração salva com sucesso. A TV será atualizada.');
    } catch (error) {
      console.error('Erro ao salvar config', error);
      alert('Erro ao salvar configuração.');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel de Atendimento</h1>
          <p className="text-muted-foreground">Gerencie a fila e chame as próximas senhas</p>
        </div>
        
        <div className="flex items-center gap-4 bg-card p-2 px-4 rounded-xl shadow-sm border border-border">
          <label className="text-sm font-bold text-card-foreground">Meu Guichê:</label>
          <input 
            type="text" 
            value={guiche} 
            onChange={e => setGuiche(e.target.value)}
            className="w-16 px-3 py-2 border border-border rounded-lg text-center bg-background text-foreground font-bold focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA PRINCIPAL */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* AÇÕES PRINCIPAIS */}
          <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex flex-col sm:flex-row items-center gap-6 justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-primary/10 text-primary rounded-xl">
                <Users size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Fila de Espera</h2>
                <p className="text-muted-foreground font-medium">{fila.length} pessoa(s) aguardando</p>
              </div>
            </div>
            
            <button 
              onClick={chamarProxima}
              disabled={loading || fila.length === 0}
              className="w-full sm:w-auto px-8 py-5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all text-lg"
            >
              <Play size={24} fill="currentColor" />
              CHAMAR PRÓXIMA
            </button>
          </div>

          {/* HISTÓRICO RECENTE */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="p-5 border-b border-border bg-muted/50">
              <h3 className="font-bold text-foreground">Últimas Chamadas (Histórico)</h3>
            </div>
            <div className="divide-y divide-border">
              {historico.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">Nenhuma senha chamada ainda.</div>
              )}
              {historico.map(senha => (
                <div key={senha.id} className="p-5 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-5">
                    <div className={`px-5 py-2.5 rounded-xl text-xl font-black shadow-md border-2 transition-all ${
                      senha.tipo === 'preferencial' 
                        ? 'bg-amber-500 text-white border-amber-400 dark:bg-amber-600 dark:border-amber-500' 
                        : 'bg-blue-600 text-white border-blue-500 dark:bg-blue-700 dark:border-blue-600'
                    }`}>
                      {senha.codigo}
                    </div>
                    <div>
                      <div className="font-bold text-foreground">Guichê {senha.guiche}</div>
                      <div className="text-sm text-muted-foreground font-medium">{new Date(senha.called_at!).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => rechamar(senha.id)}
                      title="Chamar novamente no painel"
                      className="px-3 py-2 text-sm font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center gap-2 transition-colors border border-blue-200 dark:border-blue-800/50 shadow-sm"
                    >
                      <Volume2 size={18} />
                      <span className="hidden sm:inline">Rechamar</span>
                    </button>

                    {senha.status === 'chamando' && (
                      <button 
                        onClick={() => concluirAtendimento(senha.id)}
                        className="px-4 py-2 text-sm font-bold bg-muted hover:bg-muted/80 text-foreground rounded-xl flex items-center gap-2 transition-colors border border-border shadow-sm"
                      >
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        Concluir
                      </button>
                    )}
                    {senha.status === 'atendido' && (
                      <span className="text-sm font-bold text-emerald-500 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                        <CheckCircle2 size={16} /> Atendido
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* PAGINATION FOOTER */}
            <div className="p-4 border-t border-border flex justify-between items-center bg-muted/50">
              <span className="text-sm text-muted-foreground">
                Página <span className="font-semibold text-foreground">{currentPage}</span> de <span className="font-semibold text-foreground">{Math.max(1, totalPages)}</span> - {totalCount} registros
              </span>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-card hover:bg-muted text-muted-foreground disabled:opacity-50 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  
                  {(() => {
                    let startPage = Math.max(1, currentPage - 2);
                    let endPage = startPage + 4;
                    if (endPage > totalPages) {
                      endPage = totalPages;
                      startPage = Math.max(1, endPage - 4);
                    }
                    const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
                    
                    return visiblePages.map(page => (
                      <button
                        key={page}
                        onClick={() => setPage(page)}
                        className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                          page === currentPage
                            ? 'bg-primary text-primary-foreground shadow-sm border-transparent'
                            : 'border border-border bg-card hover:bg-muted text-foreground'
                        }`}
                      >
                        {page}
                      </button>
                    ));
                  })()}

                  <button 
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-card hover:bg-muted text-muted-foreground disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUNA LATERAL */}
        <div className="space-y-6">
          
          {/* PRÓXIMOS DA FILA */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="p-5 border-b border-border bg-muted/50 flex justify-between items-center">
              <h3 className="font-bold text-foreground">Próximos da Fila</h3>
              <button onClick={carregarDados} className="text-muted-foreground hover:text-primary transition-colors">
                <RefreshCw size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[350px] overflow-y-auto scrollbar-hide">
              {fila.length === 0 && (
                <div className="text-center text-sm font-medium text-muted-foreground py-6">Fila vazia</div>
              )}
              {fila.map(senha => (
                <div key={senha.id} className="flex justify-between items-center p-3 bg-background rounded-xl border border-border shadow-sm">
                  <span className={`px-3 py-1 rounded-lg font-black tracking-wider text-sm shadow-sm ${
                    senha.tipo === 'preferencial' 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-blue-600 text-white'
                  }`}>
                    {senha.codigo}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded">
                    {new Date(senha.created_at).toLocaleTimeString().slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CONFIGURAÇÃO TV */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="p-5 border-b border-border bg-muted/50 flex items-center gap-3">
              <MonitorPlay size={20} className="text-muted-foreground" />
              <h3 className="font-bold text-foreground">Mídia da TV</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  URL do Vídeo (YouTube)
                </label>
                <input 
                  type="text" 
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm font-medium bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition-shadow"
                />
                <p className="text-xs font-medium text-muted-foreground mt-2">Vídeo tocará em loop. Ex: Institucional, Dicas de Saúde.</p>
              </div>
              <button 
                onClick={salvarConfigTV}
                disabled={loading}
                className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Save size={18} />
                Atualizar Tela da TV
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default PainelAtendente;
