// Textes propres à chaque pays (src/content/<code>/). Le Gabon reprend mot
// pour mot les textes d'origine ; la Côte d'Ivoire les adapte.
import type { BioStep } from '@/lib/bio-page';
import type { QuickReply } from '@/lib/wa-inbox';

export interface CountryContent {
  /** Métadonnées du site (balise <title>, description). */
  site: { title: string; description: string };
  bio: {
    title: string;
    tagline: string;
    steps: BioStep[];
    /** Paragraphe d'accroche sous le titre. */
    heroText: string;
    /** Mention des moyens de paiement dans le pied de page. */
    footerPayment: string;
  };
  /** Phrases rapides par défaut de la messagerie (`origin` = domaine public). */
  quickReplies: (origin: string) => QuickReply[];
  /** Description du groupe WhatsApp « Oh My Recherche » (identifiant : COUNTRY.whatsappGroups.search). */
  salon: { description: string };
  payment: {
    /** Parenthèse des messages de panier : « (Airtel Money ou espèces) ». */
    cartShort: string;
    /** 3ᵉ étape du message « panier bien reçu ». */
    cartStep: string;
    /** Relance « payez plus vite » d'une commande réservée en espèces. */
    cashReminderFaster: (payNumber: string | null) => string;
    /** Moyen d'encaissement des partenaires (espace partenaire) : « Airtel Money ». */
    payoutLabel: string;
  };
  /** Indication d'indicatif dans le champ téléphone de la commande. */
  phoneHint: string;
  /** Numéro fictif de l'aperçu des phrases rapides. */
  sampleClientPhone: string;
}
