// src/services/bubbleService.ts
// Serviço de integração com a API do Bubble (HSC Holerites)
// Responsável por buscar o e-mail do colaborador usando CPF como chave

// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO — lida do .env
// Troque VITE_BUBBLE_ENV=version-live para apontar produção
// ─────────────────────────────────────────────────────────────

const BUBBLE_ENV     = import.meta.env.VITE_BUBBLE_ENV ?? 'version-test';
const BASE_TEST      = import.meta.env.VITE_BUBBLE_API_BASE_TEST as string;
const BASE_LIVE      = import.meta.env.VITE_BUBBLE_API_BASE_LIVE as string;
const BUBBLE_API_URL = BUBBLE_ENV === 'version-live' ? BASE_LIVE : BASE_TEST;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface BubbleHolerite {
  _id: string;
  CPF: string;
  nomeColaborador: string;
  emailColaborador?: string;
  whatsApp?: string;
  mesAno?: string;
  'Modified Date': string;
}

interface BubbleResponse {
  response: {
    cursor: number;
    results: BubbleHolerite[];
    count: number;
    remaining: number;
  };
}

// ─────────────────────────────────────────────────────────────
// CACHE em memória — válido apenas por sessão de importação
// Formato: { cpf_limpo: email | null }
// ─────────────────────────────────────────────────────────────

const emailCache = new Map<string, string | null>();

/**
 * Limpa o cache entre sessões de importação.
 * Chame esta função no início de cada processo de upload.
 */
export function clearBubbleEmailCache(): void {
  emailCache.clear();
  console.log('[Bubble] Cache de e-mails limpo.');
}

// ─────────────────────────────────────────────────────────────
// FETCH — busca e-mail do colaborador por CPF na API do Bubble
// ─────────────────────────────────────────────────────────────

/**
 * Busca o e-mail de um colaborador na API do Bubble usando o CPF como chave.
 * - Retorna o e-mail do registro mais recente que possua `emailColaborador`.
 * - Retorna `null` se não encontrar ou em caso de falha de rede (silenciosa).
 * - Utiliza cache em memória para evitar chamadas duplicadas na mesma importação.
 *
 * @param cpf CPF formatado (ex: "092.757.096-37")
 */
export async function fetchEmailFromBubble(cpf: string): Promise<string | null> {
  // Normaliza o CPF para usar como chave de cache
  const cpfClean = cpf.replace(/\D/g, '');

  // Verifica cache antes de fazer nova requisição
  if (emailCache.has(cpfClean)) {
    const cached = emailCache.get(cpfClean) ?? null;
    console.log(`[Bubble] Cache hit para CPF ${cpf}: ${cached ?? '(sem e-mail)'}`);
    return cached;
  }

  try {
    // Monta a URL com constraint de filtro por CPF
    // A API do Bubble aceita filtros via query param "constraints" (JSON encoded)
    const constraints = JSON.stringify([
      { key: 'CPF', constraint_type: 'equals', value: cpf },
    ]);

    const url =
      `${BUBBLE_API_URL}/obj/HSC_Holerites` +
      `?constraints=${encodeURIComponent(constraints)}` +
      `&sort_field=Modified%20Date&descending=true&limit=50`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(`[Bubble] Resposta HTTP ${response.status} para CPF ${cpf}. Ignorando.`);
      emailCache.set(cpfClean, null);
      return null;
    }

    const data: BubbleResponse = await response.json();
    const results = data?.response?.results ?? [];

    // Percorre da mais recente para a mais antiga em busca do e-mail
    // (a API já retorna por Modified Date desc, mas garantimos aqui)
    const sortedByDate = results.sort(
      (a, b) =>
        new Date(b['Modified Date']).getTime() -
        new Date(a['Modified Date']).getTime()
    );

    let email: string | null = null;
    for (const record of sortedByDate) {
      if (record.emailColaborador && record.emailColaborador.trim() !== '') {
        email = record.emailColaborador.trim().toLowerCase();
        break;
      }
    }

    console.log(`[Bubble] CPF ${cpf}: e-mail encontrado → ${email ?? '(nenhum)'}`);
    emailCache.set(cpfClean, email);
    return email;

  } catch (err) {
    // Falha silenciosa — não interrompe o processo de importação
    console.warn(`[Bubble] Erro ao buscar e-mail para CPF ${cpf}:`, err);
    emailCache.set(cpfClean, null);
    return null;
  }
}
