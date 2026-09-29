// Couche IA commune (29 sept. 2026) : un seul point d'appel aux modèles de
// langage pour les nouveaux usages (analyse des conversations). Fournisseur
// choisi par ANALYSIS_LLM_PROVIDER : 'openrouter' (défaut, OPENROUTER_API_KEY,
// modèle z-ai/glm-5.3-flash — choix de Franck du 29 sept. 2026, Gabon et Côte
// d'Ivoire), 'kimi' (KIMI_API_KEY) ou 'anthropic' (ANTHROPIC_API_KEY).
// Modèle : ANALYSIS_MODEL.
// Reprise automatique sur 429 / 5xx, délai maximal, tokens renvoyés pour le
// calcul du coût. La traduction historique (src/lib/kimi/) reste inchangée.

export type LlmProvider = 'openrouter' | 'kimi' | 'anthropic';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}
export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}
export interface LlmResult {
  ok: boolean;
  text: string;
  model: string;
  provider: LlmProvider;
  inputTokens: number;
  outputTokens: number;
  error?: string;
  /** Coût réel en USD quand le fournisseur le renvoie (OpenRouter). */
  costUsd?: number;
}

const DEFAULT_MODEL: Record<LlmProvider, string> = {
  openrouter: 'z-ai/glm-5.3-flash',
  kimi: 'moonshot-v1-32k',
  anthropic: 'claude-haiku-4-5-20251001',
};

export function llmProvider(): LlmProvider {
  const p = process.env.ANALYSIS_LLM_PROVIDER;
  return p === 'anthropic' || p === 'kimi' ? p : 'openrouter';
}
export function llmModel(provider: LlmProvider = llmProvider()): string {
  return process.env.ANALYSIS_MODEL || DEFAULT_MODEL[provider];
}
const KEY_VAR: Record<LlmProvider, string> = { openrouter: 'OPENROUTER_API_KEY', kimi: 'KIMI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' };
export function llmKeyVar(provider: LlmProvider = llmProvider()): string {
  return KEY_VAR[provider];
}
export function llmConfigured(provider: LlmProvider = llmProvider()): boolean {
  return !!process.env[KEY_VAR[provider]];
}

/**
 * Tarifs en USD par million de tokens (ANALYSIS_PRICE_IN_PER_M / _OUT_PER_M),
 * et conversion USD → FCFA (USD_TO_FCFA). Défauts INDICATIFS, à confirmer sur
 * la facture du fournisseur : GLM 5.3 Flash via OpenRouter 0,15 $ / 0,50 $ (grille
 * OpenRouter du 29 sept. 2026), Kimi 1 $ / 3 $, Claude Haiku 4.5 1 $ / 5 $, 600 FCFA.
 */
export function llmPrices(provider: LlmProvider = llmProvider()): { inPerM: number; outPerM: number; usdToFcfa: number } {
  // OpenRouter renvoie le coût réel de chaque appel : ces tarifs ne servent qu'en repli.
  const def = provider === 'anthropic' ? { inPerM: 1, outPerM: 5 } : provider === 'openrouter' ? { inPerM: 0.15, outPerM: 0.5 } : { inPerM: 1, outPerM: 3 };
  const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    inPerM: n(process.env.ANALYSIS_PRICE_IN_PER_M, def.inPerM),
    outPerM: n(process.env.ANALYSIS_PRICE_OUT_PER_M, def.outPerM),
    usdToFcfa: n(process.env.USD_TO_FCFA, 600),
  };
}

/** Coût d'un appel en FCFA : coût réel renvoyé par le fournisseur, sinon estimé sur les tokens. */
export function llmCostFcfa(r: Pick<LlmResult, 'provider' | 'inputTokens' | 'outputTokens' | 'costUsd'>): number {
  const p = llmPrices(r.provider);
  const usd = typeof r.costUsd === 'number' ? r.costUsd : (r.inputTokens * p.inPerM + r.outputTokens * p.outPerM) / 1_000_000;
  return Math.round(usd * p.usdToFcfa * 100) / 100;
}

