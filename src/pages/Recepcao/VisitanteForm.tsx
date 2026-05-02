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

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    terceiro: false,
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
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
      navigate('/recepcao/visitantes');
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
          onClick={() => navigate('/recepcao/visitantes')}
          className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isEditing ? 'Editar Visitante' : 'Novo Visitante'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Preencha os dados do visitante abaixo.
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
            <div className="flex-shrink-0 flex flex-col items-center">
              <label className="text-sm font-medium block mb-2 text-center">Foto</label>
              <div className="flex flex-col items-center gap-1">
                <div className="h-20 w-20 rounded-full overflow-hidden bg-muted border-2 border-border flex flex-shrink-0 items-center justify-center text-muted-foreground relative group mb-1">
                  {formData.foto_url ? (
                    <img src={formData.foto_url} alt="Foto" className="h-full w-full object-cover" />
                  ) : (
                    <UserCircle2 className="h-10 w-10 opacity-50" />
                  )}
                  <div 
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-sm"
                    onClick={() => !uploadingFoto && fileInputRef.current?.click()}
                  >
                    {uploadingFoto ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFoto}
                    className="text-xs text-primary hover:underline font-medium text-center"
                  >
                    {uploadingFoto ? 'Enviando...' : 'Fazer upload'}
                  </button>
                  <span className="text-[10px] text-muted-foreground mt-0.5 text-center leading-tight">JPG ou PNG</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFotoUpload}
                  disabled={uploadingFoto}
                />
              </div>
            </div>

            <div className="flex-1 space-y-2 mt-4 sm:mt-0">
              <label className="text-sm font-medium">Nome Completo <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="nome"
                required
                value={formData.nome}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Ex: João da Silva"
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
              <label className="text-sm font-medium">Grau de Parentesco / Relação</label>
              <select
                name="parentesco"
                value={formData.parentesco || ''}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione...</option>
                <option value="Pai">Pai</option>
                <option value="Mãe">Mãe</option>
                <option value="Filho(a)">Filho(a)</option>
                <option value="Irmão(ã)">Irmão(ã)</option>
                <option value="Cônjuge">Cônjuge</option>
                <option value="Tio(a)">Tio(a)</option>
                <option value="Avô(ó)">Avô(ó)</option>
                <option value="Amigo(a)">Amigo(a)</option>
                <option value="Outro">Outro</option>
              </select>
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
              <label className="text-sm font-medium">Telefone Contato Extra</label>
              <input
                type="text"
                name="telefone_contato"
                value={formData.telefone_contato || ''}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Endereço Completo</label>
              <input
                type="text"
                name="endereco"
                value={formData.endereco || ''}
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
            onClick={() => navigate('/recepcao/visitantes')}
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
            {saving ? 'Salvando...' : 'Salvar Visitante'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
