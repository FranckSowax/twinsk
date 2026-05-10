'use client';

import { motion } from 'framer-motion';
import { Car, ArrowUpRight, ExternalLink, Star, Shield, Truck } from 'lucide-react';
import Image from 'next/image';

const ORIGINS = [
  {
    flag: '🇨🇳',
    country: 'Chine',
    highlight: 'BYD, Geely, Chery, Hongqi…',
    desc: 'Véhicules neufs chinois — électriques, SUV, pick-up.',
  },
  {
    flag: '🇦🇪',
    country: 'Dubaï',
    highlight: 'Toyota, Lexus, Land Cruiser…',
    desc: 'Modèles Gulf Spec, prix imbattables, livraison rapide.',
  },
  {
    flag: '🇰🇷',
    country: 'Corée',
    highlight: 'Hyundai, Kia, Genesis…',
    desc: 'Importations directes des concessions sud-coréennes.',
  },
];

const PERKS = [
  { icon: Shield, label: 'Inspection mécanique avant achat' },
  { icon: Truck, label: 'Logistique maritime sécurisée' },
  { icon: Star, label: 'Service partenaire DriveBy Africa' },
];

const TwinskCarsImport = () => {
  return (
    <section id="cars" className="bg-slate-50 dark:bg-slate-900/40 py-20">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
            <Car className="w-3.5 h-3.5" />
            Import véhicules
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium text-slate-900 dark:text-white leading-[0.95] tracking-tight uppercase mb-4">
            <span className="block">Votre voiture neuve,</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600">
              importée à votre porte
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg font-light max-w-2xl mx-auto">
            Chine, Dubaï, Corée — nous gérons l’achat, l’inspection et l’expédition jusqu’à votre pays
            via notre partenaire <span className="font-semibold text-slate-800 dark:text-slate-200">DriveBy Africa</span>.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          {ORIGINS.map((o) => (
            <motion.div
              key={o.country}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0 },
              }}
              whileHover={{ y: -8 }}
              className="relative bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-shadow border border-slate-200/50 dark:border-slate-700 overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-200/30 to-orange-200/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="text-5xl mb-4">{o.flag}</div>
                <h3 className="font-display text-2xl font-medium text-slate-900 dark:text-white mb-1 uppercase">
                  {o.country}
                </h3>
                <p className="text-amber-600 dark:text-amber-400 text-sm font-semibold mb-3">
                  {o.highlight}
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {o.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-slate-800 shadow-2xl border border-slate-200/50 dark:border-slate-700"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="relative aspect-video lg:aspect-auto lg:min-h-[420px]">
              <Image
                src="/Carte-driveby-.jpg"
                alt="DriveBy Africa — import véhicules"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-900/30" />
            </div>

            <div className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-5 w-fit">
                <ExternalLink className="w-3.5 h-3.5" />
                Site partenaire
              </div>
              <h3 className="font-display text-3xl md:text-4xl font-medium text-slate-900 dark:text-white leading-tight tracking-tight uppercase mb-4">
                DriveBy Africa
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-base font-light leading-relaxed mb-6">
                Notre marketplace dédiée à l’import de véhicules — catalogue complet,
                prix transparents, agents francophones et livraison vers toute l’Afrique.
              </p>

              <ul className="space-y-3 mb-8">
                {PERKS.map((p) => (
                  <li key={p.label} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                      <p.icon className="w-4 h-4 text-white" />
                    </div>
                    {p.label}
                  </li>
                ))}
              </ul>

              <motion.a
                href="https://driveby-africa.com"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-amber-500/25 w-fit"
              >
                Visiter DriveBy Africa
                <ArrowUpRight className="w-5 h-5" />
              </motion.a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TwinskCarsImport;
