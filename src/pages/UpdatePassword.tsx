import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const UpdatePassword: React.FC = () => {
  const navigate = useNavigate();
  const { updatePassword, session } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Se não houver sessão, o link pode ser inválido ou expirado (ou o usuário acessou diretamente a rota)
  useEffect(() => {
    // Dá um tempinho para o onAuthStateChange processar o hash da URL antes de verificar
    const timer = setTimeout(() => {
      if (!session) {
        setError('Sessão inválida ou expirada. Solicite um novo link de recuperação de senha.');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!session) {
      setError('Você não tem permissão para alterar a senha. Solicite um novo link.');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Preencha os dois campos de senha.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setIsSubmitting(false);

    if (updateError) {
      setError(updateError);
    } else {
      setSuccess('Senha atualizada com sucesso!');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 lg:p-6 bg-background transition-colors">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto p-8 border rounded-2xl shadow-xl bg-card"
      >
        <div className="flex justify-center mb-6">
          <img src="/technocode-logo.png" alt="TECHNOCODE" className="h-10 w-auto dark:hidden" />
          <img src="/technocode-logo-white.png" alt="TECHNOCODE" className="h-10 w-auto hidden dark:block" />
        </div>

        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">Criar Nova Senha</h2>
          <p className="text-sm text-muted-foreground font-medium">Digite sua nova senha abaixo.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-1 relative group">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nova Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mín. 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || !session}
                className="flex h-12 w-full rounded-md border bg-transparent px-4 py-2 pr-10 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1 relative group">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirmar Nova Senha</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting || !session}
                className="flex h-12 w-full rounded-md border bg-transparent px-4 py-2 pr-10 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-600 text-sm border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-xs leading-tight">{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-md bg-green-50 text-green-700 text-sm border border-green-200 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p className="text-xs leading-tight">{success}</p>
            </motion.div>
          )}

          <div className="pt-2 flex flex-col space-y-4">
            <button
              type="submit"
              disabled={isSubmitting || (!session && !success)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow hover:opacity-90 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Atualizando...</> : 'Atualizar Senha'}
            </button>
            
            <button 
              type="button" 
              onClick={() => navigate('/', { replace: true })} 
              className="text-center text-sm font-medium text-muted-foreground hover:text-foreground mt-4 transition-colors"
              disabled={isSubmitting}
            >
              Voltar para o Login
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default UpdatePassword;
