'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  Loader2,
  ShieldCheck,
  Languages,
  Timer,
  Camera,
  FileText,
  Send,
} from 'lucide-react';
import { useState } from 'react';

const TRUST_MARKS = [
  { icon: Timer, label: 'Réponse', value: 'Sous 48 h' },
  { icon: ShieldCheck, label: 'Sourcing', value: 'Vérifié usine' },
  { icon: Languages, label: 'Agents', value: 'FR · EN · 中文' },
];

const STEPS = [
  { icon: Camera, label: 'Photos' },
  { icon: FileText, label: 'Description libre' },
  { icon: Send, label: 'Devis sous 48 h' },
];

const TwinskQuickQuote = () => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    try {
      // Track in admin leads dashboard (best-effort)
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quick_quote',
          fields: { Source: 'Hero CTA · LP' },
        }),
      }).catch(() => {});

      // Create an empty draft request — client will fill the rest
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error('create_failed');

      const data = (await res.json()) as { id: string };
      window.location.href = `/request/${data.id}`;
    } catch {
      setError('Une erreur est survenue. Réessayez ou contactez-nous directement.');
      setSubmitting(false);
    }
  };

  return (
    <section
      id="quick-quote"
      className="relative px-3 sm:px-5 lg:px-6 py-16 lg:py-24 border-t border-forest/5"
    >
      <div className="max-w-[1600px] mx-auto px-2 sm:px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.215, 0.61, 0.355, 1] }}
          className="relative overflow-hidden rounded-3xl bg-forest text-cream"
        >
          <div className="absolute inset-0 grid-bg opacity-[0.06] pointer-events-none" />
          <div className="absolute -top-40 -right-32 w-[520px] h-[520px] bg-lime/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 p-8 sm:p-12 lg:p-16">
            {/* Editorial intro — left */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="h-px w-10 bg-lime" />
                  <span className="kicker text-lime">
                    <span className="tabular-nums opacity-70">03</span>
                    <span className="mx-2 opacity-30">/</span>
                    Cotation rapide
                  </span>
                </div>

                <h2 className="mt-6 font-display text-[44px] sm:text-6xl lg:text-[80px] leading-[0.95] tracking-tight uppercase">
                  <span className="block">Un projet ?</span>
                  <span className="block text-lime">Devis sous 48 h.</span>
                </h2>
                <p className="mt-6 max-w-md text-[17px] text-cream/80 leading-relaxed font-light">
                  Sourcing, fret, dédouanement, livraison. Démarrez votre demande en un clic —
                  vous ajouterez ensuite photos ou descriptions des produits à coter.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-px bg-cream/10 rounded-2xl overflow-hidden">
                {TRUST_MARKS.map((t) => (
                  <div key={t.label} className="bg-forest px-4 py-5">
                    <t.icon className="w-4 h-4 text-lime mb-3" />
                    <p className="kicker text-cream/40">{t.label}</p>
                    <p className="font-display text-lg mt-1 leading-none text-cream">{t.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA card — right */}
            <div className="lg:col-span-5">
              <div className="bg-cream text-forest rounded-2xl p-7 sm:p-8 shadow-2xl flex flex-col h-full">
                <p className="kicker text-forest/50">Démarrer en 1 clic</p>
                <h3 className="font-display text-3xl uppercase tracking-tight mt-1">
                  Espace de sourcing personnel
                </h3>
                <p className="mt-3 text-sm text-forest/70 leading-relaxed">
                  Nous créons votre demande maintenant. À l’étape suivante, vous ajoutez vos
                  produits (photos, liens, descriptions) puis vos coordonnées.
                </p>

                <ol className="mt-6 space-y-3">
                  {STEPS.map((s, i) => (
                    <li
                      key={s.label}
                      className="flex items-center gap-3 text-sm text-forest"
                    >
                      <span className="kicker tabular-nums text-forest/40 w-7">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <s.icon className="w-4 h-4 text-forest/60" />
                      <span>{s.label}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-auto pt-6">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleStart}
                    disabled={submitting}
                    className="w-full flex items-center justify-between gap-2 rounded-full bg-forest hover:bg-forest-soft px-6 py-4 text-base font-semibold text-cream disabled:opacity-60 group transition-colors"
                  >
                    <span>
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Création…
                        </>
                      ) : (
                        'Démarrer ma demande'
                      )}
                    </span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </motion.button>

                  {error && (
                    <p className="text-xs text-red-600 mt-3">{error}</p>
                  )}

                  <p className="text-[11px] text-forest/50 leading-relaxed mt-3">
                    Aucune inscription. Lien personnel généré automatiquement.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TwinskQuickQuote;
