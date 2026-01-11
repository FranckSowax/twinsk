'use client';

import { motion } from 'framer-motion';
import { Settings, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { fadeInUp, staggerContainer } from '../../lib/animations';

const TwinskServices = () => {
  return (
    <section id="services" className="max-w-[1600px] mx-auto px-4 md:px-8 py-16">
      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Left Text */}
        <motion.div
          variants={fadeInUp}
          className="flex flex-col justify-center space-y-6 lg:pr-10"
        >
          <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold uppercase tracking-wide">
            <Settings className="w-4 h-4" />
            Services & Support
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-medium text-slate-900 uppercase leading-[0.95] tracking-tight">
            Livraison de fret <br /> rapide et précise <br /> pour tous
          </h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 w-fit px-8 py-4 rounded-full text-base font-semibold transition flex items-center gap-2 mt-4 shadow-lg"
          >
            Explorer nos services <ChevronRight className="w-4 h-4" />
          </motion.button>
          <p className="text-slate-600 text-lg font-light leading-relaxed mt-4">
            Nous offrons un support logistique complet de la collecte à la livraison finale avec entreposage sécurisé et suivi en temps réel.
          </p>
        </motion.div>

        {/* Air Freight Card */}
        <motion.div
          variants={fadeInUp}
          whileHover={{ y: -10 }}
          transition={{ duration: 0.3 }}
          className="relative group rounded-[2rem] overflow-hidden h-[500px]"
        >
          <Image
            src="/booking.jpg"
            alt="Fret Aérien"
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/40"></div>
          <div className="absolute top-8 left-0 right-0 text-center">
            <motion.h3
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="text-white text-3xl font-display font-medium uppercase tracking-tight"
            >
              Fret Aérien Charter
            </motion.h3>
          </div>
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white text-slate-900 px-6 py-3 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg"
            >
              Réserver une expédition <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>

        {/* Ocean Freight Card */}
        <motion.div
          variants={fadeInUp}
          whileHover={{ y: -10 }}
          transition={{ duration: 0.3 }}
          className="relative group rounded-[2rem] overflow-hidden h-[500px]"
        >
          <Image
            src="/warehouse.jpg"
            alt="Fret Maritime"
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/40"></div>
          <div className="absolute top-8 left-0 right-0 text-center">
            <motion.h3
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="text-white text-3xl font-display font-medium uppercase tracking-tight"
            >
              Fret Maritime Continental
            </motion.h3>
          </div>
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white text-slate-900 px-6 py-3 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg"
            >
              Réserver une expédition <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default TwinskServices;
