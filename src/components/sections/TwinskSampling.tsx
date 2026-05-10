'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { useState } from 'react';

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
    <motion.article
      id="sampling"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.215, 0.61, 0.355, 1] }}
      className="relative h-full bg-cream rounded-3xl border border-forest/10 overflow-hidden shadow-[0_20px_50px_-25px_rgba(15,23,42,0.18)] p-6 sm:p-8 lg:p-10 flex flex-col"
    >
      <div className="flex items-center gap-3">
        <span className="h-px w-10 bg-forest" />
        <span className="kicker text-forest">
          <span className="tabular-nums opacity-70">05</span>
          <span className="mx-2 opacity-30">/</span>
          Échantillonnage
        </span>
      </div>

      <h2 className="font-display text-3xl sm:text-4xl uppercase tracking-tight text-forest leading-[0.95] mt-5">
        Recevez votre <br />
        <span className="text-lime">échantillon</span>
      </h2>
      <p className="text-forest/70 mt-3 text-sm leading-relaxed max-w-md">
        Validez la qualité avant de commander. Notre équipe à Yiwu et Guangzhou prélève,
        inspecte et expédie sous 5 à 9 jours.
      </p>

      <div className="mt-6 space-y-3">
        <textarea
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          rows={2}
          placeholder="Décrivez le produit recherché *"
          className="w-full resize-none rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm text-forest focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Quantité"
            className="rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm text-forest tabular-nums focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
          />
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Lien (optionnel)"
            className="rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm text-forest focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
      </div>

      <div className="mt-auto pt-5">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-2xl border border-lime bg-lime/30 p-4"
            >
              <CheckCircle className="w-5 h-5 text-forest flex-shrink-0" />
              <p className="text-sm text-forest">Reçu — un agent vous contactera sous 24 h.</p>
            </motion.div>
          ) : (
            <motion.button
              key="cta"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full flex items-center justify-between gap-2 rounded-full bg-forest hover:bg-forest-soft px-5 py-4 text-sm font-semibold text-cream disabled:opacity-60 group"
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
    </motion.article>
  );
};

export default TwinskSampling;
