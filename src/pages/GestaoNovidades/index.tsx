import React, { useEffect, useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  ExternalLink,
  Eye,
  EyeOff,
  AlertTriangle,
  Sparkles,
  Bell,
  ShieldCheck,
  HelpCircle,
  Check,
  RefreshCw,
  Newspaper
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Estrutura do item de novidade
export interface NewsItem {
  id: string;
  titulo: string;
  descricao: string;
  tag: string;
  categoria: 'campanha' | 'urgente' | 'tecnologia' | 'outros';
  link?: string;
  imagem_url?: string;
  ativa: boolean;
  ordem?: number;
  created_at?: string;
}

const DEFAULT_NEWS: NewsItem[] = [
  {
    id: 'news-1',
    titulo: 'Vacinação contra Gripe e Influenza',
    descricao: 'A campanha de imunização está ativa no setor de triagem. Traga sua carteira de vacinação.',
    tag: 'Campanha',
    categoria: 'campanha',
    link: '',
    ativa: true,
    ordem: 0
  },
  {
    id: 'news-2',
    titulo: 'Doação de Sangue Necessária',
    descricao: 'O estoque do nosso banco de sangue do tipo O- e A+ está em nível crítico. Faça sua parte.',
    tag: 'Urgente',
    categoria: 'urgente',
    link: '',
    ativa: true,
    ordem: 1
  },
  {
    id: 'news-3',
    titulo: 'Nova Ala de Diagnóstico por Imagem',
    descricao: 'Adquirimos novos equipamentos de ressonância magnética para exames mais rápidos e precisos.',
    tag: 'Tecnologia',
    categoria: 'tecnologia',
    link: '',
    ativa: true,
    ordem: 2
  }
];

export default function GestaoNovidades() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [dbErrorAlert, setDbErrorAlert] = useState<string | null>(null);

  // Estados do Formulário/Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);

  // Campos do Formulário
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tag, setTag] = useState('');
  const [categoria, setCategoria] = useState<'campanha' | 'urgente' | 'tecnologia' | 'outros'>('outros');
  const [link, setLink] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  const [ativa, setAtiva] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Notificações na tela
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; msg: string } | null>(null);

  // Mostrar Notificação
  const showToast = (tipo: 'sucesso' | 'erro' | 'info', msg: string) => {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // Carregar dados da tabela no Supabase
  const loadNews = async () => {
    setLoading(true);
    setDbErrorAlert(null);
    try {
      const { data, error } = await supabase
        .from('novidades')
        .select('*')
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        setNews(data);
        setIsDbConnected(true);
      }
    } catch (err: any) {
      console.warn('Erro ao conectar ao Supabase (novidades):', err.message);
      setIsDbConnected(false);

      // Carrega fallback do LocalStorage
      const localData = localStorage.getItem('hsc_gestao_novidades');
      if (localData) {
        try {
          setNews(JSON.parse(localData));
        } catch (e) {
          setNews(DEFAULT_NEWS);
        }
      } else {
        setNews(DEFAULT_NEWS);
        localStorage.setItem('hsc_gestao_novidades', JSON.stringify(DEFAULT_NEWS));
      }

      if (err.code === '42P01' || err.message?.includes('relation "novidades" does not exist')) {
        setDbErrorAlert(
          'A tabela "novidades" não existe no Supabase. O sistema está rodando em modo Simulação (salvando localmente no navegador).'
        );
      } else {
        setDbErrorAlert(`Erro ao conectar ao Supabase: ${err.message}. Rodando em modo Simulação.`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  // Salvar no localstorage (apenas para fallback de simulação)
  const saveToLocalFallback = (updatedList: NewsItem[]) => {
    localStorage.setItem('hsc_gestao_novidades', JSON.stringify(updatedList));
    setNews(updatedList);
  };

  // Abrir Modal de Edição ou Criação
  const openForm = (item?: NewsItem) => {
    if (item) {
      setEditingItem(item);
      setTitulo(item.titulo);
      setDescricao(item.descricao);
      setTag(item.tag);
      setCategoria(item.categoria);
      setLink(item.link || '');
      setImagemUrl(item.imagem_url || '');
      setAtiva(item.ativa);
    } else {
      setEditingItem(null);
      setTitulo('');
      setDescricao('');
      setTag('Campanha');
      setCategoria('campanha');
      setLink('');
      setImagemUrl('');
      setAtiva(true);
    }
    setIsModalOpen(true);
  };

  // Tratar alteração da categoria para sugerir a tag padrão
  const handleCategoryChange = (catVal: typeof categoria) => {
    setCategoria(catVal);
    if (catVal === 'campanha') setTag('Campanha');
    else if (catVal === 'urgente') setTag('Urgente');
    else if (catVal === 'tecnologia') setTag('Tecnologia');
    else setTag('Aviso');
  };

  // Tratar Upload de Imagem para o Supabase Storage
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('erro', 'Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showToast('erro', 'A imagem deve ter no máximo 3MB.');
      return;
    }

    setUploading(true);
    try {
      if (isDbConnected) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `capas/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('novidades')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('novidades')
          .getPublicUrl(filePath);

        if (data?.publicUrl) {
          setImagemUrl(data.publicUrl);
          showToast('sucesso', 'Imagem de capa carregada com sucesso!');
        } else {
          throw new Error('Falha ao obter URL pública da imagem.');
        }
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          if (base64.length > 1.2 * 1024 * 1024) {
            showToast('erro', 'Imagem muito grande para simulação local. Selecione um arquivo menor que 800KB.');
            setUploading(false);
            return;
          }
          setImagemUrl(base64);
          showToast('sucesso', 'Imagem carregada localmente para simulação!');
          setUploading(false);
        };
        reader.onerror = () => {
          showToast('erro', 'Erro ao ler o arquivo.');
          setUploading(false);
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      console.error('Erro de upload:', err);
      showToast('erro', `Falha no upload: ${err.message || err}`);
      setUploading(false);
    } finally {
      if (isDbConnected) {
        setUploading(false);
      }
    }
  };

  // Submeter formulário (Criar ou Editar)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !descricao.trim()) {
      showToast('erro', 'Por favor, preencha o Título e a Descrição.');
      return;
    }

    const payload = {
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      tag: tag.trim() || 'Aviso',
      categoria,
      link: link.trim() || null,
      imagem_url: imagemUrl.trim() || null,
      ativa
    };

    if (isDbConnected) {
      try {
        if (editingItem) {
          // UPDATE
          const { error } = await supabase
            .from('novidades')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', editingItem.id);

          if (error) throw error;
          showToast('sucesso', 'Novidade atualizada no Supabase com sucesso!');
        } else {
          // INSERT
          const { error } = await supabase
            .from('novidades')
            .insert([payload]);

          if (error) throw error;
          showToast('sucesso', 'Novidade cadastrada no Supabase com sucesso!');
        }
        setIsModalOpen(false);
        loadNews();
      } catch (err: any) {
        console.error('Erro de persistência no Supabase:', err);
        showToast('erro', `Erro ao salvar no banco: ${err.message}`);
      }
    } else {
      // MODO SIMULAÇÃO (LOCALSTORAGE)
      let updatedList = [...news];
      if (editingItem) {
        updatedList = updatedList.map((item) =>
          item.id === editingItem.id ? { ...item, ...payload } : item
        );
        showToast('sucesso', 'Novidade atualizada localmente com sucesso! (Modo Simulação)');
      } else {
        const newItem: NewsItem = {
          id: `local-${Date.now()}`,
          ...payload,
          link: payload.link || '',
          imagem_url: payload.imagem_url || '',
          created_at: new Date().toISOString()
        };
        updatedList = [newItem, ...updatedList];
        showToast('sucesso', 'Novidade cadastrada localmente com sucesso! (Modo Simulação)');
      }
      saveToLocalFallback(updatedList);
      setIsModalOpen(false);
    }
  };

  // Salvar a nova ordem das novidades no Supabase ou LocalStorage
  const salvarNovaOrdem = async (updatedList: NewsItem[]) => {
    const listWithNewOrders = updatedList.map((item, idx) => ({
      ...item,
      ordem: idx
    }));

    if (isDbConnected) {
      try {
        const updates = listWithNewOrders.map((item) =>
          supabase
            .from('novidades')
            .update({ ordem: item.ordem, updated_at: new Date().toISOString() })
            .eq('id', item.id)
        );

        const results = await Promise.all(updates);
        const errorResult = results.find(r => r.error);
        if (errorResult && errorResult.error) throw errorResult.error;

        showToast('sucesso', 'Nova ordenação salva no Supabase!');
        setNews(listWithNewOrders);
      } catch (err: any) {
        console.error('Erro ao salvar ordenação no Supabase:', err);
        showToast('erro', `Erro ao salvar ordenação: ${err.message}`);
        loadNews();
      }
    } else {
      saveToLocalFallback(listWithNewOrders);
      showToast('sucesso', 'Nova ordenação salva localmente! (Modo Simulação)');
    }
  };

  // Alternar Status Ativa/Inativa
  const handleToggleActive = async (item: NewsItem) => {
    const nextActive = !item.ativa;
    if (isDbConnected) {
      try {
        const { error } = await supabase
          .from('novidades')
          .update({ ativa: nextActive, updated_at: new Date().toISOString() })
          .eq('id', item.id);

        if (error) throw error;
        showToast('sucesso', `Status alterado no Supabase para ${nextActive ? 'Ativo' : 'Inativo'}.`);
        loadNews();
      } catch (err: any) {
        showToast('erro', `Erro ao atualizar status: ${err.message}`);
      }
    } else {
      const updatedList = news.map((n) =>
        n.id === item.id ? { ...n, ativa: nextActive } : n
      );
      saveToLocalFallback(updatedList);
      showToast('sucesso', `Status alterado localmente para ${nextActive ? 'Ativo' : 'Inativo'}.`);
    }
  };

  // Excluir Novidade
  const handleDelete = async (item: NewsItem) => {
    if (!window.confirm(`Tem certeza que deseja excluir a novidade "${item.titulo}"?`)) {
      return;
    }

    if (isDbConnected) {
      try {
        const { error } = await supabase
          .from('novidades')
          .delete()
          .eq('id', item.id);

        if (error) throw error;
        showToast('sucesso', 'Novidade excluída do Supabase.');
        loadNews();
      } catch (err: any) {
        showToast('erro', `Erro ao excluir: ${err.message}`);
      }
    } else {
      const updatedList = news.filter((n) => n.id !== item.id);
      saveToLocalFallback(updatedList);
      showToast('sucesso', 'Novidade excluída localmente.');
    }
  };

  // Helpers de Estilização de Categoria
  const getCategoryStyles = (cat: NewsItem['categoria']) => {
    switch (cat) {
      case 'campanha':
        return {
          bg: 'bg-red-50 dark:bg-red-950/20',
          badge: 'bg-red-150 text-red-750 dark:bg-red-900/30 dark:text-red-300',
          border: 'border-red-100 dark:border-red-900/10',
          iconColor: 'text-red-700 dark:text-red-400',
          Icon: Sparkles
        };
      case 'urgente':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/20',
          badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
          border: 'border-emerald-100 dark:border-emerald-900/10',
          iconColor: 'text-emerald-700 dark:text-emerald-400',
          Icon: Bell
        };
      case 'tecnologia':
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/20',
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          border: 'border-blue-100 dark:border-blue-900/10',
          iconColor: 'text-blue-700 dark:text-blue-400',
          Icon: ShieldCheck
        };
      default:
        return {
          bg: 'bg-slate-50 dark:bg-slate-900/40',
          badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350',
          border: 'border-slate-200 dark:border-slate-800',
          iconColor: 'text-slate-500 dark:text-slate-400',
          Icon: HelpCircle
        };
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 max-w-6xl mx-auto overflow-y-auto h-[90vh]">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border animate-in slide-in-from-top duration-300 flex items-center gap-3 ${toast.tipo === 'sucesso'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-slate-900 dark:border-emerald-900 dark:text-emerald-200'
            : toast.tipo === 'erro'
              ? 'bg-red-50 border-red-200 text-red-800 dark:bg-slate-900 dark:border-red-900 dark:text-red-200'
              : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-slate-900 dark:border-blue-900 dark:text-blue-200'
          }`}>
          {toast.tipo === 'sucesso' ? <Check className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-red-500" />}
          <span className="text-sm font-semibold">{toast.msg}</span>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Novidades Conecta Saúde</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre campanhas, avisos urgentes ou novidades para exibir na tela inicial do aplicativo Conecta Saúde.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadNews}
            disabled={loading}
            className="flex items-center justify-center p-2.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => openForm()}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Novidade</span>
          </button>
        </div>
      </div>

      {/* Alerta de Banco / Fallback */}
      {dbErrorAlert && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 text-sm font-medium leading-normal">
            {dbErrorAlert}
          </div>
          <div className="text-xs font-mono bg-amber-500/10 px-2.5 py-1 rounded-md mt-2 sm:mt-0 select-all border border-amber-500/10 shrink-0">
            SQL disponível em migrations/20260730000000_create_novidades_table.sql
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium animate-pulse">Carregando novidades...</p>
        </div>
      ) : news.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-2xl p-8 space-y-4">
          <Newspaper className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground">Nenhuma novidade cadastrada</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Clique no botão "Nova Novidade" no topo para criar a primeira publicação.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.map((item, index) => {
            const { bg, badge, border, iconColor, Icon } = getCategoryStyles(item.categoria);
            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => {
                  setDraggedIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedIndex === null || draggedIndex === index) return;
                  const updatedList = [...news];
                  const [draggedItem] = updatedList.splice(draggedIndex, 1);
                  updatedList.splice(index, 0, draggedItem);
                  setNews(updatedList);
                  setDraggedIndex(null);
                  salvarNovaOrdem(updatedList);
                }}
                onDragEnd={() => setDraggedIndex(null)}
                className={`border rounded-2xl flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md transition-all bg-card cursor-grab active:cursor-grabbing ${item.ativa ? 'opacity-100' : 'opacity-65 grayscale-[20%]'
                  } ${draggedIndex === index ? 'opacity-35 border-dashed border-primary/40 bg-primary/5' : ''}`}
              >
                {/* Cabeçalho do Card (Capa) */}
                <div className="h-32 relative overflow-hidden border-b border-border flex items-center justify-center bg-white dark:bg-slate-900/40">
                  {item.imagem_url ? (
                    <img
                      src={item.imagem_url}
                      alt={item.titulo}
                      className="w-full h-full object-contain bg-white dark:bg-slate-900/40"
                    />
                  ) : (
                    <div className={`absolute inset-0 ${bg} flex items-center justify-center`} />
                  )}

                  <div className="absolute top-3 left-3 flex gap-1.5 items-center z-10">
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${badge}`}>
                      {item.tag}
                    </span>
                    {!item.ativa && (
                      <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full uppercase dark:bg-slate-800 dark:text-slate-350">
                        Inativa
                      </span>
                    )}
                  </div>

                  {!item.imagem_url && (
                    <Icon className={`h-8 w-8 ${iconColor} opacity-75 relative z-10`} />
                  )}
                </div>

                {/* Conteúdo */}
                <div className="p-5 flex-1 flex flex-col gap-2">
                  <h3 className="font-bold text-foreground leading-tight line-clamp-2" title={item.titulo}>
                    {item.titulo}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1 line-clamp-3">
                    {item.descricao}
                  </p>

                  {item.link && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-primary/80 mt-1 truncate">
                      <ExternalLink className="h-3 w-3 inline" />
                      <span className="truncate" title={item.link}>{item.link}</span>
                    </div>
                  )}
                </div>

                {/* Ações do Card */}
                <div className="px-5 py-3.5 bg-muted/30 border-t flex items-center justify-between">
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${item.ativa
                        ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-300'
                        : 'border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400'
                      }`}
                    title={item.ativa ? 'Desativar novidade' : 'Ativar novidade'}
                  >
                    {item.ativa ? (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        <span>Ativa</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        <span>Inativa</span>
                      </>
                    )}
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openForm(item)}
                      className="p-1.5 rounded-lg border hover:bg-muted text-slate-600 hover:text-foreground transition-colors cursor-pointer"
                      title="Editar novidade"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 rounded-lg border border-red-200/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 hover:text-red-750 transition-colors cursor-pointer"
                      title="Excluir novidade"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Formulário */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="relative w-full max-w-md bg-card border rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {editingItem ? 'Editar Novidade' : 'Nova Novidade'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Título */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Título</label>
                <input
                  type="text"
                  placeholder="Ex: Campanha de Vacinação contra a Gripe"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  maxLength={100}
                  required
                />
              </div>

              {/* Descrição */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Descrição</label>
                <textarea
                  placeholder="Descreva de forma curta e objetiva o conteúdo da novidade..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full h-24 px-3 py-2 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                  maxLength={250}
                  required
                />
              </div>

              {/* Grid Categoria & Tag */}
              <div className="grid grid-cols-2 gap-4">
                {/* Categoria */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Categoria (Capa)</label>
                  <select
                    value={categoria}
                    onChange={(e) => handleCategoryChange(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer"
                  >
                    <option value="campanha">Campanha (Burgundy)</option>
                    <option value="urgente">Urgente (Verde)</option>
                    <option value="tecnologia">Tecnologia (Azul)</option>
                    <option value="outros">Outros (Cinza)</option>
                  </select>
                </div>

                {/* Tag */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Texto da Tag</label>
                  <input
                    type="text"
                    placeholder="Ex: Campanha, Aviso"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    maxLength={20}
                  />
                </div>
              </div>

              {/* Link de Redirecionamento */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Link de Redirecionamento (Opcional)</label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/saiba-mais"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>

              {/* Imagem de Capa */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Imagem de Capa</label>

                {imagemUrl ? (
                  <div className="relative h-24 rounded-lg overflow-hidden border border-border group">
                    <img
                      src={imagemUrl}
                      alt="Preview da Capa"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setImagemUrl('')}
                        className="p-1.5 bg-red-600 hover:bg-red-750 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-md"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center h-24 border border-dashed rounded-lg cursor-pointer transition-all hover:bg-muted/40 ${uploading ? 'pointer-events-none opacity-60' : ''
                    }`}>
                    {uploading ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="h-5 w-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <span className="text-[10px] text-muted-foreground font-semibold">Carregando imagem...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-center p-2">
                        <span className="text-xs text-primary font-bold hover:underline">Selecionar arquivo</span>
                        <span className="text-[9px] text-muted-foreground">PNG, JPG ou JPEG (máx. 3MB)</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadImage}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>

              {/* Status Ativo/Inativo */}
              <div className="flex items-center justify-between py-2 border-t border-b">
                <div className="space-y-0.5">
                  <span className="text-sm font-bold text-foreground">Exibir na Home?</span>
                  <p className="text-[11px] text-muted-foreground">Define se a novidade será mostrada no aplicativo Conecta Saúde.</p>
                </div>
                <input
                  type="checkbox"
                  checked={ativa}
                  onChange={(e) => setAtiva(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-350 focus:ring-primary text-primary transition-all cursor-pointer"
                />
              </div>

              {/* Ações */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-muted text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingItem ? 'Atualizar' : 'Criar'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
