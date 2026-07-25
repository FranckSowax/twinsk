// Numéro de commande lisible dérivé de l'UUID (déterministe, sans colonne dédiée).
export function orderNumber(id: string): string {
  return 'CMD-' + id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

// Numéro WhatsApp → chat id WHAPI (<digits>@s.whatsapp.net).
export function toWhatsappChatId(phone: string | null | undefined): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 6 ? `${digits}@s.whatsapp.net` : null;
}
