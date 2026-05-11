'use client';

import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { TrendingUp, Award, Shield, Clock } from 'lucide-react';

interface KpiData {
  end: number;
  suffix: string;
  prefix?: string;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
}

const KPIS: KpiData[] = [
  {
    end: 98,
    suffix: '%',
    label: "Livraison à l'heure",
    sub: 'Engagement contractuel',
    icon: Clock,
  },
  {
    end: 48,
    suffix: 'h',
    label: 'Devis garanti',
    sub: 'Réponse maximum',
    icon: TrendingUp,
  },
  {
    end: 25,
    suffix: '+',
    label: 'Pays desservis',
    sub: 'Afrique · Europe · Amérique',
    icon: Shield,
  },
  {
    end: 4.9,
    suffix: '/5',
    label: 'Satisfaction client',
    sub: 'Note moyenne 2024',
    icon: Award,
  },
];

export default function TrustStats() {
  return (
    <section className="relative px-5 sm:px-8 lg:px-10 py-20 lg:py-28 bg-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto">
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
              <span className="tabular-nums opacity-60">02</span>
              <span className="mx-2 opacity-30">/</span>
              Performance
            </span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl uppercase tracking-tight text-slate-900 leading-[0.95]">
            Des résultats <span className="text-lime">concrets</span>
            <br />
            pour nos clients
          </h2>
          <p className="mt-5 max-w-xl text-base text-slate-600 leading-relaxed">
            Plus de 1 200 PME africaines nous font confiance pour leurs imports
            depuis la Chine. Voici les chiffres.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-16">
          {KPIS.map((kpi, i) => (
            <KpiCard key={kpi.label} kpi={kpi} delay={i * 0.1} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-8 sm:p-10 lg:p-14"
        >
          <div
            aria-hidden
            className="absolute -top-32 -right-20 w-96 h-96 bg-lime/15 rounded-full blur-3xl pointer-events-none"
          />
          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <div className="kicker text-lime mb-4">Étude de cas</div>
              <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl uppercase tracking-tight leading-tight mb-5">
                « Twinsk nous fait économiser <span className="text-lime">35%</span>{' '}
                sur chaque conteneur depuis 3 ans »
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-lime">
                  M
                </div>
                <div>
                  <p className="font-semibold text-white">Marie K.</p>
                  <p className="text-sm text-slate-400">
                    CEO · Mode &amp; Beauté · Libreville
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 border border-slate-700/50">
                <p className="kicker text-slate-400">Économies</p>
                <p className="font-display text-4xl lg:text-5xl text-lime tabular-nums mt-2 leading-none">
                  35%
                </p>
                <p className="text-xs text-slate-400 mt-2">vs. fournisseur précédent</p>
              </div>
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 border border-slate-700/50">
                <p className="kicker text-slate-400">Conteneurs</p>
                <p className="font-display text-4xl lg:text-5xl text-white tabular-nums mt-2 leading-none">
                  48
                </p>
                <p className="text-xs text-slate-400 mt-2">livrés en 2024</p>
              </div>
              <div className="col-span-2 bg-lime rounded-2xl p-5">
                <p className="kicker text-slate-900/70">Délai moyen</p>
                <p className="font-display text-2xl text-slate-900 mt-1">
                  32 jours porte-à-porte
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function KpiCard({ kpi, delay }: { kpi: KpiData; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const motionValue = useMotionValue(0);
  const Icon = kpi.icon;
  const isDecimal = kpi.end % 1 !== 0;
  const rounded = useTransform(motionValue, (v) =>
    isDecimal ? v.toFixed(1) : Math.round(v).toString(),
  );
  const displayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(motionValue, kpi.end, {
      duration: 1.6,
      delay,
      ease: 'easeOut',
    });
    const unsubscribe = rounded.on('change', (v) => {
      if (displayRef.current) displayRef.current.textContent = v;
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [inView, motionValue, kpi.end, delay, rounded]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.215, 0.61, 0.355, 1] }}
      className="group relative bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 hover:border-slate-900/30 hover:shadow-lg transition-all"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-lime group-hover:text-slate-900 transition-colors flex items-center justify-center text-slate-700">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        {kpi.prefix && (
          <span className="font-display text-3xl text-slate-900">{kpi.prefix}</span>
        )}
        <span
          ref={displayRef}
          className="font-display text-5xl sm:text-6xl text-slate-900 leading-none tabular-nums"
        >
          0
        </span>
        <span className="font-display text-2xl text-lime">{kpi.suffix}</span>
      </div>
      <p className="mt-4 font-semibold text-slate-900">{kpi.label}</p>
      <p className="text-xs text-slate-500 mt-1">{kpi.sub}</p>
    </motion.div>
  );
}
