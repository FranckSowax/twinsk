'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, ShieldCheck, Wrench, Anchor } from 'lucide-react';
import Image from 'next/image';
import SectionHeader from './SectionHeader';

const ORIGINS = [
  {
    code: 'CN',
    flag: '🇨🇳',
    country: 'Chine',
    highlight: 'BYD · Geely · Chery · Hongqi',
    desc: 'Véhicules neufs — électriques, SUV, pick-up.',
  },
  {
    code: 'AE',
    flag: '🇦🇪',
    country: 'Dubaï',
    highlight: 'Toyota · Lexus · Land Cruiser',
    desc: 'Modèles Gulf Spec, livraison rapide.',
  },
  {
    code: 'KR',
    flag: '🇰🇷',
    country: 'Corée',
    highlight: 'Hyundai · Kia · Genesis',
    desc: 'Importation directe concessions.',
  },
];

const PERKS = [
  { icon: ShieldCheck, label: 'Inspection mécanique avant achat' },
  { icon: Anchor, label: 'Logistique maritime sécurisée' },
  { icon: Wrench, label: 'Préparation & dédouanement' },
];

const TwinskCarsImport = () => {
  return (
    <section
      id="cars"
      className="relative bg-slate-50 dark:bg-slate-900/30 py-24 lg:py-32"
    >
      <div className="absolute inset-x-0 top-0 section-divider" />

      <div className="max-w-[1600px] mx-auto px-4 md:px-8">
        <SectionHeader
          index="04"
          kicker="Mobilité"
          accent="red"
          align="center"
          title={
            <>
              <span className="block">Votre voiture neuve,</span>
              <span className="block text-red-600">importée à votre porte</span>
            </>
          }
          lead="Achat, inspection, expédition. En partenariat avec DriveBy Africa, marketplace dédiée à l’import de véhicules vers l’Afrique."
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
          }}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-200 dark:bg-slate-700 rounded-2xl overflow-hidden"
        >
          {ORIGINS.map((o, i) => (
            <motion.div
              key={o.country}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              className="relative bg-white dark:bg-slate-800 p-7 lg:p-9 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-7">
                <span className="kicker text-slate-400">
                  <span className="tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="mx-2 opacity-30">/</span>
                  {o.code}
                </span>
                <span className="text-3xl">{o.flag}</span>
              </div>
              <h3 className="font-display text-3xl lg:text-4xl text-slate-900 dark:text-white uppercase tracking-tight mb-3">
                {o.country}
              </h3>
              <p className="text-sm font-mono text-red-600 dark:text-red-400 mb-3">
                {o.highlight}
              </p>
              <p className="text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {o.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.215, 0.61, 0.355, 1] }}
          className="relative mt-12 overflow-hidden rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700"
        >
          <span className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="relative aspect-video lg:aspect-auto lg:min-h-[460px]">
              <Image
                src="/Carte-driveby-.jpg"
                alt="DriveBy Africa — import véhicules"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-900/30" />
              <div className="absolute top-6 left-6 kicker text-white/80">
                Site partenaire · Externe
              </div>
            </div>

            <div className="p-8 sm:p-10 lg:p-14 flex flex-col justify-center">
              <p className="kicker text-red-600 mb-3">DriveBy × Twinsk</p>
              <h3 className="font-display text-4xl md:text-5xl text-slate-900 dark:text-white leading-[0.95] tracking-tight uppercase mb-5">
                DriveBy
                <br />
                <span className="text-red-600">Africa</span>
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-[16px] leading-relaxed mb-8 max-w-md">
                Notre marketplace dédiée à l’import de véhicules. Catalogue complet,
                prix transparents, agents francophones, livraison vers toute l’Afrique.
              </p>

              <ul className="space-y-3 mb-9">
                {PERKS.map((p) => (
                  <li
                    key={p.label}
                    className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300"
                  >
                    <p.icon className="w-4 h-4 text-red-600 flex-shrink-0" />
                    {p.label}
                  </li>
                ))}
              </ul>

              <motion.a
                href="https://driveby-africa.com"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="inline-flex items-center justify-between gap-2 rounded-xl bg-slate-900 dark:bg-red-600 hover:bg-slate-800 dark:hover:bg-red-700 px-6 py-4 text-base font-semibold text-white w-full sm:w-fit group"
              >
                <span className="flex items-center gap-2">
                  driveby-africa.com
                  <span className="hidden sm:inline kicker text-slate-400 dark:text-red-200/70 ml-2">↗</span>
                </span>
                <ArrowUpRight className="w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </motion.a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TwinskCarsImport;
