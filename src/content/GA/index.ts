// Textes du Gabon (Oh My Gab) : textes d'origine, inchangés.
import type { CountryContent } from '../types';

const content: CountryContent = {
  site: {
    title: 'Twinsk Company — Logistique & Sourcing depuis la Chine',
    description: 'Fret aérien et maritime, sourcing 1688/Alibaba, échantillonnage, import véhicules et réception délégations. Hong Kong → Monde.',
  },
  bio: {
    title: 'Oh My Gab !',
    tagline: 'La Chine livrée à Libreville 🇨🇳 ➡️ 🇬🇦 — maison, business, prix en FCFA.',
    steps: [
      { emoji: '🛍️', title: 'Choisissez un listing', text: 'Confort pour la maison, Pro pour ouvrir ou équiper votre activité. Prix affichés en FCFA, zéro négociation.' },
      { emoji: '🛒', title: 'Ajoutez au panier', text: 'Sélectionnez vos produits et variantes directement dans le listing, puis validez votre panier.' },
      { emoji: '✈️', title: 'Choisissez le transport', text: 'Aérien en 8 à 14 jours ou maritime en 60 à 85 jours, estimation calculée automatiquement.' },
      { emoji: '📱', title: 'Payez simplement', text: 'Airtel Money ou cash à l’agence. Un code promo ? Il s’applique sur vos articles.' },
      { emoji: '💬', title: 'Suivi sur WhatsApp', text: 'Confirmation, suivi de commande et livraison à domicile à Libreville, tout se passe sur WhatsApp.' },
    ],
    heroText: 'Choisissez un catalogue, ajoutez au panier, payez en FCFA par Airtel Money ou cash. On s’occupe du reste — suivi WhatsApp jusqu’à votre porte.',
    footerPayment: 'Airtel Money ou cash',
  },
  quickReplies: (origin) => [
    { id: 'hello', label: 'Bonjour', text: 'Bonjour {nom} 👋 Merci de contacter Oh My Gab ! Comment pouvons-nous vous aider ?' },
    { id: 'delais', label: 'Délais', text: 'Nos délais de livraison à Libreville : 8 à 14 jours par avion, 60 à 85 jours par bateau. Le transport est calculé automatiquement dans votre panier.' },
    { id: 'paiement', label: 'Paiement', text: 'Vous pouvez régler par Airtel Money ou en espèces à notre agence. Les prix affichés sont en FCFA, sans négociation.' },
    { id: 'catalogues', label: 'Catalogues', text: `Retrouvez tous nos catalogues ici : ${origin}/bio — choisissez, ajoutez au panier, et on s’occupe du reste.` },
  ],
  salon: {
    groupId: '120363431660727284@g.us',
    description:
      'Vous cherchez un produit précis ? Postez ici une photo ou une description (quantité, usage, budget).\n\n' +
      'Oh My Gab vous répond dans le groupe avec le prix depuis la Chine et les fiches produits à commander. ' +
      'Chaque demande reçoit une référence R-XXXX : rappelez-la dans vos échanges.\n\n' +
      'Prix en FCFA · Airtel Money ou cash · Livraison à Libreville 🇨🇳 ➡️ 🇬🇦',
  },
  payment: {
    cartShort: 'Airtel Money ou espèces',
    cartStep: '3️⃣ Payez par Airtel Money, eBilling ou en espèces à l\'agence',
    cashReminderFaster: (n) => `💡 Plus rapide : payez par *Airtel Money*` + (n ? ` au *${n}*` : ''),
  },
  phoneHint: '+241 / +242…',
  sampleClientPhone: '24106871309',
};

export default content;
