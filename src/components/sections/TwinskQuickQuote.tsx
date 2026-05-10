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
      className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-24 lg:py-32"
    >
      <div className="absolute inset-x-0 top-0 section-divider" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.215, 0.61, 0.355, 1] }}
        className="relative overflow-hidden rounded-3xl bg-slate-950 text-white"
      >
        <div className="absolute inset-0 grid-bg opacity-[0.06] pointer-events-none" />
        <div className="absolute -top-40 -right-32 w-[520px] h-[520px] bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <span className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 p-8 sm:p-12 lg:p-16">
          {/* Editorial intro — left */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-amber-400" />
                <span className="kicker text-amber-300/90">
                  <span className="tabular-nums opacity-70">03</span>
                  <span className="mx-2 opacity-30">/</span>
                  Cotation rapide
                </span>
              </div>

              <h2 className="mt-6 font-display text-[44px] sm:text-6xl lg:text-[80px] leading-[0.95] tracking-tight uppercase">
                <span className="block">Un projet ?</span>
                <span className="block text-amber-400">Devis sous 24 h.</span>
              </h2>
              <p className="mt-6 max-w-md text-[17px] text-slate-300 leading-relaxed font-light">
                Sourcing, fret, dédouanement, livraison. Décrivez votre projet en quelques mots —
                notre équipe HK + Canton revient vers vous avec un devis détaillé.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden">
              {TRUST_MARKS.map((t) => (
                <div key={t.label} className="bg-slate-950 px-4 py-5">
                  <t.icon className="w-4 h-4 text-amber-400 mb-3" />
                  <p className="kicker text-slate-500">{t.label}</p>
                  <p className="font-display text-lg mt-1 leading-none">{t.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Form card — right */}
          <div className="lg:col-span-6">
            <div className="bg-white dark:bg-slate-100 text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl">
              <p className="kicker text-slate-500">Formulaire</p>
              <h3 className="font-display text-2xl uppercase tracking-tight mb-5 mt-1">
                Décrivez votre projet
              </h3>

              <div className="space-y-3">
                <textarea
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  rows={3}
                  placeholder="Ex : 500 robes en wax + transport maritime vers Libreville…"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                />

                <div>
                  <p className="kicker text-slate-400 mb-2">Budget estimé</p>
                  <div className="grid grid-cols-2 gap-2">
                    {BUDGETS.map((b) => (
                      <button
                        key={b}
                        onClick={() => setBudget(b)}
                        className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-all tabular-nums ${
                          budget === b
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="kicker text-slate-400 mb-2">Délai</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TIMELINES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTimeline(t)}
                        className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                          timeline === t
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  />
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Email / WhatsApp *"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  />
                </div>

                <AnimatePresence mode="wait">
                  {submitted ? (
                    <motion.div
                      key="ok"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4"
                    >
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <p className="text-sm text-emerald-700">
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
                      className="w-full flex items-center justify-between gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-6 py-4 text-base font-semibold text-white disabled:opacity-60 group"
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
    </section>
  );
};

export default TwinskQuickQuote;
