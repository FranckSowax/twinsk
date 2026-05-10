'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Building2,
  CalendarRange,
  Target,
  Loader2,
  CheckCircle,
  ArrowRight,
  Plane,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

const HIGHLIGHTS = [
  { icon: Plane, label: 'Accueil aéroport HK / Shenzhen / Guangzhou' },
  { icon: MapPin, label: 'Visites usines & marchés (Yiwu, Canton, Shenzhen)' },
  { icon: Sparkles, label: 'Interprète & accompagnement bilingue' },
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
    <section id="delegations" className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-20">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="lg:col-span-2"
        >
          <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
            <Users className="w-3.5 h-3.5" />
            Réception délégations
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium text-slate-900 dark:text-white leading-[0.95] tracking-tight uppercase mb-6">
            <span className="block">Visitez</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600">
              vos projets
            </span>
            <span className="block">en Chine</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg font-light leading-relaxed mb-8">
            Société, organisation ou délégation officielle — nous organisons votre venue
            en Chine de bout en bout : visa, hébergement, transport, visites d’usines,
            rencontres B2B et interprétariat.
          </p>

          <div className="relative h-56 rounded-3xl overflow-hidden mb-6">
            <Image
              src="/Carte-Twinslk-logistic-.jpg"
              alt="Réception délégations en Chine"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <p className="text-xs uppercase tracking-wider opacity-80">Sur place</p>
              <p className="font-display text-xl font-medium">Hong Kong • Canton • Yiwu</p>
            </div>
          </div>

          <ul className="space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li
                key={h.label}
                className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <h.icon className="w-4 h-4 text-white" />
                </div>
                {h.label}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="lg:col-span-3"
        >
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 sm:p-8 lg:p-10 shadow-2xl shadow-slate-900/5 border border-slate-200/50 dark:border-slate-700">
            <h3 className="font-display text-2xl font-medium text-slate-900 dark:text-white mb-2">
              Planifier la visite
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Donnez-nous quelques détails — un agent vous prépare un programme personnalisé.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field icon={Building2} label="Organisation *">
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Nom de la société / ONG / institution"
                  className="bg-transparent border-none text-sm text-slate-900 dark:text-white font-medium w-full focus:outline-none placeholder:text-slate-400"
                />
              </Field>
              <Field icon={Users} label="Taille du groupe">
                <input
                  type="number"
                  min={1}
                  value={groupSize}
                  onChange={(e) => setGroupSize(e.target.value)}
                  className="bg-transparent border-none text-sm text-slate-900 dark:text-white font-medium w-full focus:outline-none"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du contact"
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email / WhatsApp *"
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="ok"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 p-4"
                >
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Demande reçue — un agent prépare votre programme.
                  </p>
                </motion.div>
              ) : (
                <motion.button
                  key="cta"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className="mt-6 w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Envoi…
                    </>
                  ) : (
                    <>
                      Organiser ma visite <ArrowRight className="w-4 h-4" />
                    </>
                  )}
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
  <div className="bg-slate-50 dark:bg-slate-700/40 rounded-2xl flex items-center px-4 py-3 focus-within:ring-2 focus-within:ring-amber-500/40 transition-all">
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mr-3 flex-shrink-0">
      <Icon className="w-4 h-4 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <label className="text-[10px] text-slate-400 uppercase tracking-wider block">{label}</label>
      {children}
    </div>
  </div>
);

export default TwinskDelegations;
