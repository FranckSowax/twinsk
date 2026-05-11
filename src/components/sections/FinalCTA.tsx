'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, MessageCircle } from 'lucide-react';
import Link from 'next/link';

export default function FinalCTA() {
  return (
    <section className="relative px-5 sm:px-8 lg:px-10 py-20 lg:py-28 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl bg-slate-900 text-white"
        >
          <div
            aria-hidden
            className="absolute -top-32 -right-20 w-[600px] h-[600px] bg-lime/15 rounded-full blur-3xl pointer-events-none"
          />
          <div
            aria-hidden
            className="absolute -bottom-40 -left-20 w-[500px] h-[500px] bg-lime/10 rounded-full blur-3xl pointer-events-none"
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.05] pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 p-10 sm:p-14 lg:p-20">
            <div className="lg:col-span-7">
              <div className="flex items-center gap-3 mb-5">
                <span className="h-px w-10 bg-lime" />
                <span className="kicker text-lime">
                  <span className="tabular-nums opacity-60">07</span>
                  <span className="mx-2 opacity-30">/</span>
                  Démarrons
                </span>
              </div>

              <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl uppercase tracking-tight leading-[0.92]">
                Prêt à <span className="text-lime">importer</span>
                <br />
                depuis la Chine ?
              </h2>

              <p className="mt-7 max-w-xl text-base sm:text-lg text-slate-300 leading-relaxed">
                Devis détaillé sous 48h, agents francophones, paiement sécurisé.
                Démarrez votre projet maintenant — sans engagement.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/freight"
                  className="group inline-flex items-center justify-between gap-2 bg-lime hover:bg-lime-soft text-slate-900 px-7 py-4 rounded-full text-sm sm:text-base font-bold shadow-2xl shadow-lime/20 transition-all min-w-[260px]"
                >
                  <span>Demander une cotation</span>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>

                <a
                  href="#delegations"
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur text-white px-7 py-4 rounded-full text-sm sm:text-base font-semibold border border-white/20 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Organiser une visite
                </a>
              </div>
            </div>

            <div className="lg:col-span-5 lg:pl-10 lg:border-l border-white/10 flex flex-col justify-center">
              <p className="kicker text-slate-400 mb-4">Nous écrire directement</p>
              <ul className="space-y-4">
                <li>
                  <a
                    href="https://wa.me/85200000000"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    <div>
                      <p className="kicker text-lime">WhatsApp</p>
                      <p className="font-mono text-sm mt-1">+852 0000 0000</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-lime transition-colors" />
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:hello@twinsk.com"
                    className="group flex items-center justify-between gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    <div>
                      <p className="kicker text-lime">Email</p>
                      <p className="font-mono text-sm mt-1">hello@twinsk.com</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-lime transition-colors" />
                  </a>
                </li>
                <li>
                  <div className="p-4 rounded-2xl bg-lime text-slate-900">
                    <p className="kicker text-slate-900/70">Bureau Hong Kong</p>
                    <p className="font-semibold text-sm mt-1">
                      Twinsk Company Limited
                    </p>
                    <p className="text-xs mt-1 text-slate-800">
                      Lun – Sam · 09:00 – 19:00 HKT
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