/** Extrait un objet JSON d'une réponse (blocs ```json, texte autour) ; null si impossible. */
export function parseJsonLoose(text: string): unknown {
  const t = (text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Effort de raisonnement demandé aux modèles qui raisonnent : low (défaut), medium ou high. */
export function reasoningEffort(): 'low' | 'medium' | 'high' {
  const v = process.env.ANALYSIS_REASONING_EFFORT;
  return v === 'medium' || v === 'high' ? v : 'low';
}

async function callOnce(provider: LlmProvider, model: string, req: LlmRequest, signal: AbortSignal): Promise<Response> {
  if (provider === 'anthropic') {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: req.system,
        max_tokens: req.maxTokens ?? 1200,
        temperature: req.temperature ?? 0.2,
        messages: req.messages,
      }),
      signal,
    });
  }
  const openrouter = provider === 'openrouter';
  return fetch(openrouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${(openrouter ? process.env.OPENROUTER_API_KEY : process.env.KIMI_API_KEY) || ''}`,
      ...(openrouter ? { 'X-Title': 'Twinsk - analyse des conversations' } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens ?? 1200,
      ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      // OpenRouter : coût réel de l'appel renvoyé dans `usage.cost`. Les modèles
      // à raisonnement obligatoire (GLM 5.3 Flash) consomment la limite de sortie
      // en réfléchissant : effort faible (ANALYSIS_REASONING_EFFORT) et
      // raisonnement exclu de la réponse, sinon le JSON arrive vide.
      ...(openrouter ? { usage: { include: true }, reasoning: { effort: reasoningEffort(), exclude: true } } : {}),
    }),
    signal,
  });
}

/** Appel au modèle, avec jusqu'à 3 reprises sur 429 / 5xx (1 s, 2 s, 4 s). */
export async function chatCompletion(req: LlmRequest): Promise<LlmResult> {
  const provider = llmProvider();
  const model = llmModel(provider);
  const base = { model, provider, inputTokens: 0, outputTokens: 0 };
  if (!llmConfigured(provider)) return { ...base, ok: false, text: '', error: `Clé ${KEY_VAR[provider]} absente` };

  let lastError = '';
  for (let attempt = 0; attempt <= 3; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), req.timeoutMs ?? 45_000);
    try {
      const res = await callOnce(provider, model, req, ctrl.signal);
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        lastError = `${provider} ${res.status} : ${JSON.stringify(data.error ?? data).slice(0, 200)}`;
        // Solde épuisé / compte suspendu : inutile de réessayer.
        if (/insufficient|suspended|balance|credit/i.test(lastError)) return { ...base, ok: false, text: '', error: lastError };
        if (res.status === 429 || res.status >= 500) continue;
        return { ...base, ok: false, text: '', error: lastError };
      }
      if (provider === 'anthropic') {
        const content = (data.content as { type?: string; text?: string }[] | undefined) || [];
        const usage = (data.usage as { input_tokens?: number; output_tokens?: number } | undefined) || {};
        return { ...base, ok: true, text: content.filter((c) => c.type === 'text').map((c) => c.text || '').join(''), inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0 };
      }
      const choices = (data.choices as { message?: { content?: string }; finish_reason?: string }[] | undefined) || [];
      const usage = (data.usage as { prompt_tokens?: number; completion_tokens?: number; cost?: number } | undefined) || {};
      const content = choices[0]?.message?.content || '';
      const tokens = { inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0, ...(typeof usage.cost === 'number' ? { costUsd: usage.cost } : {}) };
      // Réponse vide (raisonnement qui a épuisé la limite) ou coupée : échec explicite, payé quand même.
      if (!content.trim() || choices[0]?.finish_reason === 'length') {
        return { ...base, ...tokens, ok: false, text: content, error: `${provider} : réponse ${content.trim() ? 'tronquée' : 'vide'} (limite de ${req.maxTokens ?? 1200} tokens atteinte)` };
      }
      return {
        ...base,
        ok: true,
        text: content,
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        ...(typeof usage.cost === 'number' ? { costUsd: usage.cost } : {}),
      };
    } catch (e) {
      lastError = e instanceof Error && e.name === 'AbortError' ? `${provider} : délai dépassé` : String(e).slice(0, 200);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ...base, ok: false, text: '', error: lastError || 'Échec de l’appel au modèle' };
}
