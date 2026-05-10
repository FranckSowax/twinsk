'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ArrowRight, Loader2, CheckCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';

const BUDGETS = ['< 1 000 €', '1 000 – 5 000 €', '5 000 – 20 000 €', '> 20 000 €'];
const TIMELINES = ['Urgent (< 7j)', 'Sous 1 mois', 'Sous 3 mois', 'Flexible'];

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
    <section id="quick-quote" className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-20">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 sm:p-12 lg:p-16 shadow-2xl"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-amber-500/30 to-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-cyan-500/20 to-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="text-white">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              Cotation rapide
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium leading-[0.95] tracking-tight uppercase mb-6">
              <span className="block">Un projet ?</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400">
                Devis sous 24 h
              </span>
            </h2>
            <p className="text-slate-300 text-lg font-light leading-relaxed max-w-md mb-6">
              Décrivez votre projet en quelques mots — sourcing, logistique ou mix des deux —
              notre équipe vous répond avec un devis personnalisé sous 24 heures.
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              {['Sourcing usine en Chine', 'Logistique aérien & maritime', 'Dédouanement & livraison'].map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white/95 dark:bg-slate-800 rounded-[2rem] p-6 sm:p-8 shadow-2xl backdrop-blur">
            <h3 className="font-display text-xl font-medium text-slate-900 dark:text-white mb-4">
              Décrivez votre projet
            </h3>

            <div className="space-y-3">
              <textarea
                value={project}
                onChange={(e) => setProject(e.target.value)}
                rows={3}
                placeholder="Ex : 500 robes en wax + transport maritime vers Libreville…"
                className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
                  Budget
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BUDGETS.map((b) => (
                    <button
                      key={b}
                      onClick={() => setBudget(b)}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                        budget === b
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
                  Délai
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TIMELINES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTimeline(t)}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                        timeline === t
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nom"
                  className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Email / WhatsApp *"
                  className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="ok"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 p-4"
                  >
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Devis en cours — vous recevrez une réponse sous 24 h.
                    </p>
                  </motion.div>
                ) : (
                  <motion.button
                    key="cta"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Envoi…
                      </>
                    ) : (
                      <>
                        Recevoir mon devis <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default TwinskQuickQuote;
