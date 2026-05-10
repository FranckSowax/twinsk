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
      className="relative px-3 sm:px-5 lg:px-6 py-16 lg:py-24 bg-white border-t border-forest/5"
    >
      <div className="max-w-[1600px] mx-auto px-2 sm:px-4">
        <SectionHeader
          index="04"
          kicker="Mobilité"
          accent="forest"
          align="center"
          title={
            <>
              <span className="block">Votre voiture neuve,</span>
              <span className="block">importée à votre porte</span>
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
          className="mt-12 lg:mt-16 grid grid-cols-1 md:grid-cols-3 gap-px bg-forest/10 rounded-2xl overflow-hidden border border-forest/10"
        >
          {ORIGINS.map((o, i) => (
            <motion.div
              key={o.country}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              className="relative bg-cream p-7 lg:p-9 group hover:bg-lime-soft/40 transition-colors"
            >
              <div className="flex items-start justify-between mb-7">
                <span className="kicker text-forest/40">
                  <span className="tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="mx-2 opacity-30">/</span>
                  {o.code}
                </span>
                <span className="text-3xl">{o.flag}</span>
              </div>
              <h3 className="font-display text-3xl lg:text-4xl text-forest uppercase tracking-tight mb-3">
                {o.country}
              </h3>
              <p className="text-sm font-mono text-forest/70 mb-3">
                {o.highlight}
              </p>
              <p className="text-[15px] text-forest/60 leading-relaxed">
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
          className="relative mt-8 overflow-hidden rounded-3xl bg-cream border border-forest/10"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="relative aspect-video lg:aspect-auto lg:min-h-[460px]">
              <Image
                src="/Carte-driveby-.jpg"
                alt="DriveBy Africa — import véhicules"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-forest/40" />
              <div className="absolute top-6 left-6 kicker text-cream/90">
                Site partenaire · Externe
              </div>
            </div>

            <div className="p-8 sm:p-10 lg:p-14 flex flex-col justify-center">
              <p className="kicker text-forest/50 mb-3">DriveBy × Twinsk</p>
              <h3 className="font-display text-4xl md:text-5xl text-forest leading-[0.95] tracking-tight uppercase mb-5">
                DriveBy
                <br />
                <span className="text-forest/50">Africa</span>
              </h3>
              <p className="text-forest/70 text-[16px] leading-relaxed mb-8 max-w-md">
                Notre marketplace dédiée à l’import de véhicules. Catalogue complet,
                prix transparents, agents francophones, livraison vers toute l’Afrique.
              </p>

              <ul className="space-y-3 mb-9">
                {PERKS.map((p) => (
                  <li
                    key={p.label}
                    className="flex items-center gap-3 text-sm text-forest/80"
                  >
                    <p.icon className="w-4 h-4 text-forest flex-shrink-0" />
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
                className="inline-flex items-center justify-between gap-2 rounded-full bg-lime hover:bg-lime-soft px-6 py-4 text-base font-semibold text-forest w-full sm:w-fit group"
              >
                <span className="flex items-center gap-2">
                  driveby-africa.com
                  <span className="hidden sm:inline kicker text-forest/40 ml-2">↗</span>
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
