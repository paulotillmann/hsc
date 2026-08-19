import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Loader2, AlertCircle, ShieldCheck, FileText, CheckCircle2, Eye, EyeOff, UserCircle, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, session, loading, profileLoaded, defaultModuleSlug, profile } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Estados de Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Estados de Cadastro
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // UI States
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // Redireciona se já estiver logado — aguarda o profile carregar para usar defaultModuleSlug
  useEffect(() => {
    if (!loading && session && profileLoaded) {
      if (session.user.email === 'totem@email.com') {
        navigate('/totem', { replace: true });
        return;
      }
      if (session.user.email === 'pa@email.com') {
        navigate('/pronto-atendimento', { replace: true });
        return;
      }
      if (profile?.setor_usuarios) {
        navigate('/pacientes-internados', { replace: true });
        return;
      }
      const target = defaultModuleSlug ? `/${defaultModuleSlug}` : '/dashboard';
      navigate(target, { replace: true });
    }
  }, [session, loading, profileLoaded, defaultModuleSlug, profile, navigate]);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));

    const logoutReason = sessionStorage.getItem('hsc_logout_reason');
    if (logoutReason === 'inactivity') {
      setError('Sua sessão expirou por inatividade (30 minutos). Por favor, realize o login novamente.');
      sessionStorage.removeItem('hsc_logout_reason');
    } else if (logoutReason === 'forced') {
      setError('Sua sessão foi encerrada por um administrador.');
      sessionStorage.removeItem('hsc_logout_reason');
    }
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      root.classList.add('light');
      setIsDark(false);
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      setIsDark(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password.trim()) {
      setError('Preencha o e-mail e a senha.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: authError } = await signIn(email.trim(), password);
      if (authError) {
        setError(authError);
      }
    } catch (err: any) {
      console.error('[Login] Erro durante o login:', err);
      setError('Ocorreu um erro inesperado ao tentar entrar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
    // O redirect será feito pelo useEffect acima assim que o profile for carregado
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('Preencha o e-mail para recuperar a senha.');
      return;
    }

    setIsSubmitting(true);
    const { error: resetError } = await resetPassword(email.trim());
    setIsSubmitting(false);

    if (resetError) {
      setError(resetError);
    } else {
      setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setTimeout(() => {
        setIsRecovering(false);
        setSuccess(null);
        setError(null);
      }, 5000);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!regName.trim() || !regPhone.trim() || !regEmail.trim() || !regPassword || !regConfirm) {
      setError('Preencha todos os campos do formulário.');
      return;
    }
    if (regPassword !== regConfirm) {
      setError('As senhas não coincidem.');
      return;
    }
    if (regPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    let finalAvatarUrl: string | undefined = undefined;

    if (avatarFile) {
      try {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          finalAvatarUrl = urlData.publicUrl;
        } else {
          console.error("Erro no upload do avatar:", uploadError);
        }
      } catch(err) {
        console.error("Erro interno no upload do avatar:", err);
      }
    }

    const { error: signUpError } = await signUp(regEmail.trim(), regPassword, regName.trim(), regPhone.trim(), finalAvatarUrl);
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError);
    } else {
      setSuccess('Conta criada com sucesso! Faça seu login.');
      // Opcional: aguardar 2 segundos e voltar para tela de login
      setTimeout(() => {
        setIsRegistering(false);
        setEmail(regEmail);
        setPassword('');
        setAvatarFile(null);
        setAvatarPreview(null);
        setSuccess(null);
        setError(null);
      }, 2000);
    }
  };

  // Limpa os erros ao mudar de aba (Login <-> Cadastro <-> Recuperação)
  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [isRegistering, isRecovering]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 lg:p-6 bg-background transition-colors">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-full bg-card shadow-sm border hover:bg-muted transition-colors text-foreground z-10"
        title="Alternar Tema"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <motion.div
        layout
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className="flex flex-col md:flex-row w-full max-w-5xl overflow-hidden rounded-2xl border shadow-xl bg-card relative"
        style={{ minHeight: '550px' }}
      >
        {/* ============================================================== */}
        {/* PAINEL ESQUERDO (Apresentação / Marketing)                       */}
        {/* ============================================================== */}
        <div className="md:w-[45%] p-8 bg-primary text-primary-foreground flex flex-col justify-center relative overflow-hidden transition-all duration-300">
          <AnimatePresence mode="wait">
            {!isRegistering && !isRecovering ? (
              <motion.div
                key="left-login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center h-full text-center"
              >
                <div className="flex-1 flex flex-col justify-center items-center">
                  <img src="/LOGO_HSC_WHITE.png" alt="Hospital Santa Casa" className="h-24 w-auto object-contain" />
                </div>

                <div className="mt-auto flex flex-col items-center">
                  <div className="flex items-center mb-1 opacity-90">
                    <img src="/technocode-logo-white.png" alt="TECHNOCODE" className="h-16 w-auto opacity-90" />
                  </div>
                  <p className="text-[10px] opacity-70">Abril, 2026 - by Paulo Tillmann</p>
                  <p className="text-[10px] opacity-70">versão 2.0</p>
                </div>
              </motion.div>
            ) : isRegistering ? (
              <motion.div
                key="left-register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col h-full items-start justify-center"
              >
                <h1 className="text-3xl font-bold tracking-tight mb-4 text-left">Criar Perfil</h1>
                <p className="font-normal opacity-90 text-sm mb-8 text-left leading-relaxed">
                  Configure sua conta para receber insights e acesse imediatamente o seu painel de informes.
                </p>

                <div className="flex flex-col gap-4 w-full">
                  <div className="bg-black/10 p-4 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white/10 rounded-lg">
                        <ShieldCheck className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <h3 className="font-semibold text-sm">Segurança Total</h3>
                    </div>
                    <p className="text-xs opacity-75 leading-relaxed">
                      Seus dados são criptografados de ponta a ponta. Usamos tecnologia bancária para proteger suas informações.
                    </p>
                  </div>

                  <div className="bg-black/10 p-4 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white/10 rounded-lg">
                        <FileText className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <h3 className="font-semibold text-sm">Gestão Inteligente</h3>
                    </div>
                    <p className="text-xs opacity-75 leading-relaxed">
                      Preencha seus dados para que nossa plataforma gere suas vias digitalizadas automaticamente.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="left-recovery"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col h-full items-start justify-center"
              >
                <h1 className="text-3xl font-bold tracking-tight mb-4 text-left">Recuperar Senha</h1>
                <p className="font-normal opacity-90 text-sm mb-8 text-left leading-relaxed">
                  Não se preocupe! Informe seu e-mail e enviaremos um link seguro para você redefinir sua senha.
                </p>

                <div className="flex flex-col gap-4 w-full">
                  <div className="bg-black/10 p-4 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white/10 rounded-lg">
                        <ShieldCheck className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <h3 className="font-semibold text-sm">Processo Seguro</h3>
                    </div>
                    <p className="text-xs opacity-75 leading-relaxed">
                      O link de recuperação é único e expira em algumas horas para garantir a segurança da sua conta.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ============================================================== */}
        {/* PAINEL DIREITO (Formulários)                                   */}
        {/* ============================================================== */}
        <div className="md:w-[55%] p-8 lg:p-12 flex flex-col justify-center bg-card relative">
          <AnimatePresence mode="wait">
            {/* -------------------- FORMULÁRIO DE LOGIN -------------------- */}
            {!isRegistering && !isRecovering ? (
              <motion.div
                key="form-login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-md mx-auto"
              >
                <div className="mb-8">
                  <h2 className="text-4xl font-bold tracking-tight text-foreground mb-2">Acesso</h2>
                  <p className="text-sm text-muted-foreground font-medium">Insira suas credenciais para acesso a conta</p>
                </div>

                <form className="space-y-4" onSubmit={handleLogin} noValidate>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">E-mail</label>
                    <input
                      type="email"
                      placeholder="voce@exemplo.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                      className="flex h-12 w-full rounded-md border bg-transparent px-4 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1 relative group">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Senha</label>
                      <button 
                        type="button" 
                        onClick={() => setIsRecovering(true)}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isSubmitting}
                        className="flex h-12 w-full rounded-md border bg-transparent px-4 py-2 pr-10 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-600 text-sm border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400 animate-in fade-in duration-200">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="pt-2 flex flex-col space-y-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow hover:opacity-90 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando...</> : 'Entrar'}
                    </button>
                    
                    <p className="text-center text-sm font-medium text-muted-foreground mt-4">
                      Não tem uma conta?{' '}
                      <button type="button" onClick={() => setIsRegistering(true)} className="text-primary hover:underline font-semibold transition-colors">
                        Cadastre-se
                      </button>
                    </p>
                  </div>
                </form>
              </motion.div>
            ) : isRegistering ? (
              /* -------------------- FORMULÁRIO DE CADASTRO -------------------- */
              <motion.div
                key="form-register"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-lg mx-auto"
              >
                <form className="space-y-4" onSubmit={handleRegister} noValidate>
                  <div className="flex flex-col items-center mb-2 mt-[-10px]">
                    <div className="relative group cursor-pointer mb-2">
                      <div className="h-20 w-20 rounded-full border-2 border-dashed border-border overflow-hidden bg-muted/50 flex items-center justify-center transition-colors group-hover:border-primary">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                          <UserCircle className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                      </div>
                      <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload className="h-5 w-5 text-white" />
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleAvatarChange}
                        disabled={isSubmitting}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">Foto de perfil (Opcional)</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Nome completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Seu nome completo"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      disabled={isSubmitting}
                      className="flex h-11 w-full rounded-md border bg-transparent px-4 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
                    />
                  </div>

                  <div className="flex gap-4">
                    <div className="space-y-1 w-full relative group">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Telefone (WhatsApp) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                        value={regPhone}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, '');
                          if (v.length > 11) v = v.substring(0, 11);
                          if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
                          if (v.length > 9) v = `${v.substring(0, 10)}-${v.substring(10)}`;
                          setRegPhone(v);
                        }}
                        disabled={isSubmitting}
                        className="flex h-11 w-full rounded-md border bg-transparent px-4 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      E-mail principal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="voce@exemplo.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      disabled={isSubmitting}
                      className="flex h-11 w-full rounded-md border bg-transparent px-4 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
                    />
                  </div>

                  <div className="flex gap-4">
                    <div className="space-y-1 w-full relative group">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Senha <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showRegPassword ? "text" : "password"}
                          placeholder="mín. 6 caracteres"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          disabled={isSubmitting}
                          className="flex h-11 w-full rounded-md border bg-transparent px-4 py-2 pr-10 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 w-full relative group">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Confirma senha <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showRegConfirm ? "text" : "password"}
                          placeholder="repita a senha"
                          value={regConfirm}
                          onChange={(e) => setRegConfirm(e.target.value)}
                          disabled={isSubmitting}
                          className="flex h-11 w-full rounded-md border bg-transparent px-4 py-2 pr-10 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegConfirm(!showRegConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showRegConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-600 text-sm border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400 animate-in fade-in duration-200">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 text-green-700 text-sm border border-green-200 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400 animate-in fade-in duration-200">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {success}
                    </div>
                  )}

                  <div className="pt-6 flex items-center justify-end gap-3 mt-4">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setIsRegistering(false)}
                      className="px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted border bg-card rounded-md transition-colors disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 bg-primary text-primary-foreground hover:opacity-90 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</> : 'Criar conta'}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              /* -------------------- FORMULÁRIO DE RECUPERAÇÃO -------------------- */
              <motion.div
                key="form-recovery"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-md mx-auto"
              >
                <div className="mb-8">
                  <h2 className="text-4xl font-bold tracking-tight text-foreground mb-2">Esqueceu a Senha?</h2>
                  <p className="text-sm text-muted-foreground font-medium">Enviaremos as instruções para o seu e-mail.</p>
                </div>

                <form className="space-y-4" onSubmit={handleRecoverPassword} noValidate>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">E-mail</label>
                    <input
                      type="email"
                      placeholder="voce@exemplo.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                      className="flex h-12 w-full rounded-md border bg-transparent px-4 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-600 text-sm border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400 animate-in fade-in duration-200">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 text-green-700 text-sm border border-green-200 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400 animate-in fade-in duration-200">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {success}
                    </div>
                  )}

                  <div className="pt-2 flex flex-col space-y-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow hover:opacity-90 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Enviar link de recuperação'}
                    </button>
                    
                    <button 
                      type="button" 
                      onClick={() => setIsRecovering(false)} 
                      className="text-center text-sm font-medium text-muted-foreground hover:text-foreground mt-4 transition-colors"
                      disabled={isSubmitting}
                    >
                      Voltar para o Login
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
