// Textes de la Côte d'Ivoire (Oh My Cot).
// TODO(franck) : moyens de paiement définitifs (phase 4 : agrégateur), à relire.
import type { CountryContent } from '../types';

const content: CountryContent = {
  site: {
    title: 'Oh My Cot — La Chine livrée à Abidjan',
    description: 'Catalogues maison et business importés de Chine, prix en FCFA, commande et suivi sur WhatsApp. Livraison à Abidjan.',
  },
  bio: {
    title: 'Oh My Cot !',
    tagline: 'La Chine livrée à Abidjan 🇨🇳 ➡️ 🇨🇮 — maison, business, prix en FCFA.',
    steps: [
      { emoji: '🛍️', title: 'Choisissez un listing', text: 'Confort pour la maison, Pro pour ouvrir ou équiper votre activité. Prix affichés en FCFA, zéro négociation.' },
      { emoji: '🛒', title: 'Ajoutez au panier', text: 'Sélectionnez vos produits et variantes directement dans le listing, puis validez votre panier.' },
      { emoji: '✈️', title: 'Choisissez le transport', text: 'Aérien ou maritime, estimation calculée automatiquement.' },
      { emoji: '📱', title: 'Payez simplement', text: 'Orange Money, MTN MoMo, Wave, Moov Money ou espèces à l’agence. Un code promo ? Il s’applique sur vos articles.' },
      { emoji: '💬', title: 'Suivi sur WhatsApp', text: 'Confirmation, suivi de commande et livraison à Abidjan, tout se passe sur WhatsApp.' },
    ],
    heroText: 'Choisissez un catalogue, ajoutez au panier, payez en FCFA par mobile money ou en espèces. On s’occupe du reste — suivi WhatsApp jusqu’à votre porte.',
    footerPayment: 'Mobile money ou espèces',
  },
  quickReplies: (origin) => [
    { id: 'hello', label: 'Bonjour', text: 'Bonjour {nom} 👋 Merci de contacter Oh My Cot ! Comment pouvons-nous vous aider ?' },
    { id: 'delais', label: 'Délais', text: 'Nos délais de livraison à Abidjan dépendent du transport choisi (avion ou bateau) ; ils sont indiqués dans votre panier.' },
    { id: 'paiement', label: 'Paiement', text: 'Vous pouvez régler par Orange Money, MTN MoMo, Wave, Moov Money ou en espèces à notre agence. Les prix affichés sont en FCFA, sans négociation.' },
    { id: 'catalogues', label: 'Catalogues', text: `Retrouvez tous nos catalogues ici : ${origin}/bio — choisissez, ajoutez au panier, et on s’occupe du reste.` },
  ],
  salon: {
    description:
      'Vous cherchez un produit précis ? Postez ici une photo ou une description (quantité, usage, budget).\n\n' +
      'Oh My Cot vous répond dans le groupe avec le prix depuis la Chine et les fiches produits à commander. ' +
      'Chaque demande reçoit une référence R-XXXX : rappelez-la dans vos échanges.\n\n' +
      'Prix en FCFA · Mobile money ou espèces · Livraison à Abidjan 🇨🇳 ➡️ 🇨🇮',
  },
  payment: {
    cartShort: 'mobile money ou espèces',
    cartStep: '3️⃣ Payez par mobile money ou en espèces à l\'agence',
    cashReminderFaster: () => '💡 Plus rapide : payez par *mobile money* depuis votre commande',
  },
  phoneHint: '+225…',
  sampleClientPhone: '2250707070707',
};

export default content;
