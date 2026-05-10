'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane,
  Ship,
  MapPin,
  Package,
  Ruler,
  Loader2,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import SectionHeader from './SectionHeader';

type Mode = 'air' | 'sea';
type SeaService = 'lcl' | 'fcl20' | 'fcl40';

interface Destination {
  label: string;
  flag: string;
  airDays: number;
  seaDays: number;
}

const DESTINATIONS: Destination[] = [
  { label: 'Libreville', flag: '🇬🇦', airDays: 7, seaDays: 35 },
  { label: 'Lomé', flag: '🇹🇬', airDays: 9, seaDays: 32 },
  { label: 'Abidjan', flag: '🇨🇮', airDays: 8, seaDays: 30 },
  { label: 'Douala', flag: '🇨🇲', airDays: 9, seaDays: 33 },
  { label: 'Lagos', flag: '🇳🇬', airDays: 8, seaDays: 28 },
  { label: 'Kinshasa', flag: '🇨🇩', airDays: 10, seaDays: 38 },
  { label: 'Dakar', flag: '🇸🇳', airDays: 9, seaDays: 30 },
  { label: 'Paris', flag: '🇫🇷', airDays: 5, seaDays: 28 },
  { label: 'Bruxelles', flag: '🇧🇪', airDays: 5, seaDays: 30 },
  { label: 'New York', flag: '🇺🇸', airDays: 6, seaDays: 32 },
];

const HEADER_KPIS = [
  { value: '32', label: 'Destinations' },
  { value: '24h', label: 'Cotation' },
  { value: 'HK', label: 'Hub' },
];

