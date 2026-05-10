'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane,
  Ship,
  Calculator,
  MapPin,
  Package,
  Ruler,
  Loader2,
  CheckCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useMemo, useState } from 'react';

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
      className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-20"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-cyan-100/30 to-transparent rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
          <Calculator className="w-3.5 h-3.5" />
          Logistique en 1 clic
        </div>
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium text-slate-900 dark:text-white leading-[0.95] tracking-tight mb-4">
          <span className="block">Calculez votre fret</span>
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600">
            depuis la Chine
          </span>
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-lg font-light max-w-2xl mx-auto">
          Aérien ou maritime — obtenez une estimation instantanée et envoyez votre demande à un agent.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl shadow-slate-900/5 border border-slate-200/50 dark:border-slate-700 overflow-hidden"
      >
        <div className="grid grid-cols-1 lg:grid-cols-5">
          <div className="lg:col-span-3 p-6 sm:p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-slate-200/60 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setMode('sea')}
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all ${
                  mode === 'sea'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <Ship className="w-4 h-4" /> Maritime
              </button>
              <button
                onClick={() => setMode('air')}
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all ${
                  mode === 'air'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <Plane className="w-4 h-4" /> Aérien
              </button>
            </div>

            {mode === 'sea' && (
              <div className="grid grid-cols-3 gap-2 mb-6">
                {([
                  { id: 'lcl' as const, label: 'LCL (groupage)' },
                  { id: 'fcl20' as const, label: "FCL 20'" },
                  { id: 'fcl40' as const, label: "FCL 40'" },
                ]).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSeaService(s.id)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                      seaService === s.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field icon={MapPin} label="Origine" tone="cyan">
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
                <Field icon={Package} label="Poids (kg)" tone="emerald">
                  <input
                    type="number"
                    min={0}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="bg-transparent border-none text-sm text-slate-900 dark:text-white font-medium w-full focus:outline-none"
                  />
                </Field>
                <Field icon={Ruler} label="Volume (m³)" tone="violet">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="bg-transparent border-none text-sm text-slate-900 dark:text-white font-medium w-full focus:outline-none"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Email ou WhatsApp"
                  className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 lg:p-10 text-white flex flex-col">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Estimation indicative
              </p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-400">
                  ${estimate.price.toLocaleString()}
                </span>
                <span className="text-sm text-slate-400">{estimate.unit}</span>
              </div>
              <p className="text-sm text-slate-300 mt-2">{estimate.detail}</p>
              <div className="mt-3 inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-xs">
                <Sparkles className="w-3 h-3 text-amber-300" />
                Délai estimé : {estimate.days} jours
              </div>
            </div>

            <div className="my-6 border-t border-white/10" />

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="ok"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4"
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
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Envoi…
                    </>
                  ) : (
                    <>
                      Envoyer ma demande <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              )}
            </AnimatePresence>

            <p className="mt-4 text-xs text-slate-400 leading-relaxed">
              Estimation à titre indicatif. Le tarif final dépend des dimensions exactes,
              de la nature des marchandises et des taxes locales.
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
  tone: 'amber' | 'cyan' | 'emerald' | 'violet';
  children: React.ReactNode;
}

const TONE_BG: Record<FieldProps['tone'], string> = {
  amber: 'from-amber-500 to-orange-500',
  cyan: 'from-cyan-500 to-blue-500',
  emerald: 'from-emerald-500 to-teal-500',
  violet: 'from-violet-500 to-purple-500',
};

const Field = ({ icon: Icon, label, tone, children }: FieldProps) => (
  <div className="bg-slate-50 dark:bg-slate-700/40 rounded-2xl flex items-center px-4 py-3 focus-within:ring-2 focus-within:ring-amber-500/40 transition-all">
    <div
      className={`w-9 h-9 rounded-xl bg-gradient-to-br ${TONE_BG[tone]} flex items-center justify-center mr-3 flex-shrink-0`}
    >
      <Icon className="w-4 h-4 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <label className="text-[10px] text-slate-400 uppercase tracking-wider block">{label}</label>
      {children}
    </div>
  </div>
);

export default TwinskFreightCalculator;
