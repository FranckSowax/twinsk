'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Quote, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
  city: string;
  kpi: string;
  kpiLabel: string;
  rating: number;
}

// PLACEHOLDERS — à remplacer par de vrais témoignages clients
const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Twinsk a complètement changé la façon dont je gère mes imports depuis la Chine. Plus de mauvaises surprises, devis sous 48h, et l'équipe parle français.",
    name: 'À remplir · Nom Client',
    role: 'À remplir · Fonction',
    company: 'À remplir · Société',
    city: 'À remplir · Ville',
    kpi: '+40%',
    kpiLabel: 'marge brute',
    rating: 5,
  },
  {
    quote:
      "Le service échantillonnage nous permet de valider la qualité avant chaque commande. Économies considérables sur les retours et les non-conformités.",
    name: 'À remplir · Nom Client',
    role: 'À remplir · Fonction',
    company: 'À remplir · Société',
    city: 'À remplir · Ville',
    kpi: '-65%',
    kpiLabel: 'taux de retour',
    rating: 5,
  },
  {
    quote:
      "L'équipe Twinsk est venue nous chercher à l'aéroport, organisé toutes les visites d'usines à Yiwu et Guangzhou. Programme parfaitement orchestré.",
    name: 'À remplir · Nom Client',
    role: 'À remplir · Fonction',
    company: 'À remplir · Société',
    city: 'À remplir · Ville',
    kpi: '15j',
    kpiLabel: 'mission Chine',
    rating: 5,
  },
  {
    quote:
      'Mon premier container est arrivé exactement à la date promise. Suivi en temps réel sur WhatsApp, dédouanement géré sans stress. Bluffant.',
    name: 'À remplir · Nom Client',
    role: 'À remplir · Fonction',
    company: 'À remplir · Société',
    city: 'À remplir · Ville',
    kpi: '32j',
    kpiLabel: 'porte-à-porte',
    rating: 5,
  },
  {
    quote:
      "On a importé 3 voitures via leur partenaire DriveBy Africa. Tarifs ultra compétitifs, inspection mécanique avant achat, livraison sécurisée.",
    name: 'À remplir · Nom Client',
    role: 'À remplir · Fonction',
    company: 'À remplir · Société',
    city: 'À remplir · Ville',
    kpi: '3',
    kpiLabel: 'véhicules importés',
    rating: 5,
  },
];

export default function Testimonials() {
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearInterval(id);
  }, [autoplay]);

  const prev = () => {
    setAutoplay(false);
    setIndex((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  };
  const next = () => {
    setAutoplay(false);
    setIndex((i) => (i + 1) % TESTIMONIALS.length);
  };

  const current = TESTIMONIALS[index];

  return (
    <section className="relative px-5 sm:px-8 lg:px-10 py-20 lg:py-28 bg-white border-t border-slate-200 overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-32 right-0 w-[600px] h-[600px] bg-lime/10 rounded-full blur-3xl pointer-events-none"
      />

      <div className="relative max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-12 lg:mb-16"
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="h-px w-10 bg-lime" />
            <span className="kicker text-slate-700">
              <span className="tabular-nums opacity-60">05</span>
              <span className="mx-2 opacity-30">/</span>
              Témoignages
            </span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl uppercase tracking-tight text-slate-900 leading-[0.95]">
            Ce qu&apos;en disent <br />
            nos <span className="text-lime">clients</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative h-full bg-slate-50 rounded-3xl p-8 sm:p-10 lg:p-12 border border-slate-200 overflow-hidden"
            >
              <Quote
                className="absolute top-8 right-8 w-16 h-16 text-lime/40"
                strokeWidth={1}
              />

              <AnimatePresence mode="wait">
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5, ease: [0.215, 0.61, 0.355, 1] }}
                >
                  <div className="flex gap-1 mb-5">
                    {Array.from({ length: current.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 text-lime fill-lime"
                        strokeWidth={0}
                      />
                    ))}
                  </div>

                  <p className="font-display text-2xl sm:text-3xl lg:text-4xl uppercase tracking-tight text-slate-900 leading-tight">
                    « {current.quote} »
                  </p>

                  <div className="mt-10 pt-8 border-t border-slate-200 flex flex-wrap items-end justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-slate-900 text-lime flex items-center justify-center font-bold text-xl">
                        {current.name.charAt(0) === 'À' ? '?' : current.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{current.name}</p>
                        <p className="text-sm text-slate-500">
                          {current.role} · {current.company}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{current.city}</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl px-5 py-3 border border-slate-200">
                      <p className="kicker text-slate-400">{current.kpiLabel}</p>
                      <p className="font-display text-3xl text-slate-900 tabular-nums leading-none mt-1">
                        {current.kpi}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-slate-900 rounded-3xl p-6 text-white"
            >
              <p className="kicker text-lime mb-3">Navigation</p>
              <p className="text-sm text-slate-300 mb-5">
                {index + 1} / {TESTIMONIALS.length} témoignages
              </p>
              <div className="flex gap-2">
                <button
                  onClick={prev}
                  aria-label="Précédent"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 py-3 text-sm font-semibold transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Précédent
                </button>
                <button
                  onClick={next}
                  aria-label="Suivant"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-lime text-slate-900 hover:bg-lime-soft py-3 text-sm font-semibold transition-colors"
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-6 flex items-center justify-center gap-1.5">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    aria-label={`Aller au témoignage ${i + 1}`}
                    onClick={() => {
                      setAutoplay(false);
                      setIndex(i);
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index
                        ? 'w-8 bg-lime'
                        : 'w-1.5 bg-white/20 hover:bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex-1 bg-lime rounded-3xl p-6 flex flex-col justify-between"
            >
              <div>
                <p className="kicker text-slate-900/60">Note moyenne</p>
                <p className="font-display text-6xl lg:text-7xl text-slate-900 tabular-nums leading-none mt-2">
                  4.9<span className="text-3xl">/5</span>
                </p>
                <div className="flex gap-1 mt-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 text-slate-900 fill-slate-900"
                      strokeWidth={0}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-700 mt-4">
                Basée sur <span className="font-semibold">+340 avis</span> clients
                vérifiés depuis 2020
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
