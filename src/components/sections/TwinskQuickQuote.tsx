'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, CheckCircle, ShieldCheck, Languages, Timer } from 'lucide-react';
import { useState } from 'react';

const BUDGETS = ['< 1 000 €', '1 000 – 5 000 €', '5 000 – 20 000 €', '> 20 000 €'];
const TIMELINES = ['Urgent (< 7j)', 'Sous 1 mois', 'Sous 3 mois', 'Flexible'];

const TRUST_MARKS = [
  { icon: Timer, label: 'Réponse', value: 'Sous 24 h' },
  { icon: ShieldCheck, label: 'Sourcing', value: 'Vérifié usine' },
  { icon: Languages, label: 'Agents', value: 'FR · EN · 中文' },
];

const TwinskQuickQuote = () => {
  const [project, setProject] = useState('');
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [timeline, setTimeline] = useState(TIMELINES[1]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = project.trim().length > 0 && contact.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quick_quote',
          fields: { Projet: project, Budget: budget, Délai: timeline, Nom: name, Contact: contact },
        }),
      });
      setSubmitted(true);
    } catch {
      // ignore
    } finally {
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
            <div className="lg:col-span-6 flex flex-col justify-between">
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
                  <span className="block text-lime">Devis sous 24 h.</span>
                </h2>
                <p className="mt-6 max-w-md text-[17px] text-cream/80 leading-relaxed font-light">
                  Sourcing, fret, dédouanement, livraison. Décrivez votre projet en quelques mots —
                  notre équipe HK + Canton revient vers vous avec un devis détaillé.
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

            <div className="lg:col-span-6">
              <div className="bg-cream text-forest rounded-2xl p-6 sm:p-8 shadow-2xl">
                <p className="kicker text-forest/50">Formulaire</p>
                <h3 className="font-display text-2xl uppercase tracking-tight mb-5 mt-1">
                  Décrivez votre projet
                </h3>

                <div className="space-y-3">
                  <textarea
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    rows={3}
                    placeholder="Ex : 500 robes en wax + transport maritime vers Libreville…"
                    className="w-full resize-none rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm text-forest placeholder:text-forest/40 focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
                  />

                  <div>
                    <p className="kicker text-forest/50 mb-2">Budget estimé</p>
                    <div className="grid grid-cols-2 gap-2">
                      {BUDGETS.map((b) => (
                        <button
                          key={b}
                          onClick={() => setBudget(b)}
                          className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-all tabular-nums ${
                            budget === b
                              ? 'bg-forest text-cream'
                              : 'bg-white text-forest/60 hover:bg-forest/5 border border-forest/10'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="kicker text-forest/50 mb-2">Délai</p>
                    <div className="grid grid-cols-2 gap-2">
                      {TIMELINES.map((t) => (
                        <button
                          key={t}
                          onClick={() => setTimeline(t)}
                          className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                            timeline === t
                              ? 'bg-lime text-forest'
                              : 'bg-white text-forest/60 hover:bg-forest/5 border border-forest/10'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nom"
                      className="rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm text-forest focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
                    />
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="Email / WhatsApp *"
                      className="rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm text-forest focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
                    />
                  </div>

                  <AnimatePresence mode="wait">
                    {submitted ? (
                      <motion.div
                        key="ok"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 rounded-2xl border border-lime bg-lime/30 p-4"
                      >
                        <CheckCircle className="w-5 h-5 text-forest flex-shrink-0" />
                        <p className="text-sm text-forest">
                          Devis en cours — vous recevrez une réponse sous 24 h.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="cta"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={handleSubmit}
                        disabled={!canSubmit || submitting}
                        className="w-full flex items-center justify-between gap-2 rounded-full bg-forest hover:bg-forest-soft px-6 py-4 text-base font-semibold text-cream disabled:opacity-60 group"
                      >
                        <span>
                          {submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Envoi…
                            </>
                          ) : (
                            'Recevoir mon devis'
                          )}
                        </span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </motion.button>
                    )}
                  </AnimatePresence>
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
