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
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="freight" className="relative px-3 sm:px-5 lg:px-6 py-16 lg:py-24">
      <div className="max-w-[1600px] mx-auto px-2 sm:px-4">
        <SectionHeader
          index="01"
          kicker="Logistique"
          accent="forest"
          title={
            <>
              <span className="block">Calculez</span>
              <span className="block">votre fret</span>
            </>
          }
          lead="Aérien ou maritime — estimation instantanée et envoi à un agent francophone basé à Hong Kong."
          meta={
            <dl className="grid grid-cols-3 gap-6 lg:gap-10">
              {HEADER_KPIS.map((k) => (
                <div key={k.label} className="text-left">
                  <dt className="kicker text-forest/50">{k.label}</dt>
                  <dd className="font-display text-3xl lg:text-4xl text-forest leading-none mt-1 tabular-nums">
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
          className="relative mt-12 lg:mt-16 bg-white rounded-3xl border border-forest/10 overflow-hidden shadow-[0_20px_50px_-25px_rgba(14,63,61,0.18)]"
        >
          <div className="grid grid-cols-1 lg:grid-cols-5">
            <div className="lg:col-span-3 p-6 sm:p-10 border-b lg:border-b-0 lg:border-r border-forest/10">
              <div className="flex items-center justify-between mb-6">
                <p className="kicker text-forest/50">Mode de transport</p>
                <span className="kicker text-forest/30">A · B</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-7">
                <ModeButton
                  active={mode === 'sea'}
                  onClick={() => setMode('sea')}
                  icon={Ship}
                  label="Maritime"
                />
                <ModeButton
                  active={mode === 'air'}
                  onClick={() => setMode('air')}
                  icon={Plane}
                  label="Aérien"
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
                          ? 'bg-forest text-cream'
                          : 'bg-cream text-forest/60 hover:bg-forest/5'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field icon={MapPin} label="Origine">
                    <input
                      type="text"
                      value="Chine"
                      disabled
                      className="bg-transparent border-none text-sm text-forest font-medium w-full focus:outline-none"
                    />
                  </Field>
                  <Field icon={MapPin} label="Destination">
                    <select
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="bg-transparent border-none text-sm text-forest font-medium w-full focus:outline-none"
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
                  <Field icon={Package} label="Poids · kg">
                    <input
                      type="number"
                      min={0}
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="bg-transparent border-none text-sm text-forest font-medium w-full focus:outline-none tabular-nums"
                    />
                  </Field>
                  <Field icon={Ruler} label="Volume · m³">
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={volume}
                      onChange={(e) => setVolume(e.target.value)}
                      className="bg-transparent border-none text-sm text-forest font-medium w-full focus:outline-none tabular-nums"
                    />
                  </Field>
                </div>

                <div className="pt-4 mt-2 border-t border-forest/10">
                  <p className="kicker text-forest/50 mb-3">Vos coordonnées</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nom complet"
                      className="rounded-xl border border-forest/15 bg-cream px-4 py-3 text-sm text-forest focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
                    />
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="Email ou WhatsApp"
                      className="rounded-xl border border-forest/15 bg-cream px-4 py-3 text-sm text-forest focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 relative bg-forest p-6 sm:p-10 text-cream flex flex-col">
              <div className="absolute inset-0 grid-bg opacity-[0.07] pointer-events-none" />

              <div className="relative">
                <p className="kicker text-lime">Estimation indicative</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-[64px] lg:text-[80px] leading-none text-cream tabular-nums">
                    ${estimate.price.toLocaleString('en-US')}
                  </span>
                  <span className="text-sm text-cream/60 font-mono">{estimate.unit}</span>
                </div>
                <p className="text-sm text-cream/80 mt-3 font-light">{estimate.detail}</p>

                <div className="mt-6 grid grid-cols-2 gap-px bg-cream/10 rounded-xl overflow-hidden">
                  <div className="bg-forest px-4 py-3">
                    <p className="kicker text-cream/50">Délai</p>
                    <p className="font-display text-2xl mt-1 tabular-nums text-cream">~{estimate.days}j</p>
                  </div>
                  <div className="bg-forest px-4 py-3">
                    <p className="kicker text-cream/50">Mode</p>
                    <p className="font-display text-2xl mt-1 uppercase text-cream">
                      {mode === 'air' ? 'Air' : seaService.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="my-8 border-t border-cream/10" />

              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="ok"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative flex items-center gap-3 rounded-2xl border border-lime/30 bg-lime/10 p-4"
                  >
                    <CheckCircle className="w-6 h-6 text-lime flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-lime">Demande envoyée</p>
                      <p className="text-cream/80">Un agent vous contactera sous peu.</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="cta"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="relative group flex items-center justify-between gap-2 rounded-full bg-lime hover:bg-lime-soft px-6 py-4 text-sm font-semibold text-forest disabled:opacity-60 transition-colors"
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

              <p className="relative mt-5 text-[11px] text-cream/50 leading-relaxed font-light">
                Tarif indicatif. Le prix final dépend des dimensions exactes, de la nature des
                marchandises et des taxes locales.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

interface FieldProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}

const Field = ({ icon: Icon, label, children }: FieldProps) => (
  <div className="bg-cream rounded-xl flex items-center gap-3 px-4 py-3 border border-forest/10 focus-within:border-forest transition-colors">
    <div className="w-9 h-9 rounded-lg bg-white text-forest border border-forest/10 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <label className="kicker text-forest/50 block">{label}</label>
      {children}
    </div>
  </div>
);

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const ModeButton = ({ active, onClick, icon: Icon, label }: ModeButtonProps) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-medium border transition-all ${
      active
        ? 'bg-forest text-cream border-forest'
        : 'bg-white text-forest/60 border-forest/15 hover:border-forest/40'
    }`}
  >
    <Icon className="w-4 h-4" /> {label}
  </button>
);

export default TwinskFreightCalculator;
