'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { useState } from 'react';

interface QA {
  q: string;
  a: string;
}

const QUESTIONS: QA[] = [
  {
    q: 'Quels sont les délais entre la commande et la livraison ?',
    a: "Pour le fret maritime : 28 à 38 jours porte-à-porte selon la destination. Pour le fret aérien : 5 à 10 jours. Notre engagement contractuel est de 98% de livraisons à l'heure.",
  },
  {
    q: 'Comment se passe le paiement ?',
    a: 'Acompte de 50% à la validation du devis, solde à la livraison. Plusieurs méthodes acceptées : virement bancaire, Wise, Mobile Money, Stripe (carte). Nos agents francophones vous accompagnent à chaque étape.',
  },
  {
    q: "Qui gère le dédouanement à l'arrivée ?",
    a: 'Twinsk prend en charge tout le processus : déclarations, taxes, formalités. Vous recevez la facture définitive incluse dans votre devis initial — pas de surprise.',
  },
  {
    q: "Puis-je inspecter les produits avant l'expédition ?",
    a: 'Oui. Notre service échantillonnage permet de recevoir un échantillon avant la commande complète. Pour les grosses commandes, nous réalisons systématiquement des photos et vidéos de validation avant départ.',
  },
  {
    q: 'Quelles destinations couvrez-vous ?',
    a: "Tous les ports majeurs d'Afrique (Libreville, Lomé, Abidjan, Douala, Dakar, Lagos, Kinshasa…), d'Europe (Paris, Bruxelles) et d'Amérique (New York). Pour d'autres destinations, contactez-nous pour un devis sur mesure.",
  },
  {
    q: "Comment suivre l'avancement de ma commande ?",
    a: 'Notifications WhatsApp à chaque étape : confirmation usine, départ container, arrivée port, dédouanement, livraison finale. Tracking en temps réel via votre lien personnel Twinsk.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="relative px-5 sm:px-8 lg:px-10 py-20 lg:py-28 bg-white border-t border-slate-200">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12 lg:mb-16"
        >
          <div className="inline-flex items-center gap-3 mb-5">
            <span className="h-px w-10 bg-lime" />
            <span className="kicker text-slate-700">
              <span className="tabular-nums opacity-60">06</span>
              <span className="mx-2 opacity-30">/</span>
              Questions fréquentes
            </span>
            <span className="h-px w-10 bg-lime" />
          </div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl uppercase tracking-tight text-slate-900 leading-[0.95]">
            On répond à <br />
            vos <span className="text-lime">questions</span>
          </h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.06, delayChildren: 0.1 },
            },
          }}
          className="space-y-3"
        >
          {QUESTIONS.map((qa, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0 },
                }}
                className={`rounded-2xl border transition-colors ${
                  isOpen
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="font-semibold text-slate-900 text-base sm:text-lg">
                    {qa.q}
                  </span>
                  <span
                    className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 transition-colors ${
                      isOpen
                        ? 'bg-lime text-slate-900'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isOpen ? (
                      <Minus className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: 0.3,
                        ease: [0.215, 0.61, 0.355, 1],
                      }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 -mt-1 text-sm sm:text-base text-slate-600 leading-relaxed">
                        {qa.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-12 text-center text-sm text-slate-500"
        >
          Une autre question ?{' '}
          <a
            href="#delegations"
            className="font-semibold text-slate-900 underline-offset-4 hover:underline"
          >
            Contactez notre équipe →
          </a>
        </motion.div>
      </div>
    </section>
  );
}
