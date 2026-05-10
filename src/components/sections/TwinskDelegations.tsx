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
      className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-24 lg:py-32"
    >
      <div className="absolute inset-x-0 top-0 section-divider" />

      <SectionHeader
        index="06"
        kicker="Délégations"
        accent="cyan"
        title={
          <>
            <span className="block">Visitez vos projets</span>
            <span className="block text-cyan-600 dark:text-cyan-400">en Chine</span>
          </>
        }
        lead="Société, organisation, ONG, délégation officielle — programme complet : visa, hébergement, transport, visites d’usines, rencontres B2B et interprétariat."
        meta={
          <dl className="grid grid-cols-3 gap-6 lg:gap-10">
            {STATS.map((s) => (
              <div key={s.l}>
                <dt className="kicker text-slate-400">{s.l}</dt>
                <dd className="font-display text-3xl lg:text-4xl text-slate-900 dark:text-white tabular-nums leading-none mt-1">
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>
        }
      />

      <div className="mt-16 lg:mt-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        {/* Editorial photo + highlights — left */}
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
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <p className="kicker text-cyan-300 mb-2">Sur place</p>
              <p className="font-display text-3xl lg:text-4xl text-white uppercase leading-[0.95] tracking-tight">
                Hong Kong
                <br />
                Canton · Yiwu
              </p>
            </div>
          </div>

          <ul className="mt-6 space-y-px bg-slate-200 dark:bg-slate-700 rounded-2xl overflow-hidden">
            {HIGHLIGHTS.map((h, i) => (
              <li
                key={h.label}
                className="bg-white dark:bg-slate-800 px-5 py-4 flex items-center gap-4"
              >
                <span className="kicker text-slate-400 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h.icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
                <span className="text-sm text-slate-700 dark:text-slate-200">{h.label}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Form card — right */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.215, 0.61, 0.355, 1] }}
          className="lg:col-span-7"
        >
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.18)] border border-slate-200/70 dark:border-slate-700">
            <span className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent" />

            <p className="kicker text-slate-400 mb-1">Formulaire</p>
            <h3 className="font-display text-3xl uppercase tracking-tight text-slate-900 dark:text-white mb-7">
              Planifier la visite
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field icon={Building2} label="Organisation *">
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Société, ONG, institution"
                  className="bg-transparent border-none text-sm text-slate-900 dark:text-white font-medium w-full focus:outline-none placeholder:text-slate-400"
                />
              </Field>
              <Field icon={Users} label="Taille du groupe">
                <input
                  type="number"
                  min={1}
                  value={groupSize}
                  onChange={(e) => setGroupSize(e.target.value)}
                  className="bg-transparent border-none text-sm text-slate-900 dark:text-white font-medium w-full focus:outline-none tabular-nums"
                />
              </Field>
              <Field icon={CalendarRange} label="Période souhaitée">
                <input
                  type="text"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="Ex : juin 2026, 7 jours"
                  className="bg-transparent border-none text-sm text-slate-900 dark:text-white font-medium w-full focus:outline-none placeholder:text-slate-400"
                />
              </Field>
              <Field icon={Target} label="Objectif principal *">
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Sourcing, salon, formation…"
                  className="bg-transparent border-none text-sm text-slate-900 dark:text-white font-medium w-full focus:outline-none placeholder:text-slate-400"
                />
              </Field>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-700">
              <p className="kicker text-slate-400 mb-3">Vos coordonnées</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nom du contact"
                  className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                />
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Email / WhatsApp *"
                  className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="ok"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 dark:border-emerald-700/50 dark:bg-emerald-900/20 p-4"
                >
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
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
                  className="mt-7 flex items-center justify-between gap-2 rounded-xl bg-slate-900 dark:bg-cyan-500 hover:bg-slate-800 dark:hover:bg-cyan-400 px-7 py-4 text-base font-semibold text-white dark:text-slate-950 disabled:opacity-60 w-full sm:w-fit min-w-[260px] group"
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
  <div className="bg-slate-50/70 dark:bg-slate-700/30 rounded-xl flex items-center gap-3 px-4 py-3 border border-slate-100 dark:border-slate-700 focus-within:border-cyan-400 transition-colors">
    <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <label className="kicker text-slate-400 block">{label}</label>
      {children}
    </div>
  </div>
);

export default TwinskDelegations;
