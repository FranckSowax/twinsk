'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { Settings, ChevronRight, Sparkles, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import { useRef } from 'react';

const TwinskServices = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['-5%', '5%']);

  const serviceCards = [
    {
      image: '/Carte-1688-2.jpg',
      alt: '1688 Sourcing',
      buttonText: 'Sourcer sur les ecommerce chinois',
      accent: 'from-rose-500 to-orange-500',
      badge: 'E-commerce'
    },
    {
      image: '/Carte-driveby-.jpg',
      alt: 'DriveBy Auto',
      buttonText: 'Commander votre voiture chinoise',
      accent: 'from-emerald-500 to-teal-500',
      badge: 'Automobile'
    },
    {
      image: '/Carte-sample-.jpg',
      alt: 'Échantillons',
      buttonText: 'Recevez vos échantillons',
      accent: 'from-violet-500 to-purple-500',
      badge: 'Samples'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 60 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.215, 0.61, 0.355, 1] as const
      }
    }
  };

  return (
    <>
      {/* Main Services Section */}
      <section
        ref={sectionRef}
        id="services"
        className="relative py-24 lg:py-32 overflow-hidden"
      >
        {/* Animated Background Pattern */}
        <motion.div
          style={{ y: backgroundY }}
          className="absolute inset-0 pointer-events-none"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
              backgroundSize: '48px 48px'
            }}
          />
          {/* Floating gradient orbs */}
          <div className="absolute top-20 right-20 w-[500px] h-[500px] bg-gradient-to-br from-amber-200/20 to-orange-200/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-20 w-[400px] h-[400px] bg-gradient-to-br from-cyan-200/20 to-blue-200/20 rounded-full blur-3xl" />
        </motion.div>

        <div className="relative max-w-[1600px] mx-auto px-4 md:px-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12"
          >
            {/* Left Text Content - Spans 4 columns */}
            <motion.div
              variants={itemVariants}
              className="lg:col-span-4 flex flex-col justify-center space-y-8"
            >
              {/* Label with animated line */}
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: 48 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="h-px bg-gradient-to-r from-amber-500 to-orange-500"
                />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" />
                  Services & Support
                </span>
              </div>

              {/* Editorial headline with dramatic typography */}
              <h2 className="text-4xl md:text-5xl xl:text-6xl font-display font-medium text-slate-900 leading-[0.92] tracking-tight">
                <span className="block">Livraison</span>
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600">
                  de fret
                </span>
                <span className="block font-light italic text-slate-600">rapide & précise</span>
              </h2>

              {/* Description with refined typography */}
              <p className="text-slate-500 text-lg font-light leading-relaxed max-w-md">
                Nous offrons un support logistique complet de la collecte à la livraison finale avec entreposage sécurisé et suivi en temps réel.
              </p>

              {/* Stats mini row */}
              <div className="flex gap-8 pt-4">
                {[
                  { value: '98%', label: 'Satisfaction' },
                  { value: '24h', label: 'Réponse' }
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                  >
                    <div className="text-2xl font-display font-medium text-slate-900">{stat.value}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Twinsk Logistics Card - Spans 4 columns */}
            <motion.div
              variants={itemVariants}
              className="lg:col-span-4"
            >
              <motion.div
                whileHover={{ y: -12, scale: 1.02 }}
                transition={{ duration: 0.4, ease: [0.215, 0.61, 0.355, 1] }}
                className="relative group rounded-[2rem] overflow-hidden h-[520px] shadow-xl shadow-slate-900/5"
              >
                <Image
                  src="/Carte-Twinslk-logistic-.jpg"
                  alt="Twinsk Logistics"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />

                {/* Floating badge */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 }}
                  className="absolute top-6 left-6 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Logistique
                  </span>
                </motion.div>

                {/* Bottom content */}
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <h3 className="text-white text-2xl font-display font-medium mb-4">
                    Twinsk Logistics
                  </h3>
                  <motion.a
                    href="#booking"
                    whileHover={{ scale: 1.05, x: 5 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-7 py-3.5 rounded-full text-sm font-semibold shadow-lg shadow-amber-500/25 transition-all"
                  >
                    Booker votre transport
                    <ChevronRight className="w-4 h-4" />
                  </motion.a>
                </div>
              </motion.div>
            </motion.div>

            {/* By Project Card - Spans 4 columns */}
            <motion.div
              variants={itemVariants}
              className="lg:col-span-4"
            >
              <motion.div
                whileHover={{ y: -12, scale: 1.02 }}
                transition={{ duration: 0.4, ease: [0.215, 0.61, 0.355, 1] }}
                className="relative group rounded-[2rem] overflow-hidden h-[520px] shadow-xl shadow-slate-900/5"
              >
                <Image
                  src="/Carte-By-project-.jpg"
                  alt="By Project"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />

                {/* Floating badge */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 }}
                  className="absolute top-6 left-6 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-cyan-500" />
                    Sourcing
                  </span>
                </motion.div>

                {/* Bottom content */}
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <h3 className="text-white text-2xl font-display font-medium mb-4">
                    By Project
                  </h3>
                  <motion.a
                    href="https://byproject-twinsk.netlify.app/quote-request"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.05, x: 5 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-7 py-3.5 rounded-full text-sm font-semibold shadow-lg shadow-cyan-500/25 transition-all"
                  >
                    Sourcer votre projet
                    <ArrowUpRight className="w-4 h-4" />
                  </motion.a>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Additional Services Section - 3 Column Cards */}
      <section className="relative py-16 lg:py-24 bg-slate-50 overflow-hidden">
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.828-1.415 1.415L51.8 0h2.827zM5.373 0l-.83.828L5.96 2.243 8.2 0H5.374zM48.97 0l3.657 3.657-1.414 1.414L46.143 0h2.828zM11.03 0L7.372 3.657 8.787 5.07 13.857 0H11.03zm32.284 0L49.8 6.485 48.384 7.9l-7.9-7.9h2.83zM16.686 0L10.2 6.485 11.616 7.9l7.9-7.9h-2.83zM22.344 0L13.858 8.485 15.272 9.9l9.9-9.9h-2.828zM32 0l-3.486 3.485h2.828L34.828.515 34.414 0H32zm6.686 0l3.486 3.485h-2.828L36.858.515 37.272 0h1.414z' fill='%23000' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`
          }}
        />

        <div className="relative max-w-[1600px] mx-auto px-4 md:px-8">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-4">
              <span className="w-8 h-px bg-slate-300" />
              Autres Services
              <span className="w-8 h-px bg-slate-300" />
            </span>
            <h3 className="text-3xl md:text-4xl font-display font-medium text-slate-900">
              Explorez nos <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-500">solutions</span>
            </h3>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {serviceCards.map((card, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
              >
                <motion.div
                  whileHover={{ y: -12 }}
                  transition={{ duration: 0.4, ease: [0.215, 0.61, 0.355, 1] }}
                  className="relative group rounded-[2rem] overflow-hidden h-[480px] bg-white shadow-xl shadow-slate-900/5"
                >
                  <Image
                    src={card.image}
                    alt={card.alt}
                    fill
                    className="object-cover transition-all duration-700 group-hover:scale-110"
                  />

                  {/* Multi-layer gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />

                  {/* Badge */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className={`absolute top-6 left-6 px-4 py-1.5 rounded-full bg-gradient-to-r ${card.accent}`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-white">
                      {card.badge}
                    </span>
                  </motion.div>

                  {/* Bottom content */}
                  <div className="absolute bottom-0 left-0 right-0 p-8">
                    <h4 className="text-white text-xl font-display font-medium mb-5 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                      {card.alt}
                    </h4>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full bg-white/95 backdrop-blur-sm hover:bg-white text-slate-900 px-6 py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg transition-all group/btn"
                    >
                      {card.buttonText}
                      <ChevronRight className="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform" />
                    </motion.button>
                  </div>

                  {/* Decorative corner */}
                  <div className="absolute top-0 right-0 w-32 h-32 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className={`absolute top-4 right-4 w-16 h-16 rounded-full bg-gradient-to-br ${card.accent} blur-2xl`} />
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
};

export default TwinskServices;
