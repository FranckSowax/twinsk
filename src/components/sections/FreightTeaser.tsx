'use client';

import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Ship,
  Plane,
  MapPin,
  Package,
  Calculator,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import Link from 'next/link';

type Mode = 'sea' | 'air';

const DESTINATIONS = [
  { label: 'Libreville', flag: '🇬🇦', seaDays: 35, airDays: 7 },
  { label: 'Lomé', flag: '🇹🇬', seaDays: 32, airDays: 9 },
  { label: 'Abidjan', flag: '🇨🇮', seaDays: 30, airDays: 8 },
  { label: 'Douala', flag: '🇨🇲', seaDays: 33, airDays: 9 },
  { label: 'Dakar', flag: '🇸🇳', seaDays: 30, airDays: 9 },
  { label: 'Paris', flag: '🇫🇷', seaDays: 28, airDays: 5 },
];

export default function FreightTeaser() {
  const [mode, setMode] = useState<Mode>('sea');
  const [destination, setDestination] = useState(DESTINATIONS[0].label);
  const [weight, setWeight] = useState('100');
  const [volume, setVolume] = useState('0.5');

  const dest = useMemo(
    () => DESTINATIONS.find((d) => d.label === destination) ?? DESTINATIONS[0],
    [destination],
  );

  const estimate = useMemo(() => {
    const w = Math.max(0, parseFloat(weight) || 0);
    const v = Math.max(0, parseFloat(volume) || 0);
    if (mode === 'air') {
      const chargeable = Math.max(w, v * 167);
      return {
        price: Math.round(chargeable * 7.5),
        days: dest.airDays,
        detail: `${chargeable.toFixed(0)} kg taxable @ $7.5/kg`,
      };
    }
    const cbm = Math.max(v, 0.5);
    return {
      price: Math.round(cbm * 180),
      days: dest.seaDays,
      detail: `${cbm.toFixed(2)} m³ LCL @ $180/m³`,
    };
  }, [mode, weight, volume, dest]);

  return (
    <section
      id="freight-teaser"
      className="relative px-5 sm:px-8 lg:px-10 py-20 lg:py-28 bg-white border-t border-slate-200 overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute top-1/2 -translate-y-1/2 -left-32 w-[500px] h-[500px] bg-lime/10 rounded-full blur-3xl pointer-events-none"
      />

      <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div className="lg:col-span-5">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-5">
              <span className="h-px w-10 bg-lime" />
              <span className="kicker text-slate-700">
                <span className="tabular-nums opacity-60">03</span>
                <span className="mx-2 opacity-30">/</span>
                Cotation rapide
              </span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl uppercase tracking-tight text-slate-900 leading-[0.95]">
              Estimez puis <br />
              <span className="text-lime">démarrez</span> votre fret
            </h2>
            <p className="mt-5 max-w-md text-base text-slate-600 leading-relaxed">
              Mode aérien ou maritime — obtenez une estimation instantanée. Au clic,
              votre demande est créée et un lien personnel vous est envoyé pour
              compléter avec photos et détails.
            </p>

            <ul className="mt-7 space-y-3">
              {[
                'Estimation immédiate aérien & maritime',
                'Lien personnel pour upload photos + détails',
                'Devis détaillé garanti sous 48h',
                'Agents francophones · paiement sécurisé',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-lime flex-shrink-0 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-slate-900" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/freight"
              className="mt-9 group inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-7 py-4 rounded-full text-sm sm:text-base font-bold shadow-lg shadow-slate-900/20 transition-all"
            >
              <span>Démarrer une cotation complète</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.215, 0.61, 0.355, 1] }}
          className="lg:col-span-7"
        >
          <div className="relative bg-white rounded-3xl border border-slate-200 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)] overflow-hidden">
            <span
              aria-hidden
              className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-transparent via-lime to-transparent"
            />

            <div className="grid grid-cols-1 md:grid-cols-5">
              <div className="md:col-span-3 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-slate-200">
                <div className="flex items-center gap-2 mb-6">
                  <Calculator className="w-4 h-4 text-slate-400" />
                  <p className="kicker text-slate-400">Simulateur express</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-5">
                  <ModeTab
                    active={mode === 'sea'}
                    onClick={() => setMode('sea')}
                    icon={Ship}
                    label="Maritime"
                  />
                  <ModeTab
                    active={mode === 'air'}
                    onClick={() => setMode('air')}
                    icon={Plane}
                    label="Aérien"
                  />
                </div>

                <div className="space-y-3">
                  <Field icon={MapPin} label="Destination">
                    <select
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="bg-transparent text-sm font-medium text-slate-900 w-full focus:outline-none"
                    >
                      {DESTINATIONS.map((d) => (
                        <option key={d.label} value={d.label}>
                          {d.flag} {d.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field icon={Package} label="Poids · kg">
                      <input
                        type="number"
                        min={0}
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        className="bg-transparent text-sm font-medium text-slate-900 w-full focus:outline-none tabular-nums"
                      />
                    </Field>
                    <Field icon={Package} label="Volume · m³">
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={volume}
                        onChange={(e) => setVolume(e.target.value)}
                        className="bg-transparent text-sm font-medium text-slate-900 w-full focus:outline-none tabular-nums"
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 relative bg-slate-900 p-6 sm:p-8 text-white flex flex-col">
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.07] pointer-events-none"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                  }}
                />
                <div className="relative flex-1">
                  <p className="kicker text-lime">Estimation</p>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="font-display text-5xl lg:text-6xl text-white tabular-nums leading-none">
                      ${estimate.price.toLocaleString('en-US')}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">USD</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-3 tabular-nums">{estimate.detail}</p>
                  <div className="mt-5 inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full text-xs">
                    <span className="text-lime">●</span>
                    Délai ~ <span className="tabular-nums">{estimate.days}j</span>
                  </div>
                </div>

                <Link
                  href="/freight"
                  className="relative mt-6 group flex items-center justify-between gap-2 rounded-full bg-lime hover:bg-lime-soft px-5 py-3.5 text-sm font-bold text-slate-900 transition-colors"
                >
                  <span>Démarrer ma demande</span>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>

                <p className="relative mt-3 text-[10px] text-slate-500 leading-relaxed">
                  Estimation indicative. Devis final après photos et détails marchandise.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border transition-all ${
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50 rounded-xl flex items-center gap-3 px-4 py-3 border border-slate-100 focus-within:border-slate-300 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-white text-slate-700 border border-slate-200 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <label className="kicker text-slate-400 block">{label}</label>
        {children}
      </div>
    </div>
  );
}
