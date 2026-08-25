// Playbook WhatsApp — modèles de messages et constantes partagés client/serveur.
// (Aucun import serveur ici : le module est utilisé par la page /admin/playbook
// pour les aperçus ET par les routes API pour l'envoi.)

// Sous-groupes structurels de la communauté Oh My Group (architecture du playbook).
// 'annonces' est créé automatiquement par WhatsApp avec la communauté ;
// les autres se créent/lient depuis l'onglet WhatsApp → Communauté.
export type CommunitySlotKey = 'annonces' | 'offers' | 'b2b' | 'salon';

export const COMMUNITY_SLOTS: {
  key: CommunitySlotKey;
  emoji: string;
  name: string;
  desc: string;
  auto?: boolean; // créé par WhatsApp (non créable via l'app)
}[] = [
  { key: 'annonces', emoji: '📣', name: 'Annonces', desc: 'Touche TOUS les membres — temps forts uniquement (2-3/semaine max)', auto: true },
  { key: 'offers', emoji: '🛍️', name: 'Les Offres Oh My', desc: 'Listings B2C : chaque publication + récap du vendredi' },
  { key: 'b2b', emoji: '🧰', name: 'Packs Clé en Main Oh My', desc: 'Listings B2B diffusés avec bouton vers le listing — packs pros (pizzeria, resto…) et particuliers (chambre enfant…)' },
  { key: 'salon', emoji: '💬', name: 'Le Salon Oh My', desc: 'Discussion libre, demandes produits, sondages' },
];

export type DepartureKind = 'air' | 'sea';
export type DepartureStatus = 'open' | 'cutoff' | 'loaded' | 'transit' | 'arrived' | 'closed';

export const DEPARTURE_KIND_META: Record<DepartureKind, { emoji: string; label: string }> = {
  air: { emoji: '✈️', label: 'Aérien' },
  sea: { emoji: '🚢', label: 'Maritime' },
};

export const DEPARTURE_STATUS_META: Record<DepartureStatus, { label: string; cls: string }> = {
  open: { label: 'Ouvert', cls: 'bg-emerald-100 text-emerald-700' },
  cutoff: { label: 'Cut-off passé', cls: 'bg-amber-100 text-amber-700' },
  loaded: { label: 'Chargé', cls: 'bg-blue-100 text-blue-700' },
  transit: { label: 'En transit', cls: 'bg-sky-100 text-sky-700' },
  arrived: { label: 'Arrivé', cls: 'bg-violet-100 text-violet-700' },
  closed: { label: 'Clôturé', cls: 'bg-slate-100 text-slate-500' },
};

// Jalons envoyables dans le groupe : statut cible → message.
export const MILESTONES: { key: DepartureStatus; label: string; emoji: string }[] = [
  { key: 'cutoff', label: 'Rappel cut-off', emoji: '⏳' },
  { key: 'loaded', label: 'Chargement', emoji: '📦' },
  { key: 'transit', label: 'Point transit', emoji: '🛫' },
  { key: 'arrived', label: 'Arrivée / retrait', emoji: '🏢' },
  { key: 'closed', label: 'Clôture', emoji: '✅' },
];

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '[date]';

/** Message d'ouverture d'un groupe départ. */
export function buildOpeningMessage(args: {
  kind: DepartureKind;
  label: string;
  cutoff_date?: string | null;
  departure_date?: string | null;
}): string {
  const k = DEPARTURE_KIND_META[args.kind];
  return (
    `${k.emoji} *${args.label.toUpperCase()}*\n` +
    `Bienvenue ! Ce groupe suit *uniquement* cette expédition.\n` +
    `🗓️ Cut-off paiement : ${fmtDate(args.cutoff_date)}\n` +
    `${k.emoji} Départ : ${fmtDate(args.departure_date)}\n` +
    `Vous recevrez ici : chargement 📸, transit ${args.kind === 'air' ? '🛫' : '🚢'}, arrivée 🏢, retrait ✅\n` +
    `Questions personnelles → message privé 🙏`
  );
}

