'use client';

import { motion } from 'framer-motion';
import {
  Ship,
  Youtube,
  Package,
  Beaker,
  Car,
  Users,
  ArrowUpRight,
  Plane,
} from 'lucide-react';
import Link from 'next/link';

interface ServiceCard {
  icon: React.ComponentType<{ className?: string }>;
  kicker: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
  variant: 'dark' | 'light' | 'lime';
  span: string;
}

const SERVICES: ServiceCard[] = [
  {
    icon: Ship,
    kicker: '01 / Fret',
    title: 'Aérien & Maritime',
    desc: "Cotation 48h. LCL · FCL 20' · FCL 40' · Express aérien depuis Hong Kong vers 25+ destinations.",
    href: '/freight',
    cta: 'Démarrer une cotation',
    variant: 'dark',
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    icon: Youtube,
    kicker: '02 / Studio',
    title: 'YouTube Shop',
    desc: 'Achetez directement les produits présentés dans nos vidéos. Catalogue mis à jour à chaque épisode.',
    href: '#youtube-shop',
    cta: 'Voir le catalogue vidéo',
    variant: 'lime',
    span: 'md:col-span-2',
  },
  {
    icon: Package,
    kicker: '03 / Sourcing',
    title: 'Sourcing Chine',
    desc: '1688, Alibaba, Taobao — nos agents vérifient et négocient avec les fournisseurs en votre nom.',
    href: '#sampling',
    cta: 'Lancer un projet',
    variant: 'light',
    span: 'md:col-span-2',
  },
  {
    icon: Beaker,
    kicker: '04 / Échantillon',
    title: 'Test produit',
    desc: 'Recevez un échantillon avant la commande. Inspection qualité incluse.',
    href: '#sampling',
    cta: 'Demander un échantillon',
    variant: 'light',
    span: 'md:col-span-1',
  },
  {
    icon: Car,
    kicker: '05 / Mobilité',
    title: 'Import véhicules',
    desc: 'En partenariat avec DriveBy Africa. Catalogue Chine · Dubaï · Corée.',
    href: '#cars',
    cta: 'Voir DriveBy Africa',
    variant: 'light',
    span: 'md:col-span-1',
  },
  {
    icon: Users,
    kicker: '06 / Délégations',
    title: 'Visite en Chine',
    desc: "Programme complet pour société, ONG ou délégation : visa, hébergement, visites d'usines, interprète.",
    href: '#delegations',
    cta: 'Organiser une visite',
    variant: 'light',
    span: 'md:col-span-2',
  },
];

export default function ServicesBento() {
  return (
    <section
      id="services"
      className="relative px-5 sm:px-8 lg:px-10 py-20 lg:py-28 bg-white border-t border-slate-200"
    >
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 lg:mb-16"
        >
          <div>
            <div className="flex items-center gap-3 mb-5">
              <span className="h-px w-10 bg-lime" />
              <span className="kicker text-slate-700">
                <span className="tabular-nums opacity-60">06</span>
                <span className="mx-2 opacity-30">/</span>
                Nos services
              </span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl uppercase tracking-tight text-slate-900 leading-[0.95] max-w-3xl">
              Une <span className="text-lime">solution complète</span>
              <br />
              pour la Chine
            </h2>
          </div>
          <p className="max-w-md text-base text-slate-600 leading-relaxed">
            De la cotation initiale jusqu&apos;à la livraison finale. Choisissez le
            service qui correspond à votre projet — nous gérons le reste.
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
              transition: { staggerChildren: 0.08, delayChildren: 0.1 },
            },
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[minmax(220px,auto)]"
        >
          {SERVICES.map((service) => (
            <ServiceCard key={service.kicker} service={service} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

const VARIANT_STYLES: Record<
  ServiceCard['variant'],
  {
    bg: string;
    text: string;
    textSub: string;
    border: string;
    kicker: string;
    icon: string;
    ctaBg: string;
    decoration: string;
  }
> = {
  dark: {
    bg: 'bg-slate-900',
    text: 'text-white',
    textSub: 'text-slate-300',
    border: 'border-slate-800 hover:border-lime/50',
    kicker: 'text-lime',
    icon: 'bg-lime text-slate-900',
    ctaBg: 'bg-lime text-slate-900 hover:bg-lime-soft',
    decoration:
      'bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.18),transparent_60%)]',
  },
  lime: {
    bg: 'bg-lime',
    text: 'text-slate-900',
    textSub: 'text-slate-700',
    border: 'border-lime/0 hover:border-slate-900/20',
    kicker: 'text-slate-900/70',
    icon: 'bg-slate-900 text-lime',
    ctaBg: 'bg-slate-900 text-white hover:bg-slate-800',
    decoration: '',
  },
  light: {
    bg: 'bg-white',
    text: 'text-slate-900',
    textSub: 'text-slate-600',
    border: 'border-slate-200 hover:border-slate-900/30 hover:bg-slate-50',
    kicker: 'text-slate-400',
    icon: 'bg-slate-100 text-slate-900',
    ctaBg: 'text-slate-900 hover:text-slate-700',
    decoration: '',
  },
};

function ServiceCard({ service }: { service: ServiceCard }) {
  const styles = VARIANT_STYLES[service.variant];
  const Icon = service.icon;
  const isLight = service.variant === 'light';

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ ease: [0.215, 0.61, 0.355, 1] }}
      whileHover={{ y: -4 }}
      className={`group relative overflow-hidden rounded-3xl border ${styles.bg} ${styles.border} ${service.span} transition-all`}
    >
      {styles.decoration && (
        <div aria-hidden className={`absolute inset-0 ${styles.decoration}`} />
      )}

      {service.variant === 'dark' && (
        <div
          aria-hidden
          className="absolute -top-8 -right-8 w-48 h-48 opacity-10 group-hover:opacity-20 transition-opacity"
        >
          <Plane className="w-full h-full text-lime rotate-12" strokeWidth={1} />
        </div>
      )}

      <Link
        href={service.href}
        className="relative h-full flex flex-col p-6 sm:p-7 lg:p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${styles.icon}`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <span
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full border border-current ${styles.text} opacity-30 group-hover:opacity-100 transition-opacity`}
          >
            <ArrowUpRight className="w-4 h-4" />
          </span>
        </div>

        <p className={`kicker mb-3 ${styles.kicker}`}>{service.kicker}</p>

        <h3
          className={`font-display uppercase tracking-tight ${styles.text} ${
            service.variant === 'dark'
              ? 'text-3xl sm:text-4xl lg:text-5xl leading-[0.95]'
              : 'text-2xl lg:text-3xl leading-tight'
          }`}
        >
          {service.title}
        </h3>

        <p
          className={`mt-3 text-sm leading-relaxed ${styles.textSub} ${
            service.variant === 'dark' ? 'max-w-md' : ''
          }`}
        >
          {service.desc}
        </p>

        <div className="mt-auto pt-5 flex items-center gap-2">
          {isLight ? (
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-semibold ${styles.ctaBg} transition-colors`}
            >
              {service.cta}
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold ${styles.ctaBg} transition-colors`}
            >
              {service.cta}
              <ArrowUpRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
