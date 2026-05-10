'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  CalendarRange,
  Target,
  Loader2,
  CheckCircle,
  ArrowRight,
  Plane,
  MapPin,
  Languages,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import SectionHeader from './SectionHeader';

const HIGHLIGHTS = [
  { icon: Plane, label: 'Pickup aéroport HK · Shenzhen · Canton' },
  { icon: MapPin, label: 'Visites usines & marchés (Yiwu, Canton, Shenzhen)' },
  { icon: Languages, label: 'Interprète & accompagnement bilingue' },
];

const STATS = [
  { v: '03', l: 'Villes' },
  { v: '5–14j', l: 'Programmes' },
  { v: 'B2B', l: 'RDV' },
];

const TwinskDelegations = () => {
  const [organization, setOrganization] = useState('');
  const [groupSize, setGroupSize] = useState('5');
  const [period, setPeriod] = useState('');
  const [goal, setGoal] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit =
    organization.trim().length > 0 && contact.trim().length > 0 && goal.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'delegation',
          fields: {
            Organisation: organization,
            'Taille du groupe': groupSize,
            'Période souhaitée': period,
            Objectif: goal,
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
    <section
      id="delegations"
      className="relative px-3 sm:px-5 lg:px-6 py-16 lg:py-24 bg-white border-t border-forest/5"
    >
      <div className="max-w-[1600px] mx-auto px-2 sm:px-4">
        <SectionHeader
          index="06"
          kicker="Délégations"
          accent="forest"
          title={
            <>
              <span className="block">Visitez vos projets</span>
              <span className="block">en Chine</span>
            </>
          }
          lead="Société, organisation, ONG, délégation officielle — programme complet : visa, hébergement, transport, visites d’usines, rencontres B2B et interprétariat."
          meta={
            <dl className="grid grid-cols-3 gap-6 lg:gap-10">
              {STATS.map((s) => (
                <div key={s.l}>
                  <dt className="kicker text-forest/40">{s.l}</dt>
                  <dd className="font-display text-3xl lg:text-4xl text-forest tabular-nums leading-none mt-1">
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          }
        />

        <div className="mt-12 lg:mt-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.215, 0.61, 0.355, 1] }}
            className="lg:col-span-5"
          >
            <div className="relative rounded-3xl overflow-hidden h-[420px]">
              <Image
                src="/Carte-Twinslk-logistic-.jpg"
                alt="Réception délégations en Chine"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/30 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <p className="kicker text-lime mb-2">Sur place</p>
                <p className="font-display text-3xl lg:text-4xl text-cream uppercase leading-[0.95] tracking-tight">
                  Hong Kong
                  <br />
                  Canton · Yiwu
                </p>
              </div>
            </div>

            <ul className="mt-6 space-y-px bg-forest/10 rounded-2xl overflow-hidden border border-forest/10">
              {HIGHLIGHTS.map((h, i) => (
                <li
                  key={h.label}
                  className="bg-cream px-5 py-4 flex items-center gap-4"
                >
                  <span className="kicker text-forest/40 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h.icon className="w-4 h-4 text-forest flex-shrink-0" />
                  <span className="text-sm text-forest/80">{h.label}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.215, 0.61, 0.355, 1] }}
            className="lg:col-span-7"
          >
            <div className="relative bg-cream rounded-3xl p-6 sm:p-8 lg:p-10 border border-forest/10 shadow-[0_20px_50px_-25px_rgba(14,63,61,0.18)]">
              <p className="kicker text-forest/50 mb-1">Formulaire</p>
              <h3 className="font-display text-3xl uppercase tracking-tight text-forest mb-7">
                Planifier la visite
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field icon={Building2} label="Organisation *">
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Société, ONG, institution"
                    className="bg-transparent border-none text-sm text-forest font-medium w-full focus:outline-none placeholder:text-forest/40"
                  />
                </Field>
                <Field icon={Users} label="Taille du groupe">
                  <input
                    type="number"
                    min={1}
                    value={groupSize}
                    onChange={(e) => setGroupSize(e.target.value)}
                    className="bg-transparent border-none text-sm text-forest font-medium w-full focus:outline-none tabular-nums"
                  />
                </Field>
                <Field icon={CalendarRange} label="Période souhaitée">
                  <input
                    type="text"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="Ex : juin 2026, 7 jours"
                    className="bg-transparent border-none text-sm text-forest font-medium w-full focus:outline-none placeholder:text-forest/40"
                  />
                </Field>
                <Field icon={Target} label="Objectif principal *">
                  <input
                    type="text"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Sourcing, salon, formation…"
                    className="bg-transparent border-none text-sm text-forest font-medium w-full focus:outline-none placeholder:text-forest/40"
                  />
                </Field>
              </div>

              <div className="mt-4 pt-4 border-t border-forest/10">
                <p className="kicker text-forest/50 mb-3">Vos coordonnées</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nom du contact"
                    className="rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm text-forest focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
                  />
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Email / WhatsApp *"
                    className="rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm text-forest focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
                  />
                </div>
              </div>

              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="ok"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 flex items-center gap-3 rounded-2xl border border-lime bg-lime/30 p-4"
                  >
                    <CheckCircle className="w-5 h-5 text-forest flex-shrink-0" />
                    <p className="text-sm text-forest">
                      Demande reçue — un agent prépare votre programme.
                    </p>
                  </motion.div>
                ) : (
                  <motion.button
                    key="cta"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting}
                    className="mt-7 flex items-center justify-between gap-2 rounded-full bg-forest hover:bg-forest-soft px-7 py-4 text-base font-semibold text-cream disabled:opacity-60 w-full sm:w-fit min-w-[260px] group"
                  >
                    <span>
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Envoi…
                        </>
                      ) : (
                        'Organiser ma visite'
                      )}
                    </span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
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
  <div className="bg-white rounded-xl flex items-center gap-3 px-4 py-3 border border-forest/15 focus-within:border-forest transition-colors">
    <div className="w-9 h-9 rounded-lg bg-cream text-forest border border-forest/10 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <label className="kicker text-forest/50 block">{label}</label>
      {children}
    </div>
  </div>
);

export default TwinskDelegations;
