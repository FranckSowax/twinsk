'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Menu, X, Truck, Plane, Ship } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

const NAV_ITEMS = [
  { label: 'Accueil', href: '#home' },
  { label: 'Services', href: '#freight' },
  { label: 'Cotation', href: '#quick-quote' },
  { label: 'Contact', href: '#delegations' },
];

const TwinskHero = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <section id="home" className="relative px-3 sm:px-5 lg:px-6 pt-3 sm:pt-5 lg:pt-6">
      {/* Top nav inside the cream frame */}
      <nav className="flex items-center justify-between gap-4 px-2 sm:px-4">
        <a
          href="#home"
          className="font-display text-2xl sm:text-3xl uppercase tracking-tight text-forest"
        >
          Twinsk<span className="text-lime-soft">.</span>
        </a>

        <div className="hidden md:flex items-center gap-1 bg-white/70 backdrop-blur rounded-full p-1 border border-forest/10">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="px-4 py-2 text-sm font-medium text-forest/80 hover:text-forest hover:bg-cream rounded-full transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="#quick-quote"
            className="hidden md:inline-flex items-center gap-2 bg-lime hover:bg-lime-soft text-forest px-5 py-2.5 rounded-full text-sm font-semibold transition-colors"
          >
            Démarrer
            <ArrowUpRight className="w-4 h-4" />
          </a>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-white/70 border border-forest/10 text-forest"
            aria-label="Menu"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden mt-3 mx-2 bg-white rounded-2xl border border-forest/10 overflow-hidden"
          >
            <div className="p-2 space-y-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-forest/80 hover:bg-cream rounded-xl"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#quick-quote"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-between px-4 py-3 text-sm font-semibold bg-lime text-forest rounded-xl mt-2"
              >
                Démarrer la cotation
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.215, 0.61, 0.355, 1] }}
        className="relative mt-5 sm:mt-7 rounded-[24px] sm:rounded-[28px] overflow-hidden bg-forest"
      >
        <div className="relative h-[420px] sm:h-[460px] lg:h-[520px]">
          <Image
            src="/Carte-Twinslk-logistic-.jpg"
            alt="Twinsk Logistics — Hong Kong → Monde"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1600px"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-forest/85 via-forest/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-forest/40 via-transparent to-transparent" />
        </div>

        <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-9 lg:p-12">
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-lime" />
            <span className="kicker text-lime">
              <span className="tabular-nums opacity-70">HK</span>
              <span className="mx-2 opacity-30">/</span>
              Logistique &amp; Sourcing
            </span>
          </div>

          <div className="max-w-2xl">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="font-display text-[44px] sm:text-6xl lg:text-[88px] leading-[0.92] tracking-tight uppercase text-cream"
            >
              <span className="block">La voie</span>
              <span className="block">la plus directe</span>
              <span className="block text-lime">depuis la Chine</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-5 max-w-md text-[15px] sm:text-base text-cream/80 font-light leading-relaxed"
            >
              Que vous expédiiez par mer, par air, ou que vous ayez besoin d&apos;un agent en Chine —
              notre équipe basée à Hong Kong gère votre projet de bout en bout.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <a
                href="#quick-quote"
                className="inline-flex items-center justify-between gap-2 bg-lime hover:bg-lime-soft text-forest px-6 py-3.5 rounded-full text-sm font-semibold transition-colors group min-w-[200px]"
              >
                Démarrer maintenant
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
              <a
                href="#freight"
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur hover:bg-white/20 text-cream px-6 py-3.5 rounded-full text-sm font-medium border border-white/20 transition-colors"
              >
                Voir nos services
              </a>
            </motion.div>
          </div>
        </div>

        {/* Floating overlay cards — bottom right */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="hidden sm:flex absolute bottom-6 right-6 lg:bottom-9 lg:right-9 flex-col gap-3 max-w-[280px]"
        >
          <div className="bg-cream/95 backdrop-blur rounded-2xl p-4 shadow-xl border border-white/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-forest text-cream flex items-center justify-center">
                <Ship className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="kicker text-forest/50">Mode</p>
                <p className="font-display text-sm uppercase text-forest leading-tight">
                  Maritime · LCL
                </p>
              </div>
              <span className="kicker text-forest/40 tabular-nums">28j</span>
            </div>
          </div>

          <div className="bg-lime rounded-2xl p-4 shadow-xl">
            <p className="kicker text-forest/60">Cotation rapide</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-3xl text-forest tabular-nums">24h</span>
              <span className="text-xs text-forest/70">de réponse</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Service quick-jump strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.7 }}
        className="mt-5 sm:mt-7 grid grid-cols-3 gap-px bg-forest/10 rounded-2xl overflow-hidden"
      >
        {[
          { icon: Ship, label: 'Maritime', detail: 'LCL · FCL' },
          { icon: Plane, label: 'Aérien', detail: 'Express' },
          { icon: Truck, label: 'Door-to-door', detail: 'Multi-modal' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-cream px-4 py-5 sm:px-6 sm:py-6 flex items-center gap-3 sm:gap-4"
          >
            <s.icon className="w-5 h-5 text-forest flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-base sm:text-lg uppercase text-forest leading-none">
                {s.label}
              </p>
              <p className="text-[11px] sm:text-xs text-forest/60 mt-1">{s.detail}</p>
            </div>
          </div>
        ))}
      </motion.div>
    </section>
  );
};

export default TwinskHero;
