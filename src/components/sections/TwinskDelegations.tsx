'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  CalendarRange,
  Target,
  Loader2,
  CheckCircle,
  ArrowRight,
  Users,
} from 'lucide-react';
import { useState } from 'react';

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
    <motion.article
      id="delegations"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay: 0.05, ease: [0.215, 0.61, 0.355, 1] }}
      className="relative h-full bg-cream rounded-3xl border border-forest/10 overflow-hidden shadow-[0_20px_50px_-25px_rgba(15,23,42,0.18)] p-6 sm:p-8 lg:p-10 flex flex-col"
    >
      <div className="flex items-center gap-3">
        <span className="h-px w-10 bg-forest" />
        <span className="kicker text-forest">
          <span className="tabular-nums opacity-70">06</span>
          <span className="mx-2 opacity-30">/</span>
          Délégations
        </span>
      </div>

      <h2 className="font-display text-3xl sm:text-4xl uppercase tracking-tight text-forest leading-[0.95] mt-5">
        Visitez vos projets <br />
        <span className="text-lime">en Chine</span>
      </h2>
      <p className="text-forest/70 mt-3 text-sm leading-relaxed max-w-md">
        Société, ONG, organisation — programme complet : visa, hébergement, transport,
        visites d’usines, rencontres B2B et interprétariat.
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field icon={Building2} label="Organisation *">
          <input
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="Société, ONG…"
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
        <Field icon={CalendarRange} label="Période">
          <input
            type="text"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="Ex : juin 2026"
            className="bg-transparent border-none text-sm text-forest font-medium w-full focus:outline-none placeholder:text-forest/40"
          />
        </Field>
        <Field icon={Target} label="Objectif *">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Sourcing, salon…"
            className="bg-transparent border-none text-sm text-forest font-medium w-full focus:outline-none placeholder:text-forest/40"
          />
        </Field>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      <div className="mt-auto pt-5">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-2xl border border-lime bg-lime/30 p-4"
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
              className="w-full flex items-center justify-between gap-2 rounded-full bg-forest hover:bg-forest-soft px-5 py-4 text-sm font-semibold text-cream disabled:opacity-60 group"
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
    </motion.article>
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
  <div className="bg-white rounded-xl flex items-center gap-3 px-3 py-2.5 border border-forest/15 focus-within:border-forest transition-colors">
    <div className="w-8 h-8 rounded-lg bg-cream text-forest border border-forest/10 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <label className="kicker text-forest/50 block">{label}</label>
      {children}
    </div>
  </div>
);

export default TwinskDelegations;
