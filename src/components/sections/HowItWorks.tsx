'use client';

import { motion } from 'framer-motion';
import { FileText, Calculator, Package, Truck } from 'lucide-react';

interface Step {
  icon: React.ComponentType<{ className?: string }>;
  number: string;
  title: string;
  desc: string;
  duration: string;
}

const STEPS: Step[] = [
  {
    icon: FileText,
    number: '01',
    title: 'Demande',
    desc: 'Vous décrivez votre projet : produits, quantités, destination. Photos ou liens 1688 acceptés.',
    duration: '~ 5 min',
  },
  {
    icon: Calculator,
    number: '02',
    title: 'Devis',
    desc: 'Notre équipe HK + Canton revient sous 48h avec un devis détaillé : prix, délais, port + douanes.',
    duration: '< 48 h',
  },
  {
    icon: Package,
    number: '03',
    title: 'Production',
    desc: 'Mise en route, inspection qualité, photos de validation avant expédition. Vous suivez sur WhatsApp.',
    duration: '7 – 21 j',
  },
  {
    icon: Truck,
    number: '04',
    title: 'Livraison',
    desc: 'Fret aérien ou maritime, dédouanement, livraison porte-à-porte. Tracking en temps réel.',
    duration: '5 – 35 j',
  },
];

export default function HowItWorks() {
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
              <span className="tabular-nums opacity-60">04</span>
              <span className="mx-2 opacity-30">/</span>
              Comment ça marche
            </span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl uppercase tracking-tight text-slate-900 leading-[0.95]">
            4 étapes <span className="text-lime">simples</span>
            <br />
            jusqu&apos;à votre porte
          </h2>
          <p className="mt-5 max-w-xl text-base text-slate-600 leading-relaxed">
            Du premier contact à la livraison finale, un processus transparent
            avec des délais garantis à chaque étape.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.12, delayChildren: 0.1 },
            },
          }}
          className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div
            aria-hidden
            className="hidden lg:block absolute top-[80px] left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"
          />

          {STEPS.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function StepCard({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon;
  const isLast = index === STEPS.length - 1;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.6, ease: [0.215, 0.61, 0.355, 1] }}
      className="relative group"
    >
      <div className="relative bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 hover:border-slate-900/30 hover:shadow-xl transition-all h-full flex flex-col">
        <div className="relative flex items-center gap-3 mb-6">
          <div className="relative">
            <span className="absolute inset-0 bg-lime rounded-full blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
            <span className="relative inline-flex items-center justify-center w-12 h-12 rounded-full bg-lime text-slate-900 font-display text-lg tabular-nums">
              {step.number}
            </span>
          </div>
          <Icon className="w-5 h-5 text-slate-400 group-hover:text-slate-700 transition-colors" />
        </div>

        <h3 className="font-display text-2xl uppercase tracking-tight text-slate-900 mb-2">
          {step.title}
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed flex-1">{step.desc}</p>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="kicker text-slate-400">Durée</span>
          <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
            {step.duration}
          </span>
        </div>
      </div>

      {!isLast && (
        <div aria-hidden className="lg:hidden flex justify-center my-2">
          <span className="w-px h-6 bg-slate-300" />
        </div>
      )}
    </motion.div>
  );
}
