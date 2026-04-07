// Kimi (Moonshot) API client for Chinese -> French translation

const KIMI_BASE_URL = 'https://api.moonshot.cn/v1/chat/completions';
const KIMI_MODEL = 'kimi-k2-0711-preview';
const KIMI_FALLBACK_MODEL = 'moonshot-v1-8k';

export interface TranslationItem {
  id: string;
  title?: string;
  description?: string;
  seller?: string;
}

export interface TranslatedFields {
  title?: string;
  description?: string;
  seller?: string;
}

export type TranslationMap = Record<string, TranslatedFields>;

const SYSTEM_PROMPT = `Tu es un traducteur chinois→français spécialisé dans l'e-commerce et les fiches produits.
Règles strictes :
- Retourne UNIQUEMENT un JSON valide, sans aucun texte avant ou après.
- Format exact attendu : {"id1": {"title": "...", "description": "...", "seller": "..."}, "id2": {...}}
- Ne traduis pas les noms de marques ni les numéros de modèle.
- Pour le seller, traduis seulement si c'est un nom commun chinois ; garde tel quel si c'est un nom propre.
- Si un champ est absent dans l'entrée, omets-le dans la sortie.
- Reste concis et fidèle au sens.`;

async function callKimi(
  model: string,
  payload: object,
  signal?: AbortSignal
): Promise<Response> {
  return fetch(KIMI_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.KIMI_API_KEY}`,
    },
    body: JSON.stringify({ model, ...payload }),
    signal,
  });
}

export async function translateBatch(items: TranslationItem[]): Promise<TranslationMap> {
  if (!items.length) return {};
  if (!process.env.KIMI_API_KEY) {
    console.warn('KIMI_API_KEY not set, skipping translation');
    return {};
  }

  const userPayload = items.reduce<Record<string, Omit<TranslationItem, 'id'>>>((acc, item) => {
    const fields: Omit<TranslationItem, 'id'> = {};
    if (item.title) fields.title = item.title;
    if (item.description) fields.description = item.description;
    if (item.seller) fields.seller = item.seller;
    if (Object.keys(fields).length > 0) acc[item.id] = fields;
    return acc;
  }, {});

  if (Object.keys(userPayload).length === 0) return {};

  const payload = {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Traduis en français les champs suivants. Entrée :\n${JSON.stringify(userPayload)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    let res = await callKimi(KIMI_MODEL, payload, controller.signal);
    if (!res.ok) {
      console.warn(`Kimi primary model failed (${res.status}), trying fallback`);
      res = await callKimi(KIMI_FALLBACK_MODEL, payload, controller.signal);
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Kimi translation failed: ${res.status} ${errText}`);
      return {};
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return {};

    const parsed = JSON.parse(content) as TranslationMap;
    return parsed;
  } catch (err) {
    console.error('Kimi translation error:', err);
    return {};
  } finally {
    clearTimeout(timeout);
  }
}