const TwinskFreightCalculator = () => {
  const [mode, setMode] = useState<Mode>('sea');
  const [destination, setDestination] = useState(DESTINATIONS[0].label);
  const [weight, setWeight] = useState('100');
  const [volume, setVolume] = useState('0.5');
  const [seaService, setSeaService] = useState<SeaService>('lcl');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const dest = useMemo(
    () => DESTINATIONS.find((d) => d.label === destination) ?? DESTINATIONS[0],
    [destination],
  );

  const estimate = useMemo(() => {
    const w = Math.max(0, parseFloat(weight) || 0);
    const v = Math.max(0, parseFloat(volume) || 0);
    if (mode === 'air') {
      const chargeable = Math.max(w, v * 167);
      const price = Math.round(chargeable * 7.5);
      return { price, unit: 'USD', detail: `${chargeable.toFixed(1)} kg taxable`, days: dest.airDays };
    }
    if (seaService === 'lcl') {
      const cbm = Math.max(v, 0.5);
      const price = Math.round(cbm * 180);
      return { price, unit: 'USD', detail: `${cbm.toFixed(2)} m³ (LCL)`, days: dest.seaDays };
    }
    if (seaService === 'fcl20') {
      return { price: 1450, unit: 'USD', detail: "Conteneur 20' (≤ 25 m³)", days: dest.seaDays };
    }
    return { price: 2500, unit: 'USD', detail: "Conteneur 40' (≤ 55 m³)", days: dest.seaDays + 2 };
  }, [mode, weight, volume, seaService, dest]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'freight_estimate',
          fields: {
            Mode: mode === 'air' ? 'Aérien' : `Maritime (${seaService.toUpperCase()})`,
            Destination: dest.label,
            'Poids (kg)': weight,
            'Volume (m³)': volume,
            'Estimation (USD)': estimate.price,
            'Délai estimé (jours)': estimate.days,
            Nom: name,
            Contact: contact,
          },
        }),
      });
      setSubmitted(true);
    } catch {
      // erreur ignorée — UX neutre
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="freight"
      className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-24 lg:py-32"
    >
      <div className="absolute inset-x-0 top-0 section-divider" />

      <SectionHeader
        index="01"
        kicker="Logistique"
        accent="amber"
        title={
          <>
            <span className="block">Calculez</span>
            <span className="block text-amber-500">votre fret</span>
          </>
        }
        lead="Aérien ou maritime — estimation instantanée et envoi à un agent francophone basé à Hong Kong."
        meta={
          <dl className="grid grid-cols-3 gap-6 lg:gap-10">
            {HEADER_KPIS.map((k) => (
              <div key={k.label} className="text-left">
                <dt className="kicker text-slate-400">{k.label}</dt>
                <dd className="font-display text-3xl lg:text-4xl text-slate-900 dark:text-white leading-none mt-1 tabular-nums">
                  {k.value}
                </dd>
              </div>
            ))}
          </dl>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.215, 0.61, 0.355, 1] }}
        className="relative mt-14 lg:mt-20 bg-white dark:bg-slate-800 rounded-3xl shadow-[0_30px_60px_-30px_rgba(15,23,42,0.18)] border border-slate-200/70 dark:border-slate-700 overflow-hidden"
      >
        <span className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

        <div className="grid grid-cols-1 lg:grid-cols-5">
          <div className="lg:col-span-3 p-6 sm:p-10 border-b lg:border-b-0 lg:border-r border-slate-200/60 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <p className="kicker text-slate-400">Mode de transport</p>
              <span className="kicker text-slate-300">A · B</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-7">
              <ModeButton
                active={mode === 'sea'}
                onClick={() => setMode('sea')}
                icon={Ship}
                label="Maritime"
                tone="cyan"
              />
              <ModeButton
                active={mode === 'air'}
                onClick={() => setMode('air')}
                icon={Plane}
                label="Aérien"
                tone="amber"
              />
            </div>

            {mode === 'sea' && (
              <div className="grid grid-cols-3 gap-2 mb-7">
                {(
                  [
                    { id: 'lcl' as const, label: 'LCL · groupage' },
                    { id: 'fcl20' as const, label: "FCL · 20'" },
                    { id: 'fcl40' as const, label: "FCL · 40'" },
                  ]
                ).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSeaService(s.id)}
                    className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                      seaService === s.id
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'bg-slate-100/70 dark:bg-slate-700/50 text-slate-500 hover:bg-slate-200/80 dark:text-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field icon={MapPin} label="Origine" tone="slate">
                  <input
                    type="text"
                    value="Chine"
                    disabled
                    className="bg-transparent border-none text-sm text-slate-900 dark:text-white font-medium w-full focus:outline-none"
                  />
                </Field>
                <Field icon={MapPin} label="Destination" tone="amber">
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="bg-transparent border-none text-sm text-slate-900 dark:text-white font-medium w-full focus:outline-none"
                  >
                    {DESTINATIONS.map((d) => (
                      <option key={d.label} value={d.label}>
                        {d.flag} {d.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field icon={Package} label="Poids · kg" tone="slate">
                  <input
                    type="number"
                    min={0}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="bg-transparent border-none text-sm text-slate-900 dark:text-white font-medium w-full focus:outline-none tabular-nums"
                  />
                </Field>
                <Field icon={Ruler} label="Volume · m³" tone="slate">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="bg-transparent border-none text-sm text-slate-900 dark:text-white font-medium w-full focus:outline-none tabular-nums"
                  />
                </Field>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-200/70 dark:border-slate-700">
                <p className="kicker text-slate-400 mb-3">Vos coordonnées</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nom complet"
                    className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  />
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Email ou WhatsApp"
                    className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 relative bg-slate-950 p-6 sm:p-10 text-white flex flex-col">
            <div className="absolute inset-0 grid-bg opacity-[0.07] pointer-events-none" />

            <div className="relative">
              <p className="kicker text-amber-400/80">Estimation indicative</p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-[64px] lg:text-[80px] leading-none text-white tabular-nums">
                  ${estimate.price.toLocaleString('en-US')}
                </span>
                <span className="text-sm text-slate-400 font-mono">{estimate.unit}</span>
              </div>
              <p className="text-sm text-slate-300 mt-3 font-light">{estimate.detail}</p>

              <div className="mt-6 grid grid-cols-2 gap-px bg-white/10 rounded-xl overflow-hidden">
                <div className="bg-slate-950 px-4 py-3">
                  <p className="kicker text-slate-500">Délai</p>
                  <p className="font-display text-2xl mt-1 tabular-nums">~{estimate.days}j</p>
                </div>
                <div className="bg-slate-950 px-4 py-3">
                  <p className="kicker text-slate-500">Mode</p>
                  <p className="font-display text-2xl mt-1 uppercase">
                    {mode === 'air' ? 'Air' : seaService.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            <div className="my-8 border-t border-white/10" />

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="ok"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4"
                >
                  <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-300">Demande envoyée</p>
                    <p className="text-slate-300">Un agent vous contactera sous peu.</p>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="cta"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="relative group flex items-center justify-between gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-6 py-5 text-sm font-semibold text-slate-950 disabled:opacity-60 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Envoi…
                      </>
                    ) : (
                      'Envoyer ma demande'
                    )}
                  </span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </motion.button>
              )}
            </AnimatePresence>

            <p className="relative mt-5 text-[11px] text-slate-500 leading-relaxed font-light">
              Tarif indicatif. Le prix final dépend des dimensions exactes, de la nature des
              marchandises et des taxes locales.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

interface FieldProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: 'amber' | 'cyan' | 'slate';
  children: React.ReactNode;
}

const TONE_BG: Record<FieldProps['tone'], string> = {
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const Field = ({ icon: Icon, label, tone, children }: FieldProps) => (
  <div className="bg-slate-50/70 dark:bg-slate-700/30 rounded-xl flex items-center gap-3 px-4 py-3 border border-slate-100 dark:border-slate-700 focus-within:border-amber-400 transition-colors">
    <div
      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${TONE_BG[tone]}`}
    >
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <label className="kicker text-slate-400 block">{label}</label>
      {children}
    </div>
  </div>
);

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: 'cyan' | 'amber';
}

const ModeButton = ({ active, onClick, icon: Icon, label, tone }: ModeButtonProps) => {
  const activeStyles =
    tone === 'cyan'
      ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-700/50'
      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/50';
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-medium border transition-all ${
        active
          ? activeStyles
          : 'bg-white dark:bg-slate-700/30 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
};

export default TwinskFreightCalculator;
