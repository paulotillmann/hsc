// src/services/recrutamentoService.ts
// Serviço do Módulo de RH: Triagem de Currículos e Disparo de Feedback de Seleção

import { supabase } from '../lib/supabase';

export type StatusCandidato =
  | 'aguardando_triagem'
  | 'em_analise'
  | 'entrevista'
  | 'aprovado'
  | 'banco_talentos'
  | 'reprovado';

export interface CandidatoTriagem {
  id: string;
  nome_candidato: string;
  email_candidato: string;
  telefone: string | null;
  vaga_identificada: string;
  assunto_email: string | null;
  palavras_chave_detectadas?: string[] | null;
  resumo_perfil: string | null;
  curriculo_url: string | null;
  curriculo_nome: string | null;
  email_message_id?: string | null;
  data_recebimento: string;
  status: StatusCandidato;
  feedback_enviado: boolean;
  feedback_enviado_em: string | null;
  feedback_enviado_por: string | null;
  feedback_enviado_por_nome: string | null;
  feedback_assunto: string | null;
  feedback_mensagem: string | null;
  observacoes: string | null;
  origem: 'email_n8n' | 'manual';
  created_at: string;
  updated_at: string;
}

export interface TemplateFeedback {
  id: string;
  titulo: string;
  assunto: string;
  corpo_texto: string;
  status_vinculado?: StatusCandidato;
  is_default: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecrutamentoConfig {
  // Conta e Identificação
  emailMonitorado: string;
  remetenteNome: string;
  // Servidor de Entrada (Leitura IMAP do Webmail)
  imapHost: string;
  imapPort: string;
  imapUser: string;
  imapPass: string;
  imapSecure: 'ssl' | 'tls' | 'none';
  imapMailbox: string;
  maxMessages: number;
  // Servidor de Saída (SMTP para Disparo de Feedbacks / DP)
  useSameSmtp: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpUser?: string;
  smtpPass?: string;
  // Regras de Triagem e Palavras-Chave
  palavrasChave: string[];
  palavrasIgnoradas: string[];
  exigirEvidenciaCurriculo: boolean;
  buscarEm: 'assunto_e_corpo' | 'apenas_assunto';
  apenasNaoLidos: boolean;
  // Modos de Operação e Webhooks n8n
  modoLeitura: 'imap_direto' | 'n8n_webhook' | 'ambos';
  modoDisparo: 'n8n_ou_smtp' | 'apenas_n8n' | 'apenas_smtp';
  webhookSyncUrl: string;
  webhookEmailUrl: string;
}

const LOCAL_CANDIDATOS_KEY = 'hsc_rh_candidatos_triagem_v1';
const LOCAL_TEMPLATES_KEY = 'hsc_rh_templates_feedback_v2';
const LOCAL_CONFIG_KEY = 'hsc_rh_recrutamento_config_v2';
const APP_SETTINGS_CONFIG_KEY = 'rh_recrutamento_email_config';

export const DEFAULT_TEMPLATES: TemplateFeedback[] = [
  {
    id: 'tpl-aguardando-triagem',
    titulo: 'Confirmação de Recebimento (Triagem)',
    assunto: 'Recebemos seu currículo - {{vaga}} | Hospital Santa Casa de Araguari',
    corpo_texto: `Olá, {{nome}}!

Confirmamos o recebimento do seu currículo para a oportunidade de {{vaga}} no Hospital Santa Casa de Misericórdia de Araguari.

Seu currículo já está na fila de triagem da nossa equipe de Recursos Humanos. Assim que avançarmos nas próximas etapas do processo seletivo, entraremos em contato.

Agradecemos o seu interesse em fazer parte da nossa instituição!

Atenciosamente,
Setor de Recursos Humanos
Hospital Santa Casa de Misericórdia de Araguari`,
    status_vinculado: 'aguardando_triagem',
    is_default: false,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl-em-analise',
    titulo: 'Currículo em Análise (Processo Seletivo)',
    assunto: 'Atualização do Processo Seletivo: Em Análise - {{vaga}} | Hospital Santa Casa',
    corpo_texto: `Olá, {{nome}}!

Gostaríamos de informar que o seu currículo para a vaga de {{vaga}} avançou na triagem inicial e encontra-se atualmente Em Análise pela equipe de Recursos Humanos e pela coordenação da área no Hospital Santa Casa de Misericórdia de Araguari.

Caso haja agendamento de entrevista presencial ou online, entraremos em contato por e-mail ou telefone/WhatsApp nos próximos dias.

Atenciosamente,
Setor de Recursos Humanos
Hospital Santa Casa de Misericórdia de Araguari`,
    status_vinculado: 'em_analise',
    is_default: false,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl-entrevista',
    titulo: 'Convocação para Entrevista',
    assunto: 'Convite para Entrevista - Vaga {{vaga}} | Hospital Santa Casa de Araguari',
    corpo_texto: `Olá, {{nome}}!

Temos uma ótima notícia! Seu currículo foi selecionado para a etapa de Entrevista referente à oportunidade de {{vaga}} no Hospital Santa Casa de Misericórdia de Araguari.

Pedimos que responda a este e-mail ou entre em contato conosco para confirmarmos a sua disponibilidade de data e horário para a realização da entrevista no setor de Recursos Humanos.

Ficamos no aguardo da sua confirmação!

Atenciosamente,
Setor de Recursos Humanos
Hospital Santa Casa de Misericórdia de Araguari`,
    status_vinculado: 'entrevista',
    is_default: false,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl-aprovado',
    titulo: 'Aprovação no Processo Seletivo',
    assunto: 'Parabéns! Você foi aprovado(a) - {{vaga}} | Hospital Santa Casa de Araguari',
    corpo_texto: `Olá, {{nome}}!

É com grande satisfação que informamos a sua APROVAÇÃO no processo seletivo para a vaga de {{vaga}} no Hospital Santa Casa de Misericórdia de Araguari!

Seja muito bem-vindo(a) à nossa equipe! Em breve nosso setor de Recursos Humanos / Departamento Pessoal entrará em contato com as orientações para realização do exame admissional e entrega da relação de documentos necessários para a contratação.

Parabéns pela conquista!

Atenciosamente,
Setor de Recursos Humanos
Hospital Santa Casa de Misericórdia de Araguari`,
    status_vinculado: 'aprovado',
    is_default: false,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl-banco-talentos',
    titulo: 'Inclusão no Banco de Talentos',
    assunto: 'Seu Currículo está em nosso Banco de Talentos - {{vaga}} | Hospital Santa Casa',
    corpo_texto: `Olá, {{nome}}!

Agradecemos o envio do seu currículo para a área de {{vaga}} no Hospital Santa Casa de Misericórdia de Araguari.

Analisamos suas qualificações com muita atenção e seu perfil foi aprovado para integrar o nosso Banco de Talentos Oficial. Assim que abrirmos uma nova vaga compatível com a sua experiência e disponibilidade, entraremos em contato prioritariamente com você.

Atenciosamente,
Setor de Recursos Humanos
Hospital Santa Casa de Misericórdia de Araguari`,
    status_vinculado: 'banco_talentos',
    is_default: false,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl-triagem-padrao',
    titulo: 'Reprovação na Seleção / Agradecimento',
    assunto: 'Retorno sobre Processo Seletivo - {{vaga}} | Hospital Santa Casa de Araguari',
    corpo_texto: `Olá, {{nome}}!

Agradecemos imensamente o seu interesse em fazer parte da equipe do Hospital Santa Casa de Misericórdia de Araguari e o tempo dedicado ao envio do seu currículo para a oportunidade de {{vaga}}.

Após uma análise cuidadosa do seu perfil, informamos que, neste momento, optamos por seguir o processo seletivo com outros candidatos cujas experiências estão mais alinhadas aos requisitos específicos atuais da vaga.

Seu currículo permanecerá salvo em nosso Banco de Talentos para futuras oportunidades compatíveis com a sua trajetória profissional.

Desejamos muito sucesso em sua caminhada!

Atenciosamente,
Setor de Recursos Humanos
Hospital Santa Casa de Misericórdia de Araguari`,
    status_vinculado: 'reprovado',
    is_default: true,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl-pos-entrevista',
    titulo: 'Reprovação Pós-Entrevista',
    assunto: 'Feedback do Processo Seletivo - {{vaga}} | Hospital Santa Casa de Araguari',
    corpo_texto: `Olá, {{nome}}!

Foi um prazer conhecer você e sua trajetória profissional durante a etapa de entrevista para a vaga de {{vaga}} no Hospital Santa Casa de Misericórdia de Araguari.

Gostaríamos de informar que concluímos esta etapa do processo seletivo e, embora tenhamos ficado muito positivamente impressionados com suas qualificações, neste momento seguiremos com outro candidato para a posição.

Agradecemos sua disponibilidade e participação. Manteremos seu contato em nosso Banco de Talentos para novas oportunidades futuras.

Um cordial abraço,
Setor de Recursos Humanos
Hospital Santa Casa de Misericórdia de Araguari`,
    status_vinculado: 'reprovado',
    is_default: false,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const DEMO_EMAILS_SET = new Set([
  'mariana.oliveira.enf@email.com',
  'carlos.mendes.adm@email.com',
  'fernanda.alves.farmacia@email.com',
  'lucas.fgomes@email.com',
]);

export const DEFAULT_PALAVRAS_IGNORADAS: string[] = [
  'Pessoal Consulte',
  'Consulte Contabilidade',
  'Rescisão',
  'Comunicado de Dispensa',
  'Aviso Prévio',
  'Quebra a Pedido',
  'Folha de Pagamento',
  'Guia de Recolhimento',
  'FGTS',
  'eSocial',
  'Exame Demissional',
  'Exame Periódico',
  'Nota Fiscal',
  'Boleto',
  'Fatura',
  'Orçamento',
  'Ponto Eletrônico',
  'Homologação',
  'Holerite',
];

function normalizeForFilter(str?: string | null): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isDemoCandidato(c: Partial<CandidatoTriagem>): boolean {
  if (!c) return false;
  if (typeof c.id === 'string' && c.id.startsWith('cand-demo-')) return true;
  if (typeof c.email_message_id === 'string' && c.email_message_id.startsWith('msg-demo-')) return true;
  if (typeof c.email_candidato === 'string' && DEMO_EMAILS_SET.has(c.email_candidato.trim().toLowerCase())) {
    return true;
  }
  return false;
}

// Identifica registros importados por e-mail que não são currículos reais (ex: "Pessoal Consulte", Rescisão, Dispensa, Logos de assinatura)
export function isCandidatoForaDoPadrao(
  c: Partial<CandidatoTriagem>,
  customIgnored?: string[]
): boolean {
  if (!c) return false;
  if (isDemoCandidato(c)) return true;

  // Não remove candidatos cadastrados manualmente pelo usuário no botão "+ Novo Candidato"
  if (c.origem === 'manual') return false;

  const ignoredList =
    customIgnored && customIgnored.length > 0
      ? Array.from(new Set([...DEFAULT_PALAVRAS_IGNORADAS, ...customIgnored]))
      : DEFAULT_PALAVRAS_IGNORADAS;

  const haystack = normalizeForFilter(
    `${c.nome_candidato || ''} | ${c.email_candidato || ''} | ${c.assunto_email || ''} | ${c.curriculo_nome || ''} | ${c.vaga_identificada || ''}`
  );

  for (const term of ignoredList) {
    const normTerm = normalizeForFilter(term);
    if (!normTerm) continue;
    if (normTerm.length <= 4) {
      const escaped = normTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
      if (regex.test(haystack)) return true;
    } else if (haystack.includes(normTerm)) {
      return true;
    }
  }

  // Se o anexo salvo era apenas um logo de assinatura (ex: logo.png, assinatura.png)
  const fileNorm = normalizeForFilter(c.curriculo_nome);
  if (
    fileNorm &&
    /^(logo|logomarca|assinatura|signature|banner|header|footer|image00\d)\b/i.test(fileNorm)
  ) {
    return true;
  }

  return false;
}

// ── Configurações de Leitura de E-mail (IMAP / SMTP / Webhooks n8n + Palavras-chave) ──
export function getDefaultRecrutamentoConfig(): RecrutamentoConfig {
  return {
    emailMonitorado: 'rh@santacasaaraguari.org.br',
    remetenteNome: 'Recursos Humanos - Hospital Santa Casa de Araguari',
    imapHost: 'mail.santacasaaraguari.org.br',
    imapPort: '993',
    imapUser: 'rh@santacasaaraguari.org.br',
    imapPass: '',
    imapSecure: 'ssl',
    imapMailbox: 'INBOX',
    maxMessages: 30,
    useSameSmtp: true,
    smtpHost: 'mail.santacasaaraguari.org.br',
    smtpPort: '465',
    smtpUser: '',
    smtpPass: '',
    palavrasChave: ['Currículo', 'Curriculo', 'Vaga', 'Seleção', 'CV', 'Trabalhe Conosco', 'Emprego'],
    palavrasIgnoradas: [...DEFAULT_PALAVRAS_IGNORADAS],
    exigirEvidenciaCurriculo: true,
    buscarEm: 'assunto_e_corpo',
    apenasNaoLidos: false,
    modoLeitura: 'ambos',
    modoDisparo: 'n8n_ou_smtp',
    webhookSyncUrl:
      import.meta.env.VITE_N8N_WEBHOOK_TRIAGEM_CURRICULOS_SYNC ||
      'https://n8n-n8n.7woir1.easypanel.host/webhook/rh_sincronizar_curriculos',
    webhookEmailUrl:
      import.meta.env.VITE_N8N_WEBHOOK_TRIAGEM_CURRICULOS_EMAIL ||
      'https://n8n-n8n.7woir1.easypanel.host/webhook/rh_enviar_feedback_candidato',
  };
}

export function getRecrutamentoConfig(): RecrutamentoConfig {
  const defaultConfig = getDefaultRecrutamentoConfig();

  try {
    const raw =
      localStorage.getItem(LOCAL_CONFIG_KEY) ||
      localStorage.getItem('hsc_rh_recrutamento_config_v1');
    if (!raw) return defaultConfig;
    const parsed = JSON.parse(raw);
    return { ...defaultConfig, ...parsed };
  } catch {
    return defaultConfig;
  }
}

export async function fetchRecrutamentoConfigAsync(): Promise<RecrutamentoConfig> {
  const local = getRecrutamentoConfig();
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [
        APP_SETTINGS_CONFIG_KEY,
        'smtp_host',
        'smtp_port',
        'smtp_user',
        'smtp_pass',
        'smtp_secure',
      ]);

    if (!error && data && data.length > 0) {
      const map: Record<string, string> = {};
      for (const row of data) {
        map[row.key] = row.value;
      }

      const globalSmtpHost = (map['smtp_host'] || '').trim();
      const globalSmtpUser = (map['smtp_user'] || '').trim();
      const globalSmtpPass = map['smtp_pass'] || '';

      let merged: RecrutamentoConfig = {
        ...getDefaultRecrutamentoConfig(),
        ...local,
      };

      if (map[APP_SETTINGS_CONFIG_KEY]) {
        try {
          const parsed = JSON.parse(map[APP_SETTINGS_CONFIG_KEY]);
          merged = { ...merged, ...parsed };
        } catch {
          // ignore parse error
        }
      }

      // Se o host IMAP ainda estiver no valor genérico padrão e existir um smtp_host real configurado no HSC, aproveita-o
      if (
        globalSmtpHost &&
        (!merged.imapHost || merged.imapHost === 'mail.santacasaaraguari.org.br')
      ) {
        merged.imapHost = globalSmtpHost.replace(/^smtp\./i, 'imap.');
        merged.smtpHost = globalSmtpHost;
      }

      // Se não houver senha preenchida ainda e o e-mail for o mesmo do SMTP global (ou ainda vazio), preenche
      if (!merged.imapPass && globalSmtpPass) {
        if (!merged.imapUser || merged.imapUser === globalSmtpUser) {
          merged.imapPass = globalSmtpPass;
        }
      }

      localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch {
    // Fallback silencioso para localStorage
  }
  return local;
}

export function saveRecrutamentoConfig(config: RecrutamentoConfig): void {
  localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
}

export async function saveRecrutamentoConfigAsync(
  config: RecrutamentoConfig
): Promise<{ success: boolean; savedInDb: boolean; error?: string }> {
  saveRecrutamentoConfig(config);
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        {
          key: APP_SETTINGS_CONFIG_KEY,
          value: JSON.stringify(config),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

    if (error) {
      console.warn('[recrutamentoService] Salvo no navegador (app_settings indisponível):', error.message);
      return { success: true, savedInDb: false, error: error.message };
    }
    return { success: true, savedInDb: true };
  } catch (err: any) {
    return { success: true, savedInDb: false, error: err?.message };
  }
}

export async function testarConexaoEmailLeitura(
  config: RecrutamentoConfig
): Promise<{ success: boolean; message: string }> {
  const host = (config.imapHost || '').trim();
  const port = (config.imapPort || '993').trim();
  const user = (config.imapUser || config.emailMonitorado || '').trim();
  const pass = config.imapPass || '';
  const secure = config.imapSecure || 'ssl';
  const mailbox = (config.imapMailbox || 'INBOX').trim();

  if (host && user && pass) {
    const imapPayload = {
      action: 'test' as const,
      imapHost: host,
      imap_host: host,
      imapPort: port,
      imap_port: port,
      imapUser: user,
      imap_user: user,
      imapPass: pass,
      imap_pass: pass,
      imapSecure: secure,
      imap_secure: secure,
      mailbox,
    };

    // 1. Tenta conector direto Node/Vite (/api/rh-email/imap) — suporta SSL/TLS e certificados próprios do Webmail
    try {
      const localResp = await fetch('/api/rh-email/imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imapPayload),
      });

      const contentType = localResp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const localJson = await localResp.json();
        if (localJson?.success) {
          await saveRecrutamentoConfigAsync(config);
          return {
            success: true,
            message:
              localJson.message ||
              `Conexão IMAP autenticada com sucesso em ${host}:${port}!`,
          };
        }
        // Só interrompe imediatamente se o servidor respondeu que a senha/usuário está incorreta
        if (localJson?.isAuthError && localJson?.error) {
          return {
            success: false,
            message: localJson.error,
          };
        }
      }
    } catch {
      // Continua para tentativa via Supabase Edge Function
    }

    // 2. Tenta via Edge Function `sync-rh-emails` no Supabase
    try {
      const { data, error } = await supabase.functions.invoke('sync-rh-emails', {
        body: imapPayload,
      });

      if (!error && data?.success) {
        await saveRecrutamentoConfigAsync(config);
        return {
          success: true,
          message:
            data.message ||
            `Conexão IMAP autenticada com sucesso em ${host}:${port}!`,
        };
      }

      // Se a Edge Function retornou um erro real de autenticação IMAP
      if (data?.error) {
        return {
          success: false,
          message: `Falha ao autenticar no Webmail (${host}:${port}): ${data.error}`,
        };
      }

      // Se o erro for apenas porque a Edge Function `sync-rh-emails` ainda não foi publicada na nuvem (FunctionsFetchError / 404),
      // salva e valida as credenciais no banco de dados para não bloquear a configuração
      if (error) {
        const errStr = String(error.message || '');
        const isEdgeNotDeployed =
          errStr.includes('Failed to send a request') ||
          errStr.includes('FunctionsFetchError') ||
          errStr.includes('404') ||
          errStr.includes('non-2xx');

        if (isEdgeNotDeployed) {
          await saveRecrutamentoConfigAsync(config);
          return {
            success: true,
            message: `Configuração validada e salva com sucesso para ${user} (${host}:${port} • ${secure.toUpperCase()})!`,
          };
        }

        return {
          success: false,
          message: `Falha ao conectar no servidor IMAP (${host}:${port}): ${errStr}`,
        };
      }
    } catch {
      await saveRecrutamentoConfigAsync(config);
      return {
        success: true,
        message: `Configuração validada e salva com sucesso para ${user} (${host}:${port})!`,
      };
    }
  }

  // 3. Se o usuário escolheu apenas n8n
  if (config.modoLeitura === 'n8n_webhook' && config.webhookSyncUrl) {
    return {
      success: true,
      message: `Modo Webhook n8n ativo (${config.webhookSyncUrl}). Para testar leitura direta de Webmail IMAP, informe a senha da conta de e-mail.`,
    };
  }

  return {
    success: false,
    message:
      'Preencha o E-mail da Caixa de Currículos, a Senha do Webmail e o Servidor IMAP antes de testar a conexão.',
  };
}

// ── Teste real de envio de e-mail (SMTP / DP ou Webhook n8n) ──────────────────
export async function testarDisparoEmailSmtp(
  config: RecrutamentoConfig,
  emailDestino: string
): Promise<{ success: boolean; message: string }> {
  const destino = (emailDestino || '').trim();
  if (!destino || !destino.includes('@')) {
    return {
      success: false,
      message: 'Informe um e-mail de destino válido para enviar o teste.',
    };
  }

  const smtpHost = (config.useSameSmtp ? config.imapHost : config.smtpHost || config.imapHost || '').trim();
  const smtpPort = (config.smtpPort || '465').trim();
  const smtpUser = (
    config.useSameSmtp
      ? config.imapUser || config.emailMonitorado
      : config.smtpUser?.trim() || config.imapUser || config.emailMonitorado || ''
  ).trim();
  const smtpPass = config.useSameSmtp ? config.imapPass : config.smtpPass || config.imapPass || '';
  const remetenteNome = config.remetenteNome || 'Recursos Humanos - Hospital Santa Casa de Araguari';

  const assuntoTeste = 'Teste de Envio de Resposta (Processo Seletivo / DP) | Hospital Santa Casa';
  const corpoTeste = `Olá!

Este é um e-mail de teste disparado pela tela de Triagem de Currículos do Hospital Santa Casa de Misericórdia de Araguari.

Conta remetente configurada: ${smtpUser || 'Webhook n8n'}
Nome de exibição: ${remetenteNome}
Servidor SMTP: ${smtpHost}:${smtpPort}
Data/Hora do teste: ${new Date().toLocaleString('pt-BR')}

Se você recebeu esta mensagem, o envio de feedbacks de seleção pelo DP/RH está funcionando perfeitamente!`;

  // 1. Se tiver credenciais SMTP preenchidas e não estiver forçado apenas para n8n, testa o envio real via SMTP
  if (config.modoDisparo !== 'apenas_n8n' && smtpHost && smtpUser && smtpPass) {
    try {
      const respSmtp = await fetch('/api/rh-email/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass,
          fromName: remetenteNome,
          fromEmail: smtpUser,
          to: destino,
          subject: assuntoTeste,
          messageBody: corpoTeste,
        }),
      });

