'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, ArrowRight, ScanSearch, Truck, Box } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import SectionHeader from './SectionHeader';

const STEPS = [
  {
    icon: ScanSearch,
    title: 'Vous décrivez',
    desc: 'Lien 1688/Alibaba/Taobao ou simple description du produit recherché.',
  },
  {
    icon: Box,
    title: 'Nous prélevons',
    desc: 'Notre équipe à Yiwu et Guangzhou achète et inspecte avant envoi.',
  },
  {
    icon: Truck,
    title: 'Livraison express',
    desc: 'Réception sous 5 à 9 jours par DHL ou FedEx avec tracking.',
  },
];

const TwinskSampling = () => {
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = product.trim().length > 0 && contact.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sampling',
          fields: {
            Produit: product,
            Quantité: quantity,
            'Référence / URL': reference,
            Nom: name,
            Contact: contact,
          },
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
      id="sampling"
      className="relative bg-slate-50 dark:bg-slate-900/30 py-24 lg:py-32"
    >
      <div className="absolute inset-x-0 top-0 section-divider" />

      <div className="max-w-[1600px] mx-auto px-4 md:px-8">
        <SectionHeader
          index="02"
          kicker="Échantillonnage"
          accent="amber"
          title={
            <>
              <span className="block">Validez avant</span>
              <span className="block text-amber-500">de commander</span>
            </>
          }
          lead="Recevez un échantillon, vérifiez la qualité, négociez le prix usine — puis lancez la commande sereinement."
        />

        <div className="mt-16 lg:mt-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Steps timeline — left */}
          <div className="lg:col-span-7">
            <ol className="relative space-y-8">
              {STEPS.map((step, i) => (
                <motion.li
                  key={step.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ delay: 0.1 + i * 0.1, ease: [0.215, 0.61, 0.355, 1] }}
                  className="relative grid grid-cols-[auto_1fr] gap-6 items-start pb-8 border-b border-slate-200 dark:border-slate-700 last:border-b-0 last:pb-0"
                >
                  <div>
                    <div className="font-display text-5xl text-amber-500 leading-none tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <step.icon className="w-5 h-5 text-slate-400 mt-3" />
                  </div>
                  <div className="pt-1">
                    <h4 className="font-display text-xl uppercase tracking-tight text-slate-900 dark:text-white mb-2">
                      {step.title}
                    </h4>
                    <p className="text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed font-light">
                      {step.desc}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ol>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-10 grid grid-cols-3 gap-px bg-slate-200 dark:bg-slate-700 rounded-2xl overflow-hidden"
            >
              {[
                { v: '5–9j', l: 'Délai' },
                { v: '¥', l: 'Prix usine' },
                { v: '100%', l: 'Inspection' },
              ].map((s) => (
                <div
                  key={s.l}
                  className="bg-slate-50 dark:bg-slate-800 px-4 py-5 text-center"
                >
                  <p className="font-display text-2xl text-slate-900 dark:text-white tabular-nums">
                    {s.v}
                  </p>
                  <p className="kicker text-slate-400 mt-1">{s.l}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Form card — right */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.215, 0.61, 0.355, 1] }}
            className="lg:col-span-5 lg:sticky lg:top-24"
          >
            <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-[0_30px_60px_-30px_rgba(15,23,42,0.18)] border border-slate-200/70 dark:border-slate-700 overflow-hidden">
              <span className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

              <div className="relative h-44 overflow-hidden">
                <Image
                  src="/Carte-sample-.jpg"
                  alt="Échantillonnage Twinsk"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <p className="kicker text-white/70">Yiwu · Guangzhou · Shenzhen</p>
                </div>
              </div>

              <div className="p-6 sm:p-7">
                <p className="kicker text-slate-400 mb-1">Formulaire express</p>
                <h3 className="font-display text-2xl uppercase tracking-tight text-slate-900 dark:text-white mb-5">
                  Demander un échantillon
                </h3>

                <div className="space-y-3">
                  <textarea
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    rows={2}
                    placeholder="Décrivez le produit recherché *"
                    className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Quantité"
                      className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-4 py-3 text-sm text-slate-900 dark:text-white tabular-nums focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    />
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Lien (optionnel)"
                      className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nom"
                      className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    />
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="Email / WhatsApp *"
                      className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    />
                  </div>

                  <AnimatePresence mode="wait">
                    {submitted ? (
                      <motion.div
                        key="ok"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 dark:border-emerald-700/50 dark:bg-emerald-900/20 p-4"
                      >
                        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                          Reçu — un agent vous contactera sous 24 h.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="cta"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={handleSubmit}
                        disabled={!canSubmit || submitting}
                        className="w-full flex items-center justify-between gap-2 rounded-xl bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 px-5 py-4 text-sm font-semibold text-white dark:text-slate-950 disabled:opacity-60 mt-2 group"
                      >
                        <span>
                          {submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Envoi…
                            </>
                          ) : (
                            'Demander mon échantillon'
                          )}
                        </span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default TwinskSampling;
