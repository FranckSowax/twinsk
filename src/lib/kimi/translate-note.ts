// Helper to translate a single note (FR source) into English and Simplified
// Chinese in a single Kimi call. Used by /api/order-summary notes feature.

const KIMI_BASE_URL = 'https://api.moonshot.ai/v1/chat/completions';
const KIMI_MODEL = 'moonshot-v1-8k';

export interface NoteTranslations {
  en: string;
  zh: string;
}

const SYSTEM_PROMPT = `Tu es un traducteur professionnel. On te donne une note interne (langue source: français) écrite par un collaborateur logistique pour suivre une commande de sourcing en Chine.

Retourne UNIQUEMENT un JSON valide, sans aucun texte avant ou après.
Format exact attendu : {"en": "...", "zh": "..."}

- "en" = traduction anglaise naturelle.
- "zh" = traduction en chinois simplifié (简体中文), adaptée pour communiquer avec un fournisseur 1688/Taobao.
- Préserve les nombres, références produits, et noms propres.
- Ne traduis pas les noms de marques ni les URLs.
- Garde un ton professionnel et concis.`;

export async function translateNote(message: string): Promise<NoteTranslations> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    throw new Error('KIMI_API_KEY non configuré');
  }
  const response = await fetch(KIMI_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kimi API ${response.status}: ${text}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Reponse Kimi invalide');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('JSON invalide de Kimi');
  }
  const p = parsed as { en?: unknown; zh?: unknown };
  if (typeof p.en !== 'string' || typeof p.zh !== 'string') {
    throw new Error('Champs en/zh manquants dans la reponse Kimi');
  }
  return { en: p.en, zh: p.zh };
}
