'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { PackageSearch, Loader2, CheckCircle, ArrowRight, ScanSearch, Truck, Box } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

const STEPS = [
  {
    icon: ScanSearch,
    title: 'Décrivez votre produit',
    desc: 'Lien 1688, Alibaba, Taobao ou simple description.',
  },
  {
    icon: Box,
    title: "Nous prélevons l'échantillon",
    desc: 'Notre équipe achète et inspecte avant expédition.',
  },
  {
    icon: Truck,
    title: 'Envoi express',
    desc: 'Réception sous 5 à 9 jours par DHL ou FedEx.',
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
    <section id="sampling" className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
            <PackageSearch className="w-3.5 h-3.5" />
            Échantillonnage
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium text-slate-900 dark:text-white leading-[0.95] tracking-tight mb-6 uppercase">
            <span className="block">Validez avant</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600">
              de commander
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg font-light leading-relaxed mb-8 max-w-xl">
            Recevez un échantillon de votre produit avant de lancer une commande complète.
            Notre équipe à Guangzhou et Yiwu vérifie la qualité, négocie le prix et expédie
            l’échantillon directement chez vous.
          </p>

          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="flex items-start gap-4"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <step.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-base">
                    {step.title}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="relative"
        >
          <div className="absolute -inset-4 bg-gradient-to-br from-amber-200/40 to-orange-200/30 rounded-[3rem] blur-2xl -z-10" />
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl shadow-slate-900/5 border border-slate-200/50 dark:border-slate-700">
            <div className="relative h-40 rounded-2xl overflow-hidden mb-6">
              <Image
                src="/Carte-sample-.jpg"
                alt="Échantillonnage Twinsk"
                fill
                className="object-cover"
              />
            </div>

            <h3 className="font-display font-medium text-2xl text-slate-900 dark:text-white mb-1">
              Demander un échantillon
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Remplissez ce formulaire — nous revenons vers vous sous 24 h.
            </p>

            <div className="space-y-3">
              <textarea
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                rows={2}
                placeholder="Décrivez le produit recherché"
                className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Quantité"
                  className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Lien 1688/Alibaba (optionnel)"
                  className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
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
                    className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 p-4"
                  >
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Reçu — un agent vous contactera sous 24 h.
                    </p>
                  </motion.div>
                ) : (
                  <motion.button
                    key="cta"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60 mt-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Envoi…
                      </>
                    ) : (
                      <>
                        Demander mon échantillon <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TwinskSampling;
