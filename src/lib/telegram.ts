const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '@twinskdaily';

export async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn('[Telegram] BOT_TOKEN missing — notification skipped');
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Telegram] sendMessage failed: ${res.status} ${err}`);
      return false;
    }

    console.log('[Telegram] Message sent successfully');
    return true;
  } catch (err) {
    console.error('[Telegram] Error:', err);
    return false;
  }
}

/** Notify admin channel of a new client submission */
export async function notifyNewSubmission({
  clientName,
  clientEmail,
  itemCount,
  requestId,
  baseUrl,
}: {
  clientName: string;
  clientEmail: string;
  itemCount: number;
  requestId: string;
  baseUrl: string;
}) {
  const adminLink = `${baseUrl}/admin/requests/${requestId}`;

  const message = [
    `📦 <b>Nouvelle demande de sourcing</b>`,
    ``,
    `👤 Client : <b>${clientName || 'Sans nom'}</b>`,
    clientEmail ? `📧 Email : ${clientEmail}` : null,
    `📎 Articles : ${itemCount}`,
    ``,
    `👉 <a href="${adminLink}">Voir et lancer la recherche</a>`,
  ]
    .filter(Boolean)
    .join('\n');

  return sendTelegramMessage(message);
}

/** Notify admin channel when a client validates their proposal choices */
export async function notifyProposalValidated({
  clientName,
  selectedCount,
  requestId,
  baseUrl,
}: {
  clientName: string;
  selectedCount: number;
  requestId: string;
  baseUrl: string;
}) {
  const adminLink = `${baseUrl}/admin/requests/${requestId}`;

  const message = [
    `✅ <b>Proposition validée par le client</b>`,
    ``,
    `👤 Client : <b>${clientName || 'Sans nom'}</b>`,
    `📦 ${selectedCount} produit(s) choisi(s)`,
    ``,
    `👉 <a href="${adminLink}">Voir les choix et générer le devis</a>`,
  ].join('\n');

  return sendTelegramMessage(message);
}

/** Notify admin channel when a client adds more products to an existing request */
export async function notifyItemsAdded({
  clientName,
  itemCount,
  requestId,
  baseUrl,
}: {
  clientName: string;
  itemCount: number;
  requestId: string;
  baseUrl: string;
}) {
  const adminLink = `${baseUrl}/admin/requests/${requestId}`;

  const message = [
    `➕ <b>Articles ajoutés à une demande</b>`,
    ``,
    `👤 Client : <b>${clientName || 'Sans nom'}</b>`,
    `📎 ${itemCount} nouvel(aux) article(s)`,
    ``,
    `👉 <a href="${adminLink}">Voir la demande</a>`,
  ].join('\n');

  return sendTelegramMessage(message);
}
