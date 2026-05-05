import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Loader2, AlertTriangle, UserCircle2, Camera } from 'lucide-react';
import { criarVisitante, atualizarVisitante, buscarVisitante, VisitanteInsert } from '../../services/visitanteService';
import { supabase } from '../../lib/supabase';

export default function VisitanteForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const location = window.location;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isTerceiroRoute = location.pathname.includes('/terceiros');

  const [formData, setFormData] = useState<VisitanteInsert>({
    nome: '',
    documento: '',
    telefone: '',
    telefone_contato: '',
    cidade: '',
    endereco: '',
    foto_url: '',
    ativo: true,
    bloqueado: false,
    motivo_bloqueio: '',
    terceiro: isTerceiroRoute,
    parentesco: '',
  });

  useEffect(() => {
    if (isEditing && id) {
      loadData(id);
    }
  }, [id, isEditing]);

  const loadData = async (visitanteId: string) => {
    try {
      const data = await buscarVisitante(visitanteId);
      if (data) {
        setFormData({
          nome: data.nome,
          documento: data.documento || '',
          telefone: data.telefone || '',
          telefone_contato: data.telefone_contato || '',
          cidade: data.cidade || '',
          endereco: data.endereco || '',
          foto_url: data.foto_url || '',
          ativo: data.ativo,
          bloqueado: data.bloqueado,
          motivo_bloqueio: data.motivo_bloqueio || '',
          terceiro: data.terceiro,
          parentesco: data.parentesco || '',
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    if (!value) return '';
    let v = value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    
    if (v.length <= 2) return v;
    if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
    return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'telefone' || name === 'telefone_contato') {
      setFormData(prev => ({ ...prev, [name]: formatPhone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingFoto(true);
      setError(null);

      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `fotos/${fileName}`;

      if (!file.type.startsWith('image/')) {
        throw new Error('Por favor selecione um arquivo de imagem válido.');
      }

      // Upload to Supabase Storage 'visitantes'
      const { error: uploadError } = await supabase.storage
        .from('visitantes')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('visitantes')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, foto_url: urlData.publicUrl }));
    } catch (err: any) {
      console.error('Erro no upload da foto:', err);
      setError(err.message || 'Falha ao fazer upload da foto.');
    } finally {
      setUploadingFoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isEditing && id) {
        await atualizarVisitante(id, formData);
      } else {
        await criarVisitante(formData);
      }
      navigate(isTerceiroRoute ? '/recepcao/terceiros' : '/recepcao/visitantes');
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 w-full px-4 sm:px-10 pb-12"
    >
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(isTerceiroRoute ? '/recepcao/terceiros' : '/recepcao/visitantes')}
          className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isEditing ? (isTerceiroRoute ? 'Editar Terceiro' : 'Editar Visitante') : (isTerceiroRoute ? 'Novo Terceiro' : 'Novo Visitante')}
          </h1>
          <p className="text-sm text-muted-foreground">
            Preencha os dados abaixo.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 space-y-8">
        
        {/* Identificação Básica */}
        <div>
          <h3 className="text-lg font-semibold mb-4 border-b border-border pb-2">Identificação</h3>
          
          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">{isTerceiroRoute ? 'Nome do Terceiro / Razão Social' : 'Nome Completo'} <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="nome"
                required
                value={formData.nome}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={isTerceiroRoute ? "Ex: Empresa Parceira Ltda / João da Silva" : "Ex: João da Silva"}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Documento (CPF / RG) <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="documento"
                required
                value={formData.documento || ''}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Empresa ou Outros</label>
              <input
                type="text"
                name="endereco"
                value={formData.endereco || ''}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>


        {/* Contato e Endereço */}
        <div>
          <h3 className="text-lg font-semibold mb-4 border-b border-border pb-2">Contato e Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone Pessoal <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="telefone"
                required
                value={formData.telefone || ''}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cidade</label>
              <input
                type="text"
                name="cidade"
                value={formData.cidade || ''}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Configurações Avançadas */}
        <div>
          <h3 className="text-lg font-semibold mb-4 border-b border-border pb-2">Controle e Acesso</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-3 bg-destructive/5 p-4 rounded-lg border border-destructive/20 md:col-span-2">
              <input
                type="checkbox"
                id="bloqueado"
                name="bloqueado"
                checked={formData.bloqueado}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-destructive focus:ring-destructive"
              />
              <div className="flex flex-col">
                <label htmlFor="bloqueado" className="text-sm font-medium leading-none text-destructive cursor-pointer">
                  Acesso Bloqueado
                </label>
                <p className="text-xs text-muted-foreground mt-1">Impede a entrada no hospital</p>
              </div>
            </div>

            {formData.bloqueado && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-destructive">Motivo do Bloqueio</label>
                <textarea
                  name="motivo_bloqueio"
                  rows={3}
                  value={formData.motivo_bloqueio || ''}
                  onChange={handleChange}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive border-destructive/50"
                  placeholder="Por que este acesso está bloqueado?"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-border">
          <button
            type="button"
            onClick={() => navigate(isTerceiroRoute ? '/recepcao/terceiros' : '/recepcao/visitantes')}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
