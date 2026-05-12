'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Menu, X, Sparkles } from 'lucide-react';
import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';

const Globe3D = dynamic(() => import('./HeroGlobe3D'), { ssr: false });

const NAV_ITEMS = [
  { label: 'Services', href: '#services' },
  { label: 'Cotation', href: '/freight' },
  { label: 'YouTube', href: '#youtube-shop' },
  { label: 'Contact', href: '#delegations' },
];

const STATS = [
  { value: '+150K', label: 'Conteneurs traités' },
  { value: '48h', label: 'Devis garanti' },
  { value: '25+', label: 'Pays desservis' },
  { value: '4.9/5', label: 'Satisfaction client' },
];

export default function HeroPro() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section
      id="home"
      className="relative min-h-screen bg-white overflow-hidden"
    >
      {/* Background gradient mesh */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-50" />
        <div
          aria-hidden
          className="absolute top-0 right-0 w-[800px] h-[800px] bg-lime/20 rounded-full blur-[120px] -translate-y-1/3 translate-x-1/3"
        />
        <div
          aria-hidden
          className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-slate-200/40 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3"
        />
      </div>

      {/* Top nav */}
      <nav className="relative z-30 max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 pt-5 sm:pt-7 flex items-center justify-between">
        <a href="#home" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
            T
          </div>
          <span className="font-display text-xl uppercase tracking-tight text-slate-900">
            Twinsk
          </span>
        </a>

        <div className="hidden md:flex items-center gap-1 bg-white/60 backdrop-blur-md border border-slate-200/60 rounded-full p-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/freight"
            className="hidden md:inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors group"
          >
            Démarrer
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden relative z-30 mx-5 mt-3 bg-white rounded-2xl border border-slate-200 overflow-hidden"
          >
            <div className="p-2 space-y-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="/freight"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between px-4 py-3 text-sm font-semibold bg-slate-900 text-white rounded-xl mt-2"
              >
                Démarrer une cotation
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 pt-12 sm:pt-20 lg:pt-24 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center min-h-[640px]">
          {/* Left: copy */}
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
            >
              <Sparkles className="w-3 h-3 text-lime" />
              <span>Twinsk Company · Hong Kong</span>
              <span className="opacity-50">·</span>
              <span className="text-lime">EST. 2018</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="font-display text-[44px] sm:text-6xl lg:text-7xl xl:text-[88px] leading-[0.92] tracking-tight uppercase text-slate-900"
            >
              <span className="block">Twinsk</span>
              <span className="block">votre solution</span>
              <span className="block">
                logistique &amp;{' '}
                <span className="relative inline-block">
                  sourcing
                  <svg
                    aria-hidden
                    viewBox="0 0 200 12"
                    className="absolute -bottom-2 left-0 w-full text-lime"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0,8 Q50,2 100,6 T200,4"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                </span>
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-7 max-w-lg text-base sm:text-lg text-slate-600 leading-relaxed"
            >
              Compagnie logistique &amp; sourcing basée à Hong Kong. De la cotation
              jusqu&apos;à la livraison, nous gérons votre projet de bout en bout —
              aérien, maritime, échantillonnage, véhicules, délégations.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <a
                href="/freight"
                className="group inline-flex items-center gap-2 bg-lime hover:bg-lime-soft text-slate-900 px-6 py-3.5 rounded-full text-sm sm:text-base font-bold shadow-lg shadow-lime/30 hover:shadow-xl transition-all"
              >
                <span>Demander une cotation</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
              <a
                href="#services"
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-900 px-6 py-3.5 rounded-full text-sm sm:text-base font-semibold border border-slate-200 transition-colors"
              >
                Voir nos services
              </a>
            </motion.div>

            {/* Stats inline */}
            <motion.dl
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55 }}
              className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-3 pt-8 border-t border-slate-200"
            >
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt className="kicker text-slate-400">{s.label}</dt>
                  <dd className="font-display text-2xl sm:text-3xl text-slate-900 leading-none mt-1 tabular-nums">
                    {s.value}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* Right: 3D Globe */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative h-[420px] sm:h-[520px] lg:h-[640px]"
          >
            <Suspense fallback={<div className="w-full h-full" />}>
              <Globe3D />
            </Suspense>

            {/* Floating cards over the globe */}
            <motion.div
              initial={{ opacity: 0, x: 20, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.7, delay: 1 }}
              className="absolute top-6 left-4 sm:left-0 bg-white rounded-2xl shadow-xl shadow-slate-900/10 p-4 max-w-[200px] border border-slate-100"
            >
              <p className="kicker text-slate-400">Aérien · Express</p>
              <p className="font-display text-2xl text-slate-900 mt-1 leading-none tabular-nums">
                5j
              </p>
              <p className="text-xs text-slate-500 mt-2">Chine → Libreville</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.7, delay: 1.2 }}
              className="absolute bottom-12 right-4 sm:right-0 bg-slate-900 rounded-2xl shadow-2xl p-4 max-w-[220px]"
            >
              <p className="kicker text-lime">Cotation rapide</p>
              <p className="font-display text-2xl text-white mt-1 leading-none">
                $1,450
              </p>
              <p className="text-xs text-slate-400 mt-2">
                FCL 20&apos; · LCL dès $180/m³
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.4 }}
              className="absolute top-1/2 right-8 sm:right-12 bg-lime rounded-full px-4 py-2 shadow-lg"
            >
              <p className="text-xs font-bold text-slate-900 tabular-nums">
                🇨🇳 → 🇬🇦 🇨🇲 🇨🇮
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 pb-8 flex items-center justify-between">
        <p className="kicker text-slate-400 hidden sm:block">
          Scroll <span className="text-slate-600">↓</span> Découvrir
        </p>
        <p className="text-xs text-slate-400 ml-auto">
          Trusté par PME africaines &amp; importateurs FR/EN/中文
        </p>
      </div>
    </section>
  );
}
