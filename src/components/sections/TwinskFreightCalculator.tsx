'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane,
  Ship,
  MapPin,
  Package,
  Ruler,
  Loader2,
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

const TwinskFreightCalculator = () => {
  const [mode, setMode] = useState<Mode>('sea');
  const [destination, setDestination] = useState(DESTINATIONS[0].label);
  const [weight, setWeight] = useState('100');
  const [volume, setVolume] = useState('0.5');
  const [seaService, setSeaService] = useState<SeaService>('lcl');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
      return { price, days: dest.airDays };
    }
    if (seaService === 'lcl') {
      const cbm = Math.max(v, 0.5);
      const price = Math.round(cbm * 180);
      return { price, days: dest.seaDays };
    }
    if (seaService === 'fcl20') {
      return { price: 1450, days: dest.seaDays };
    }
    return { price: 2500, days: dest.seaDays + 2 };
  }, [mode, weight, volume, seaService, dest]);

  const handleStart = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    try {
      // Track lead in admin dashboard (best-effort)
      fetch('/api/leads', {
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
            'Délai (jours)': estimate.days,
          },
        }),
      }).catch(() => {});

      // Create the freight request with the calculator pre-fill
      const res = await fetch('/api/freight-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          sea_service: mode === 'sea' ? seaService : null,
          origin: 'Chine',
          destination: dest.label,
          weight: parseFloat(weight) || 0,
          volume: parseFloat(volume) || 0,
          estimated_price: estimate.price,
          estimated_days: estimate.days,
        }),
      });

      if (!res.ok) throw new Error('create_failed');

      const data = (await res.json()) as { id: string };
      window.location.href = `/freight/${data.id}`;
    } catch {
      setError('Une erreur est survenue. Réessayez ou contactez-nous directement.');
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
              <span className="block">Estimez puis</span>
              <span className="block">démarrez votre fret</span>
            </>
          }
          lead="Aérien ou maritime — calcul instantané. Au clic, votre demande est créée et vous accédez à votre espace pour ajouter photos et détails."
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.215, 0.61, 0.355, 1] }}
          className="relative mt-10 lg:mt-12 bg-white rounded-3xl border border-forest/10 overflow-hidden shadow-[0_20px_50px_-25px_rgba(15,23,42,0.18)]"
        >
          <div className="grid grid-cols-1 lg:grid-cols-5">
            {/* Left: compact form */}
            <div className="lg:col-span-3 p-5 sm:p-7 border-b lg:border-b-0 lg:border-r border-forest/10">
              <div className="grid grid-cols-2 gap-2.5 mb-4">
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
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(
                    [
                      { id: 'lcl' as const, label: 'LCL' },
                      { id: 'fcl20' as const, label: "FCL 20'" },
                      { id: 'fcl40' as const, label: "FCL 40'" },
                    ]
                  ).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSeaService(s.id)}
                      className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
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

              <div className="grid grid-cols-2 gap-2.5">
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
            </div>

            {/* Right: estimate + CTA */}
            <div className="lg:col-span-2 relative bg-forest p-6 sm:p-8 text-cream flex flex-col">
              <div className="absolute inset-0 grid-bg opacity-[0.07] pointer-events-none" />

              <div className="relative flex-1">
                <p className="kicker text-lime">Estimation</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-5xl lg:text-6xl leading-none text-cream tabular-nums">
                    ${estimate.price.toLocaleString('en-US')}
                  </span>
                  <span className="text-xs text-cream/60 font-mono">USD</span>
                </div>
                <p className="text-xs text-cream/70 mt-2 tabular-nums">
                  ~ {estimate.days} jours · {mode === 'air' ? 'Aérien' : seaService.toUpperCase()}
                </p>
              </div>

              <div className="relative mt-6">
                <AnimatePresence mode="wait">
                  <motion.button
                    key="cta"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleStart}
                    disabled={submitting}
                    className="group w-full flex items-center justify-between gap-2 rounded-full bg-lime hover:bg-lime-soft px-5 py-3.5 text-sm font-semibold text-forest disabled:opacity-60 transition-colors"
                  >
                    <span>
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Création…
                        </>
                      ) : (
                        'Démarrer ma demande'
                      )}
                    </span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </motion.button>
                </AnimatePresence>

                {error && (
                  <p className="text-xs text-red-300 mt-2">{error}</p>
                )}

                <p className="text-[11px] text-cream/50 mt-3 leading-relaxed">
                  À l&apos;étape suivante : nature de la marchandise, photos, coordonnées.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const Field = ({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="bg-cream rounded-xl flex items-center gap-2.5 px-3 py-2.5 border border-forest/10 focus-within:border-forest transition-colors">
    <div className="w-8 h-8 rounded-lg bg-white text-forest border border-forest/10 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <label className="kicker text-forest/50 block">{label}</label>
      {children}
    </div>
  </div>
);

const ModeButton = ({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium border transition-all ${
      active
        ? 'bg-forest text-cream border-forest'
        : 'bg-white text-forest/60 border-forest/15 hover:border-forest/40'
    }`}
  >
    <Icon className="w-4 h-4" /> {label}
  </button>
);

export default TwinskFreightCalculator;
