import InboxPage from '@/components/inbox/InboxPage';

// Messagerie WhatsApp : conversations privées reçues sur le numéro WHAPI,
// réponses depuis l'interface, attribution à un collaborateur, phrases rapides,
// médiathèque et paniers clients. Accès : admin + rôles INBOX_ROLES.
export const dynamic = 'force-dynamic';

export default function InboxRoute() {
  return <InboxPage />;
}