/** Message de jalon logistique. */
export function buildMilestoneMessage(
  milestone: DepartureStatus,
  args: { kind: DepartureKind; label: string; cutoff_date?: string | null; note?: string },
): string {
  const note = args.note?.trim();
  switch (milestone) {
    case 'cutoff':
      return (
        `⏳ *DERNIER RAPPEL — ${args.label}*\n` +
        `Le cut-off paiement est le ${fmtDate(args.cutoff_date)}.\n` +
        `Passé cette date, vos colis partent sur le départ suivant.\n` +
        (note ? `${note}\n` : '') +
        `Besoin d'aide ? Message privé 🙏`
      );
    case 'loaded':
      return (
        `📦 *CHARGEMENT EFFECTUÉ — ${args.label}*\n` +
        `Vos colis sont chargés et scellés ✅\n` +
        (note ? `${note}\n` : '') +
        `Prochaine étape : le départ. On vous tient informés ici.`
      );
    case 'transit':
      return (
        `${args.kind === 'air' ? '🛫' : '🚢'} *EN TRANSIT — ${args.label}*\n` +
        (note ? `${note}\n` : `L'expédition suit son cours normalement.\n`) +
        `Prochaine info : l'arrivée 🏢`
      );
    case 'arrived':
      return (
        `🎉 *VOTRE COLIS EST ARRIVÉ !*\n` +
        (note ? `${note}\n` : `📍 Retrait à l'agence — infos horaires à suivre.\n`) +
        `🪪 Munissez-vous de votre nom de commande + pièce d'identité\n` +
        `On vous attend ! 🙌`
      );
    case 'closed':
      return (
        `✅ *Expédition livrée — merci à tous !*\n` +
        `Ce groupe ferme dans quelques jours.\n` +
        (note ? `${note}\n` : '') +
        `⭐ Un mot sur votre expérience nous aide énormément\n` +
        `À la prochaine commande ! 💚`
      );
    default:
      return note || '';
  }
}

/** Récap catalogue (repost du vendredi) à partir des listings sélectionnés. */
export function buildRecapMessage(items: { title: string; url: string }[]): string {
  const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const lines = items
    .slice(0, 10)
    .map((it, i) => `${nums[i] || '▪️'} ${it.title} → ${it.url}`)
    .join('\n');
  return (
    `📚 *LE CATALOGUE OH MY — liens actifs*\n` +
    `Pour les nouveaux 👋 (et les distraits 😄), tout ce qui est ouvert à la commande :\n` +
    `${lines}\n` +
    `📌 Ce message est épinglé — remontez ici à tout moment.`
  );
}

// Rituels récurrents de la semaine (jour ISO : 1 = lundi … 7 = dimanche).
export const RITUALS: { key: string; day: number | 'monthly'; label: string; hint: string }[] = [
  { key: 'listing_monday', day: 1, label: 'Listing de la semaine', hint: 'Diffuser le listing le plus fort à 12h30 (onglet WhatsApp)' },
  { key: 'b2b_tuesday', day: 2, label: 'Offre B2B', hint: 'Poster dans l’Espace Pro à 10h' },
  { key: 'listing_wednesday', day: 3, label: '2ᵉ listing / vidéo', hint: 'Variante ou vidéo du listing à 19h30' },
  { key: 'poll_thursday', day: 4, label: 'Sondage du Salon', hint: '« Quel produit cherchez-vous ? » à 19h (onglet WhatsApp)' },
  { key: 'recap_friday', day: 5, label: 'Récap catalogue', hint: 'Générer le récap ci-dessous et mettre à jour l’épingle 📌 2' },
  { key: 'welcome_sunday', day: 7, label: 'Bienvenue aux nouveaux', hint: 'Si des membres ont rejoint cette semaine' },
  { key: 'pins_renewal', day: 'monthly', label: 'Renouveler les 3 épingles', hint: 'Les épingles expirent après 30 jours (le 1ᵉʳ du mois)' },
];