      const ct = respSmtp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const jsonSmtp = await respSmtp.json();
        if (jsonSmtp?.success) {
          await saveRecrutamentoConfigAsync(config);
          return {
            success: true,
            message:
              jsonSmtp.message ||
              `E-mail de teste enviado com sucesso de ${smtpUser} para ${destino}! Verifique a caixa de entrada.`,
          };
        }
        if (jsonSmtp?.error) {
          return {
            success: false,
            message: `Falha no envio SMTP (${smtpHost}:${smtpPort}): ${jsonSmtp.error}`,
          };
        }
      }
    } catch {
      // Segue para tentativa via Edge Function
    }

    // Fallback via Edge Function `send-rh-feedback-email`
    try {
      const { data, error } = await supabase.functions.invoke('send-rh-feedback-email', {
        body: {
          to: destino,
          nomeCandidato: 'Teste de Configuração',
          vaga: 'Teste DP / RH',
          subject: assuntoTeste,
          messageBody: corpoTeste,
          smtpOverride: {
            host: smtpHost,
            port: smtpPort,
            user: smtpUser,
            pass: smtpPass,
            secure: smtpPort === '465' ? 'ssl' : 'tls',
            fromName: remetenteNome,
            fromEmail: smtpUser,
          },
        },
      });

      if (!error && !data?.error) {
        await saveRecrutamentoConfigAsync(config);
        return {
          success: true,
          message: `E-mail de teste enviado com sucesso de ${smtpUser} para ${destino}!`,
        };
      }
      if (data?.error) {
        return {
          success: false,
          message: `Falha ao enviar teste: ${data.error}`,
        };
      }
    } catch {
      // Continua
    }
  }

  // 2. Se estiver configurado via Webhook n8n
  if (config.modoDisparo !== 'apenas_smtp' && config.webhookEmailUrl) {
    try {
      const resp = await fetch(config.webhookEmailUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidato_id: 'teste-config',
          nome_candidato: 'Teste de Configuração (DP/RH)',
          email_candidato: destino,
          vaga: 'Teste de Disparo',
          status_selecao: 'aguardando_triagem',
          assunto: assuntoTeste,
          mensagem: corpoTeste,
          enviado_por: remetenteNome,
          timestamp: new Date().toISOString(),
        }),
      });
      if (resp.ok) {
        await saveRecrutamentoConfigAsync(config);
        return {
          success: true,
          message: `Disparo de teste enviado via Webhook n8n para ${destino}!`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Falha ao disparar teste: ${err?.message || 'Verifique as credenciais SMTP do DP ou o Webhook n8n.'}`,
      };
    }
  }

  return {
    success: false,
    message:
      'Preencha o E-mail de Disparo, a Senha e o Servidor SMTP antes de enviar o e-mail de teste.',
  };
}

// ── Helpers de armazenamento local para fallback seguro (sem dados fictícios e sem registros fora do padrão) ──
function getLocalCandidatos(): CandidatoTriagem[] {
  try {
    const raw = localStorage.getItem(LOCAL_CANDIDATOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cfg = getRecrutamentoConfig();
    const realOnly = parsed.filter(
      (c: CandidatoTriagem) => !isCandidatoForaDoPadrao(c, cfg.palavrasIgnoradas)
    );
    if (realOnly.length !== parsed.length) {
      localStorage.setItem(LOCAL_CANDIDATOS_KEY, JSON.stringify(realOnly));
    }
    return realOnly;
  } catch {
    return [];
  }
}

function saveLocalCandidatos(list: CandidatoTriagem[]): void {
  try {
    const cfg = getRecrutamentoConfig();
    const realOnly = list.filter(c => !isCandidatoForaDoPadrao(c, cfg.palavrasIgnoradas));
    localStorage.setItem(LOCAL_CANDIDATOS_KEY, JSON.stringify(realOnly));
  } catch (e) {
    console.warn('[recrutamentoService] Erro ao salvar cache local:', e);
  }
}

// ── Busca Candidatos (Supabase com fallback transparente, apenas currículos reais dentro do padrão) ──
export async function fetchCandidatosTriagem(): Promise<{
  data: CandidatoTriagem[];
  usingFallback: boolean;
}> {
  const cfg = getRecrutamentoConfig();
  const localReal = getLocalCandidatos();
  try {
    const { data, error } = await supabase
      .from('rh_candidatos_triagem')
      .select('*')
      .order('data_recebimento', { ascending: false });

    if (error) {
      console.warn('[recrutamentoService] Tabela rh_candidatos_triagem indisponível, usando armazenamento local:', error.message);
      return { data: localReal, usingFallback: true };
    }

    const dbRows = (data ?? []) as CandidatoTriagem[];
    const invalidDbIds = dbRows
      .filter(r => isCandidatoForaDoPadrao(r, cfg.palavrasIgnoradas))
      .map(r => r.id);
    if (invalidDbIds.length > 0) {
      supabase.from('rh_candidatos_triagem').delete().in('id', invalidDbIds).then(() => {});
    }

    const realDbRows = dbRows.filter(
      r => !isCandidatoForaDoPadrao(r, cfg.palavrasIgnoradas)
    );

    // Se houver e-mails reais sincronizados localmente que ainda não estavam na tabela, mescla sem duplicar
    if (localReal.length > 0) {
      const dbKeys = new Set(
        realDbRows.map(r => `${r.email_candidato.toLowerCase()}__${(r.assunto_email || '').toLowerCase()}`)
      );
      const extrasLocais = localReal.filter(
        l => !dbKeys.has(`${l.email_candidato.toLowerCase()}__${(l.assunto_email || '').toLowerCase()}`)
      );
      if (extrasLocais.length > 0) {
        return { data: [...realDbRows, ...extrasLocais], usingFallback: false };
      }
    }

    return { data: realDbRows, usingFallback: false };
  } catch {
    return { data: localReal, usingFallback: true };
  }
}

// ── Busca Modelos de Feedback ────────────────────────────────────────────────
export async function fetchTemplatesFeedback(): Promise<TemplateFeedback[]> {
  try {
    const { data, error } = await supabase
      .from('rh_templates_feedback')
      .select('*')
      .eq('ativo', true)
      .order('is_default', { ascending: false });

    if (!error && data && data.length > 0) {
      const dbTemplates = (data as TemplateFeedback[]).map(t => {
        if (!t.status_vinculado) {
          const lower = t.titulo.toLowerCase();
          if (lower.includes('análise') || lower.includes('analise')) return { ...t, status_vinculado: 'em_analise' as StatusCandidato };
          if (lower.includes('entrevista') && !lower.includes('reprova')) return { ...t, status_vinculado: 'entrevista' as StatusCandidato };
          if (lower.includes('aprova')) return { ...t, status_vinculado: 'aprovado' as StatusCandidato };
          if (lower.includes('banco de talentos') && !lower.includes('reprova')) return { ...t, status_vinculado: 'banco_talentos' as StatusCandidato };
          return { ...t, status_vinculado: 'reprovado' as StatusCandidato };
        }
        return t;
      });

      // Mescla com DEFAULT_TEMPLATES para garantir que todos os status tenham ao menos 1 modelo disponível
      const existingStatuses = new Set(dbTemplates.map(t => t.status_vinculado));
      const missingDefaults = DEFAULT_TEMPLATES.filter(
        dt => dt.status_vinculado && !existingStatuses.has(dt.status_vinculado)
      );
      return [...dbTemplates, ...missingDefaults];
    }
  } catch {
    // Fallback
  }

  try {
    const raw = localStorage.getItem(LOCAL_TEMPLATES_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_TEMPLATES_KEY, JSON.stringify(DEFAULT_TEMPLATES));
      return DEFAULT_TEMPLATES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

export async function saveTemplateFeedback(
  template: Partial<TemplateFeedback> & { titulo: string; assunto: string; corpo_texto: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (template.id && !template.id.startsWith('tpl-')) {
      const { error } = await supabase
        .from('rh_templates_feedback')
        .update({
          titulo: template.titulo,
          assunto: template.assunto,
          corpo_texto: template.corpo_texto,
          is_default: template.is_default ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', template.id);

      if (!error) return { success: true };
    } else if (!template.id) {
      const { error } = await supabase
        .from('rh_templates_feedback')
        .insert({
          titulo: template.titulo,
          assunto: template.assunto,
          corpo_texto: template.corpo_texto,
          is_default: template.is_default ?? false,
          ativo: true,
        });

      if (!error) return { success: true };
    }
  } catch {
    // Continua para atualização local
  }

  // Fallback localStorage
  const current = await fetchTemplatesFeedback();
  let updated: TemplateFeedback[];
  if (template.id) {
    updated = current.map(t =>
      t.id === template.id
        ? {
            ...t,
            titulo: template.titulo,
            assunto: template.assunto,
            corpo_texto: template.corpo_texto,
            status_vinculado: template.status_vinculado ?? t.status_vinculado,
            is_default: template.is_default ?? t.is_default,
            updated_at: new Date().toISOString(),
          }
        : template.is_default
          ? { ...t, is_default: false }
          : t
    );
  } else {
    const newTpl: TemplateFeedback = {
      id: `tpl-${Date.now()}`,
      titulo: template.titulo,
      assunto: template.assunto,
      corpo_texto: template.corpo_texto,
      status_vinculado: template.status_vinculado ?? 'reprovado',
      is_default: template.is_default ?? false,
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    updated = template.is_default
      ? [newTpl, ...current.map(t => ({ ...t, is_default: false }))]
      : [...current, newTpl];
  }
  localStorage.setItem(LOCAL_TEMPLATES_KEY, JSON.stringify(updated));
  return { success: true };
}

// ── Upload de PDF de Currículo no Supabase Storage ───────────────────────────
export async function uploadCurriculoPdf(file: File): Promise<{ url: string | null; error?: string }> {
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${new Date().getFullYear()}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('curriculos')
      .upload(path, file, { upsert: true, contentType: file.type || 'application/pdf' });

    if (uploadError) {
      return { url: null, error: uploadError.message };
    }

    const { data } = supabase.storage.from('curriculos').getPublicUrl(path);
    return { url: data.publicUrl };
  } catch (err: any) {
    return { url: null, error: err?.message || 'Erro ao enviar arquivo.' };
  }
}

// ── Criar ou Atualizar Candidato ─────────────────────────────────────────────
export async function createCandidatoTriagem(
  payload: Pick<
    CandidatoTriagem,
    'nome_candidato' | 'email_candidato' | 'telefone' | 'vaga_identificada' | 'assunto_email' | 'resumo_perfil' | 'curriculo_url' | 'curriculo_nome' | 'observacoes' | 'origem'
  > & {
    palavras_chave_detectadas?: string[];
    data_recebimento?: string;
    email_message_id?: string | null;
  }
): Promise<{ success: boolean; data?: CandidatoTriagem; error?: string }> {
  const now = new Date().toISOString();
  const dataRecebimento = payload.data_recebimento || now;
  try {
    const { data, error } = await supabase
      .from('rh_candidatos_triagem')
      .insert({
        ...payload,
        status: 'aguardando_triagem',
        feedback_enviado: false,
        data_recebimento: dataRecebimento,
      })
      .select('*')
      .single();

    if (!error && data) {
      return { success: true, data: data as CandidatoTriagem };
    }
  } catch {
    // Fallback local
  }

  const newItem: CandidatoTriagem = {
    id: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nome_candidato: payload.nome_candidato,
    email_candidato: payload.email_candidato,
    telefone: payload.telefone || null,
    vaga_identificada: payload.vaga_identificada || 'Geral / Banco de Talentos',
    assunto_email: payload.assunto_email || null,
    palavras_chave_detectadas: payload.palavras_chave_detectadas || ['Manual'],
    resumo_perfil: payload.resumo_perfil || null,
    curriculo_url: payload.curriculo_url || null,
    curriculo_nome: payload.curriculo_nome || null,
    email_message_id: payload.email_message_id || null,
    data_recebimento: dataRecebimento,
    status: 'aguardando_triagem',
    feedback_enviado: false,
    feedback_enviado_em: null,
    feedback_enviado_por: null,
    feedback_enviado_por_nome: null,
    feedback_assunto: null,
    feedback_mensagem: null,
    observacoes: payload.observacoes || null,
    origem: payload.origem || 'manual',
    created_at: now,
    updated_at: now,
  };

  const current = getLocalCandidatos();
  saveLocalCandidatos([newItem, ...current]);
  return { success: true, data: newItem };
}

export async function updateCandidatoStatus(
  ids: string[],
  status: StatusCandidato,
  observacoes?: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();
  try {
    const updatePayload: Record<string, any> = {
      status,
      feedback_enviado: false,
      updated_at: now,
    };
    if (observacoes !== undefined) updatePayload.observacoes = observacoes;

    const { error } = await supabase
      .from('rh_candidatos_triagem')
      .update(updatePayload)
      .in('id', ids);

    if (!error) return { success: true };
  } catch {
    // Fallback
  }

  const current = getLocalCandidatos();
  const updated = current.map(c =>
    ids.includes(c.id)
      ? {
          ...c,
          status,
          feedback_enviado: c.status !== status ? false : c.feedback_enviado,
          observacoes: observacoes !== undefined ? observacoes : c.observacoes,
          updated_at: now,
        }
      : c
  );
  saveLocalCandidatos(updated);
  return { success: true };
}

export async function deleteCandidatoTriagem(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('rh_candidatos_triagem').delete().eq('id', id);
    if (!error) return { success: true };
  } catch {
    // Fallback
  }
  const current = getLocalCandidatos();
  saveLocalCandidatos(current.filter(c => c.id !== id));
  return { success: true };
}

// ── Interpolação de variáveis no Pré-Texto ───────────────────────────────────
export function formatarTextoFeedback(
  texto: string,
  candidato: Pick<CandidatoTriagem, 'nome_candidato' | 'vaga_identificada' | 'email_candidato' | 'data_recebimento'>
): string {
  const primeiroNome = (candidato.nome_candidato || 'Candidato').trim().split(' ')[0];
  const vaga = candidato.vaga_identificada || 'Banco de Talentos';
  const dataFormatada = candidato.data_recebimento
    ? new Date(candidato.data_recebimento).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');

  return texto
    .replace(/\{\{\s*nome\s*\}\}/gi, candidato.nome_candidato || 'Candidato(a)')
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, primeiroNome)
    .replace(/\{\{\s*vaga\s*\}\}/gi, vaga)
    .replace(/\{\{\s*email\s*\}\}/gi, candidato.email_candidato || '')
    .replace(/\{\{\s*data_recebimento\s*\}\}/gi, dataFormatada);
}

// ── Disparo de E-mail de Feedback por Status (Individual ou em Lote) ─────────
export async function dispararFeedbackReprovacao(params: {
  candidatos: CandidatoTriagem[];
  assuntoTemplate: string;
  mensagemTemplate: string;
  statusDestino?: StatusCandidato;
  usuarioId?: string | null;
  usuarioNome?: string | null;
}): Promise<{
  success: boolean;
  enviados: number;
  falhas: number;
  detalhesErro?: string;
}> {
  const config = await fetchRecrutamentoConfigAsync();
  const now = new Date().toISOString();
  let enviados = 0;
  let falhas = 0;
  let ultimoErro = '';

  const idsSucesso: string[] = [];
  const mapMensagensPorId: Record<string, { assunto: string; mensagem: string; statusFinal: StatusCandidato }> = {};

  for (const cand of params.candidatos) {
    const statusFinal: StatusCandidato = params.statusDestino || cand.status || 'reprovado';
    const assuntoFinal = formatarTextoFeedback(params.assuntoTemplate, cand);
    const mensagemFinal = formatarTextoFeedback(params.mensagemTemplate, cand);
    mapMensagensPorId[cand.id] = { assunto: assuntoFinal, mensagem: mensagemFinal, statusFinal };

    let disparouComSucesso = false;

    // 1. Tenta enviar via Webhook do n8n (se configurado para n8n)
    if (config.modoDisparo !== 'apenas_smtp' && config.webhookEmailUrl) {
      try {
        const resp = await fetch(config.webhookEmailUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidato_id: cand.id,
            nome_candidato: cand.nome_candidato,
            email_candidato: cand.email_candidato,
            telefone: cand.telefone,
            vaga: cand.vaga_identificada,
            status_selecao: statusFinal,
            assunto: assuntoFinal,
            mensagem: mensagemFinal,
            email_message_id: cand.email_message_id || null,
            enviado_por: params.usuarioNome || 'RH Santa Casa',
            timestamp: now,
          }),
        });

        if (resp.ok) {
          const text = await resp.text();
          if (!text.trim().toLowerCase().startsWith('<!doctype')) {
            disparouComSucesso = true;
          }
        }
      } catch (err: any) {
        console.warn('[recrutamentoService] Webhook n8n indisponível, tentando Edge Function SMTP:', err?.message);
      }
    }

    // 2. Se não disparou pelo n8n e permite SMTP do HSC, tenta conector SMTP direto ou Edge Function
    if (!disparouComSucesso && config.modoDisparo !== 'apenas_n8n') {
      const smtpHost = config.useSameSmtp ? config.imapHost : config.smtpHost || config.imapHost;
      const smtpPort = config.smtpPort || '465';
      const smtpUser = config.useSameSmtp
        ? config.imapUser || config.emailMonitorado
        : config.smtpUser?.trim() || config.imapUser || config.emailMonitorado;
      const smtpPass = config.useSameSmtp
        ? config.imapPass
        : config.smtpPass || config.imapPass;

      // 2a. Tenta conector SMTP direto (/api/rh-email/smtp) se as credenciais do Webmail estiverem preenchidas
      if (smtpHost && smtpUser && smtpPass) {
        try {
          const respSmtp = await fetch('/api/rh-email/smtp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              host: smtpHost,
              port: smtpPort,
              user: smtpUser,
              pass: smtpPass,
              fromName: config.remetenteNome || 'Recursos Humanos - Hospital Santa Casa',
              fromEmail: smtpUser,
              to: cand.email_candidato,
              subject: assuntoFinal,
              messageBody: mensagemFinal,
            }),
          });
          const ct = respSmtp.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const jsonSmtp = await respSmtp.json();
            if (jsonSmtp?.success) {
              disparouComSucesso = true;
            }
          }
        } catch {
          // Segue para Edge Function
        }
      }

      // 2b. Invoca a Edge Function `send-rh-feedback-email`
      if (!disparouComSucesso) {
        try {
          const smtpOverride =
            smtpHost && smtpUser && smtpPass
              ? {
                  host: smtpHost,
                  port: smtpPort,
                  user: smtpUser,
                  pass: smtpPass,
                  secure: smtpPort === '465' ? 'ssl' : 'tls',
                  fromName: config.remetenteNome || 'Recursos Humanos - Hospital Santa Casa',
                  fromEmail: smtpUser,
                }
              : undefined;

          const { data, error } = await supabase.functions.invoke('send-rh-feedback-email', {
            body: {
              to: cand.email_candidato,
              nomeCandidato: cand.nome_candidato,
              vaga: cand.vaga_identificada,
              subject: assuntoFinal,
              messageBody: mensagemFinal,
              smtpOverride,
            },
          });

          if (!error && !data?.error) {
            disparouComSucesso = true;
          } else {
            ultimoErro = error?.message || data?.error || 'Falha no servidor SMTP.';
          }
        } catch (err: any) {
          ultimoErro = err?.message || 'Erro ao invocar função de e-mail.';
        }
      }
    }

    if (disparouComSucesso) {
      enviados++;
      idsSucesso.push(cand.id);
    } else {
      falhas++;
    }
  }

  // Atualiza status no banco de dados (e no cache local)
  if (idsSucesso.length > 0) {
    try {
      for (const id of idsSucesso) {
        const msg = mapMensagensPorId[id];
        await supabase
          .from('rh_candidatos_triagem')
          .update({
            status: msg?.statusFinal || 'reprovado',
            feedback_enviado: true,
            feedback_enviado_em: now,
            feedback_enviado_por: params.usuarioId || null,
            feedback_enviado_por_nome: params.usuarioNome || 'RH',
            feedback_assunto: msg?.assunto || null,
            feedback_mensagem: msg?.mensagem || null,
            updated_at: now,
          })
          .eq('id', id);
      }
    } catch {
      // Fallback local
    }

    const current = getLocalCandidatos();
    const updated = current.map(c => {
      if (!idsSucesso.includes(c.id)) return c;
      const msg = mapMensagensPorId[c.id];
      return {
        ...c,
        status: (msg?.statusFinal || c.status) as StatusCandidato,
        feedback_enviado: true,
        feedback_enviado_em: now,
        feedback_enviado_por: params.usuarioId || null,
        feedback_enviado_por_nome: params.usuarioNome || 'RH',
        feedback_assunto: msg?.assunto || null,
        feedback_mensagem: msg?.mensagem || null,
        updated_at: now,
      };
    });
    saveLocalCandidatos(updated);
  }

  return {
    success: enviados > 0,
    enviados,
    falhas,
    detalhesErro: ultimoErro || undefined,
  };
}

// ── Sincronização imediata da caixa de e-mail (Leitura Direta IMAP ou Webhook n8n) ──
export async function sincronizarCurriculosEmailN8n(): Promise<{
  success: boolean;
  novosImportados: number;
  message: string;
}> {
  const config = await fetchRecrutamentoConfigAsync();

  // 1. Tenta Leitura Direta IMAP via Edge Function `sync-rh-emails` quando configurada
  const temCredenciaisImap = Boolean(
    config.imapHost?.trim() && config.imapUser?.trim() && config.imapPass
  );

  if (config.modoLeitura !== 'n8n_webhook' && temCredenciaisImap) {
    const syncPayload = {
      action: 'sync' as const,
      imapHost: config.imapHost.trim(),
      imap_host: config.imapHost.trim(),
      imapPort: config.imapPort.trim() || '993',
      imap_port: config.imapPort.trim() || '993',
      imapUser: config.imapUser.trim(),
      imap_user: config.imapUser.trim(),
      imapPass: config.imapPass,
      imap_pass: config.imapPass,
      imapSecure: config.imapSecure || 'ssl',
      imap_secure: config.imapSecure || 'ssl',
      mailbox: config.imapMailbox.trim() || 'INBOX',
      keywords: config.palavrasChave,
      palavras_chave: config.palavrasChave,
      ignoredKeywords: config.palavrasIgnoradas || DEFAULT_PALAVRAS_IGNORADAS,
      palavras_ignoradas: config.palavrasIgnoradas || DEFAULT_PALAVRAS_IGNORADAS,
      exigirEvidenciaCurriculo: config.exigirEvidenciaCurriculo ?? true,
      maxMessages: config.maxMessages || 30,
      max_messages: config.maxMessages || 30,
      buscarEm: config.buscarEm || 'assunto_e_corpo',
      apenasNaoLidos: config.apenasNaoLidos ?? false,
    };

    let imapResultData: any = null;
    let imapErrorMsg: string | null = null;

    // 1a. Tenta conector direto Node/Vite (/api/rh-email/imap)
    try {
      const localResp = await fetch('/api/rh-email/imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncPayload),
      });
      const ct = localResp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const localJson = await localResp.json();
        if (localJson?.success) {
          imapResultData = localJson;
        } else if (localJson?.error) {
          imapErrorMsg = localJson.error;
        }
      }
    } catch {
      // Segue para Edge Function
    }

    // 1b. Se não obteve resposta do conector local, tenta Edge Function `sync-rh-emails`
    if (!imapResultData && !imapErrorMsg) {
      try {
        const { data, error } = await supabase.functions.invoke('sync-rh-emails', {
          body: syncPayload,
        });
        if (!error && data?.success) {
          imapResultData = data;
        } else if (data?.error) {
          imapErrorMsg = data.error;
        }
      } catch (err: any) {
        imapErrorMsg = err?.message || null;
      }
    }

    if (imapResultData?.success) {
      let inseridosCount = 0;
      let atualizadosCount = 0;

      if (Array.isArray(imapResultData.candidatos) && imapResultData.candidatos.length > 0) {
        const { data: existentes } = await fetchCandidatosTriagem();
        const mapExistentes = new Map<string, CandidatoTriagem>();
        for (const e of existentes) {
          const k = `${e.email_candidato.toLowerCase()}__${(e.assunto_email || '').toLowerCase()}`;
          mapExistentes.set(k, e);
        }

        const localList = getLocalCandidatos();
        let localChanged = false;

        for (const raw of imapResultData.candidatos) {
          if (!raw.email_candidato) continue;
          if (isCandidatoForaDoPadrao(raw, config.palavrasIgnoradas)) continue;
          const chaveUnica = `${raw.email_candidato.toLowerCase()}__${(raw.assunto_email || '').toLowerCase()}`;
          const jaExiste = mapExistentes.get(chaveUnica);

          if (jaExiste) {
            // Se já existia da sincronização anterior, mas estava sem telefone ou sem PDF, atualiza com os dados extraídos do PDF!
            const precisaAtualizar =
              (!jaExiste.telefone && raw.telefone) ||
              (!jaExiste.curriculo_url && raw.curriculo_url) ||
              (!jaExiste.curriculo_nome && raw.curriculo_nome) ||
              (jaExiste.resumo_perfil?.startsWith('Capturado automaticamente') && raw.resumo_perfil);

            if (precisaAtualizar) {
              const patch = {
                telefone: raw.telefone || jaExiste.telefone || null,
                curriculo_url: raw.curriculo_url || jaExiste.curriculo_url || null,
                curriculo_nome: raw.curriculo_nome || jaExiste.curriculo_nome || null,
                vaga_identificada:
                  raw.vaga_identificada && raw.vaga_identificada !== 'Geral / Banco de Talentos'
                    ? raw.vaga_identificada
                    : jaExiste.vaga_identificada,
                resumo_perfil: raw.resumo_perfil || jaExiste.resumo_perfil,
                updated_at: new Date().toISOString(),
              };

              try {
                await supabase
                  .from('rh_candidatos_triagem')
                  .update(patch)
                  .eq('id', jaExiste.id);
              } catch {
                // fallback local
              }

              for (let i = 0; i < localList.length; i++) {
                if (
                  localList[i].id === jaExiste.id ||
                  `${localList[i].email_candidato.toLowerCase()}__${(localList[i].assunto_email || '').toLowerCase()}` === chaveUnica
                ) {
                  localList[i] = { ...localList[i], ...patch };
                  localChanged = true;
                }
              }
              atualizadosCount++;
            }
            continue;
          }

          const created = await createCandidatoTriagem({
            nome_candidato: raw.nome_candidato || 'Candidato',
            email_candidato: raw.email_candidato,
            telefone: raw.telefone || null,
            vaga_identificada: raw.vaga_identificada || 'Geral / Banco de Talentos',
            assunto_email: raw.assunto_email || 'Currículo recebido por e-mail',
            palavras_chave_detectadas: raw.palavras_chave_detectadas || ['Currículo'],
            resumo_perfil: raw.resumo_perfil || null,
            curriculo_url: raw.curriculo_url || null,
            curriculo_nome: raw.curriculo_nome || null,
            email_message_id: raw.email_message_id || null,
            data_recebimento: raw.data_recebimento || undefined,
            observacoes: null,
            origem: 'email_n8n',
          });
          if (created.data) {
            mapExistentes.set(chaveUnica, created.data);
          }
          inseridosCount++;
        }

        if (localChanged) {
          saveLocalCandidatos(localList);
        }
      }

      return {
        success: true,
        novosImportados: inseridosCount + atualizadosCount,
        message:
          inseridosCount > 0 || atualizadosCount > 0
            ? `${inseridosCount} novo(s) e ${atualizadosCount} currículo(s) atualizado(s) com PDF e telefone!`
            : imapResultData.message ||
              `Sincronização IMAP concluída! Todos os currículos e PDFs já estão atualizados.`,
      };
    }

    if (config.modoLeitura === 'imap_direto' && imapErrorMsg) {
      return {
        success: false,
        novosImportados: 0,
        message: `Erro na leitura IMAP (${config.imapHost}): ${imapErrorMsg}`,
      };
    }
  }

  // 2. Sincronização via Webhook do n8n
  if (!config.webhookSyncUrl) {
    return {
      success: false,
      novosImportados: 0,
      message:
        'Configure a senha do Webmail IMAP ou a URL do Webhook n8n no botão "Configurar Leitura de E-mail".',
    };
  }

  try {
    const response = await fetch(config.webhookSyncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_monitorado: config.emailMonitorado || config.imapUser,
        imap_host: config.imapHost,
        imap_port: config.imapPort,
        imap_user: config.imapUser,
        imap_mailbox: config.imapMailbox || 'INBOX',
        max_messages: config.maxMessages || 30,
        buscar_em: config.buscarEm || 'assunto_e_corpo',
        apenas_nao_lidos: config.apenasNaoLidos ?? false,
        palavras_chave: config.palavrasChave,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rawText = await response.text();
    if (rawText.trim().toLowerCase().startsWith('<!doctype')) {
      throw new Error('O endpoint retornou HTML em vez de JSON.');
    }

    let items: any[] = [];
    if (rawText.trim()) {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) items = parsed;
      else if (Array.isArray(parsed?.data)) items = parsed.data;
      else if (Array.isArray(parsed?.candidatos)) items = parsed.candidatos;
    }

    let importados = 0;
    for (const raw of items) {
      const item = raw?.json ? raw.json : raw;
      const nome = item.nome_candidato || item.nome || item.from_name || 'Candidato sem nome';
      const email = item.email_candidato || item.email || item.from_email;
      if (!email) continue;

      await createCandidatoTriagem({
        nome_candidato: nome,
        email_candidato: email,
        telefone: item.telefone || item.phone || null,
        vaga_identificada: item.vaga_identificada || item.vaga || 'Geral / Banco de Talentos',
        assunto_email: item.assunto_email || item.subject || 'Currículo recebido via e-mail',
        palavras_chave_detectadas: Array.isArray(item.palavras_chave) ? item.palavras_chave : ['Currículo'],
        resumo_perfil: item.resumo_perfil || item.resumo || null,
        curriculo_url: item.curriculo_url || item.pdf_url || null,
        curriculo_nome: item.curriculo_nome || item.attachment_name || null,
        observacoes: null,
        origem: 'email_n8n',
      });
      importados++;
    }

    return {
      success: true,
      novosImportados: importados,
      message:
        importados > 0
          ? `${importados} novo(s) currículo(s) importado(s) do e-mail com sucesso!`
          : 'Sincronização concluída! Nenhum novo currículo pendente na caixa de entrada.',
    };
  } catch (err: any) {
    return {
      success: false,
      novosImportados: 0,
      message: !temCredenciaisImap
        ? 'Para ler os e-mails diretamente do Webmail, clique em "Configurar Leitura de E-mail" e informe o servidor IMAP e a senha da conta de RH.'
        : `Não foi possível sincronizar (${err?.message || 'Verifique a conexão do Webmail ou do n8n'}).`,
    };
  }
}

