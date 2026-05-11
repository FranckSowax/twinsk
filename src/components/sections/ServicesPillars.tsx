'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight,
  Boxes,
  Building2,
  Car,
  Coffee,
  Compass,
  FileCheck,
  Package,
  Plane,
  ShieldCheck,
  Ship,
  ShoppingBag,
  Truck,
  Users,
  Wrench,
  Youtube,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface SubService {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface Pillar {
  id: string;
  number: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tagline: string;
  description: string;
  subServices: SubService[];
  ctaLabel: string;
  ctaHref: string;
  stat: { value: string; label: string };
  manifesto: string;
}

const PILLARS: Pillar[] = [
  {
    id: 'shipping',
    number: '01',
    icon: Ship,
    title: 'Shipping',
    tagline: 'Fret international tout inclus',
    description:
      "Du chargement en Chine à la livraison à votre porte. Air, mer, dédouanement et tracking temps réel — un seul interlocuteur.",
    subServices: [
      { icon: Plane, label: 'Fret aérien express (5–10j)' },
      { icon: Ship, label: 'Fret maritime FCL & LCL (28–38j)' },
      { icon: FileCheck, label: 'Dédouanement Afrique & Europe' },
      { icon: Truck, label: 'Livraison porte-à-porte' },
    ],
    ctaLabel: 'Demander une cotation',
    ctaHref: '/freight',
    stat: { value: '+150K', label: 'conteneurs gérés depuis 2018' },
    manifesto: 'Délais garantis, suivi WhatsApp, zéro mauvaise surprise.',
  },
  {
    id: 'sourcing',
    number: '02',
    icon: Package,
    title: 'Sourcing',
    tagline: 'Trouvez le bon produit, au bon prix',
    description:
      "Notre équipe Canton négocie et qualifie vos fournisseurs sur 1688, Alibaba et marchés gros. Échantillons validés avant toute commande.",
    subServices: [
      { icon: ShoppingBag, label: 'Sourcing 1688 & Alibaba' },
      { icon: Boxes, label: 'Échantillonnage produits' },
      { icon: Youtube, label: 'Shop YouTube — produits validés' },
      { icon: ShieldCheck, label: 'Inspection qualité usine' },
    ],
    ctaLabel: 'Soumettre un brief',
    ctaHref: '#sourcing',
    stat: { value: '< 48h', label: 'devis détaillé après brief' },
    manifesto: 'Pas de produit envoyé sans validation. Pas de marge cachée.',
  },
  {
    id: 'driveby',
    number: '03',
    icon: Car,
    title: 'Partenariat DriveBy',
    tagline: "Import auto — la confiance d'un partenaire",
    description:
      "Avec DriveBy Africa, vous importez véhicules neufs et occasions depuis la Chine. Inspection mécanique avant achat, dossiers complets, livraison sécurisée.",
    subServices: [
      { icon: Car, label: 'Véhicules neufs & occasions' },
      { icon: Wrench, label: 'Inspection mécanique pré-achat' },
      { icon: FileCheck, label: 'Dossier RC et carte grise' },
      { icon: ShieldCheck, label: 'Livraison sécurisée porte-à-porte' },
    ],
    ctaLabel: 'Découvrir DriveBy',
    ctaHref: '#mobilite',
    stat: { value: '500+', label: 'véhicules importés' },
    manifesto: 'Un partenaire spécialiste auto, pas un fret généraliste.',
  },
  {
    id: 'accompagnement',
    number: '04',
    icon: Users,
    title: 'Accompagnement',
    tagline: 'Délégations & visites Chine',
    description:
      "Vous venez en Chine ? Nous orchestrons votre mission : accueil aéroport, visites d'usines, traduction, transport et hébergement. Programme sur mesure.",
    subServices: [
      { icon: Compass, label: 'Délégations Yiwu, Canton, Shenzhen' },
      { icon: Building2, label: "Visites d'usines qualifiées" },
      { icon: Users, label: 'Interprète français-mandarin' },
      { icon: Coffee, label: 'Accueil & hébergement HK' },
    ],
    ctaLabel: 'Organiser une visite',
    ctaHref: '#delegations',
    stat: { value: '100+', label: 'délégations orchestrées' },
    manifesto: "Bureau HK + équipe Canton — vos mains et vos yeux sur place.",
  },
];

export default function ServicesPillars() {
  const [active, setActive] = useState(0);
  const pillar = PILLARS[active];
  const Icon = pillar.icon;

  return (
    <section
      id="services"
      className="relative px-5 sm:px-8 lg:px-10 py-20 lg:py-28 bg-slate-50 border-t border-slate-200"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-10 lg:mb-12"
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="h-px w-10 bg-lime" />
            <span className="kicker text-slate-700">
              <span className="tabular-nums opacity-60">02</span>
              <span className="mx-2 opacity-30">/</span>
              Nos métiers
            </span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl uppercase tracking-tight text-slate-900 leading-[0.95]">
            4 piliers, <span className="text-lime">une équipe</span>
            <br />
            une seule promesse
          </h2>
          <p className="mt-5 max-w-xl text-base text-slate-600 leading-relaxed">
            Tout passe par Twinsk Company à Hong Kong. Choisissez votre besoin —
            on s&apos;occupe du reste.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 lg:mb-10">
          {PILLARS.map((p, i) => {
            const isActive = i === active;
            const Ic = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => setActive(i)}
                className={`group inline-flex items-center gap-3 px-5 py-3.5 rounded-full text-sm sm:text-base font-semibold border transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-display tabular-nums transition-colors ${
                    isActive
                      ? 'bg-lime text-slate-900'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  }`}
                >
                  {p.number}
                </span>
                <Ic
                  className={`w-4 h-4 ${
                    isActive ? 'text-lime' : 'text-slate-500'
                  }`}
                />
                <span>{p.title}</span>
              </button>
            );
          })}
        </div>

        {/* Content panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={pillar.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.215, 0.61, 0.355, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8"
          >
            {/* Left: content */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-8 lg:p-10">
              <div className="flex items-start justify-between gap-6 mb-6">
                <div>
                  <p className="kicker text-lime mb-2">Pilier {pillar.number}</p>
                  <h3 className="font-display text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tight text-slate-900 leading-[0.95]">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-base text-slate-500">
                    {pillar.tagline}
                  </p>
                </div>
                <div className="hidden sm:flex flex-shrink-0 items-center justify-center w-14 h-14 rounded-2xl bg-lime/20 border border-lime/40">
                  <Icon className="w-6 h-6 text-slate-900" />
                </div>
              </div>

              <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
                {pillar.description}
              </p>

              <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pillar.subServices.map((s, i) => {
                  const Si = s.icon;
                  return (
                    <motion.li
                      key={s.label}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60 hover:border-slate-300 hover:bg-white transition-colors"
                    >
                      <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                        <Si className="w-4 h-4 text-slate-700" />
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        {s.label}
                      </span>
                    </motion.li>
                  );
                })}
              </ul>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href={pillar.ctaHref}
                  className="group inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-full text-sm font-semibold transition-colors"
                >
                  {pillar.ctaLabel}
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
                <a
                  href="#contact"
                  className="text-sm font-semibold text-slate-700 hover:text-slate-900 underline-offset-4 hover:underline"
                >
                  Parler à un expert →
                </a>
              </div>
            </div>

            {/* Right: stat + manifesto */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-8 lg:p-10 text-white">
                <div
                  aria-hidden
                  className="absolute -top-24 -right-10 w-[320px] h-[320px] bg-lime/15 rounded-full blur-3xl pointer-events-none"
                />
                <p className="kicker text-lime mb-3">Notre track record</p>
                <p className="font-display text-6xl lg:text-7xl text-white tabular-nums leading-none">
                  {pillar.stat.value}
                </p>
                <p className="mt-3 text-slate-300">{pillar.stat.label}</p>
                <div className="relative mt-8 pt-6 border-t border-white/10 grid grid-cols-3 gap-3 text-left">
                  <div>
                    <p className="font-display text-2xl text-white tabular-nums">
                      98%
                    </p>
                    <p className="kicker text-slate-400 mt-1">À l&apos;heure</p>
                  </div>
                  <div>
                    <p className="font-display text-2xl text-white tabular-nums">
                      48h
                    </p>
                    <p className="kicker text-slate-400 mt-1">Devis</p>
                  </div>
                  <div>
                    <p className="font-display text-2xl text-white tabular-nums">
                      4.9
                    </p>
                    <p className="kicker text-slate-400 mt-1">Note /5</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-lime rounded-3xl p-8 lg:p-10 flex flex-col justify-between min-h-[200px]">
                <div>
                  <p className="kicker text-slate-900/60 mb-3">
                    Pourquoi Twinsk ?
                  </p>
                  <p className="font-display text-2xl lg:text-3xl uppercase tracking-tight text-slate-900 leading-tight">
                    {pillar.manifesto}
                  </p>
                </div>
                <p className="text-sm text-slate-800/80 mt-6">
                  Bureau HK · Équipe Canton · Agents francophones.
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
