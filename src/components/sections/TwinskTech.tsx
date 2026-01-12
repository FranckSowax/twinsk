'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Cpu, ChevronRight, ListChecks } from 'lucide-react';
import Image from 'next/image';
import { fadeInUp, slideInFromLeft, slideInFromRight } from '../../lib/animations';

const TwinskTech = () => {
  return (
    <>
      {/* Section 1 - Original: Image Left, Content Right */}
      <section className="bg-white py-20 overflow-hidden">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Image Composition */}
            <motion.div
              variants={slideInFromLeft}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="relative"
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="relative z-10 rounded-[2rem] overflow-hidden"
              >
                <div className="relative h-[500px] w-full">
                  <Image
                    src="/replicate-prediction-78d0daq38srmr0cvntt8nwgxbr.jpg"
                    alt="By Project - Sourcing Platform"
                    fill
                    className="object-cover rounded-[2rem]"
                  />
                </div>
              </motion.div>

              {/* Floating Overlay Card */}
              <motion.div
                initial={{ opacity: 0, x: 50, scale: 0.8 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, type: 'spring' }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="hidden lg:block absolute -right-16 top-1/2 -translate-y-1/2 z-20 bg-cyan-100/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl w-64"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-semibold text-slate-700">En collaboration avec</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-700" />
                </div>
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className="bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                >
                  <Cpu className="text-cyan-400 w-6 h-6" />
                </motion.div>
                <h4 className="font-display font-medium text-slate-900 text-xl uppercase leading-none">
                  Technologie conçue <br /> avec vision claire
                </h4>
              </motion.div>
            </motion.div>

            {/* Right Content */}
            <motion.div
              variants={slideInFromRight}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="lg:pl-12"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-5xl md:text-6xl font-display font-medium uppercase tracking-tight leading-[0.9] mb-8 text-slate-900"
              >
                Organiser vos Projets, <br /> Comparer et sourcer <br /> en ligne vos besoins
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                transition={{ delay: 0.2 }}
                className="text-slate-600 text-lg font-light mb-10 max-w-lg leading-relaxed"
              >
                By Project vous permet de lister les matériaux nécessaires à votre projet, demander une cotation en ligne auprès de notre réseau de fournisseurs chinois, recevoir et comparer les offres, puis commander directement ou venir sur place finaliser votre projet.
              </motion.p>
              <motion.div
                variants={fadeInUp}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-4"
              >
                <motion.a
                  href="https://byproject-twinsk.netlify.app/quote-request"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-full text-base font-semibold transition flex items-center gap-2 shadow-lg"
                >
                  Commencer un Projet <ChevronRight className="w-4 h-4" />
                </motion.a>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="border border-slate-300 hover:bg-slate-100 text-slate-900 px-8 py-4 rounded-full text-base font-semibold transition flex items-center gap-2"
                >
                  <ListChecks className="w-5 h-5" />
                  Voir nos Forfaits
                </motion.button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 2 - Inversée: Content Left, Image Right */}
      <section className="bg-slate-50 py-20 overflow-hidden">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <motion.div
              variants={slideInFromLeft}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="lg:pr-12 order-2 lg:order-1"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-5xl md:text-6xl font-display font-medium uppercase tracking-tight leading-[0.9] mb-8 text-slate-900"
              >
                Organiser vos Projets, <br /> Comparer et sourcer <br /> en ligne vos besoins
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                transition={{ delay: 0.2 }}
                className="text-slate-600 text-lg font-light mb-10 max-w-lg leading-relaxed"
              >
                By Project vous permet de lister les matériaux nécessaires à votre projet, demander une cotation en ligne auprès de notre réseau de fournisseurs chinois, recevoir et comparer les offres, puis commander directement ou venir sur place finaliser votre projet.
              </motion.p>
              <motion.div
                variants={fadeInUp}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-4"
              >
                <motion.a
                  href="https://byproject-twinsk.netlify.app/quote-request"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-full text-base font-semibold transition flex items-center gap-2 shadow-lg"
                >
                  Commencer un Projet <ChevronRight className="w-4 h-4" />
                </motion.a>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="border border-slate-300 hover:bg-slate-100 text-slate-900 px-8 py-4 rounded-full text-base font-semibold transition flex items-center gap-2"
                >
                  <ListChecks className="w-5 h-5" />
                  Voir nos Forfaits
                </motion.button>
              </motion.div>
            </motion.div>

            {/* Right Image Composition */}
            <motion.div
              variants={slideInFromRight}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="relative order-1 lg:order-2"
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="relative z-10 rounded-[2rem] overflow-hidden"
              >
                <div className="relative h-[500px] w-full">
                  <Image
                    src="/replicate-prediction-78d0daq38srmr0cvntt8nwgxbr.jpg"
                    alt="By Project - Sourcing Platform"
                    fill
                    className="object-cover rounded-[2rem]"
                  />
                </div>
              </motion.div>

              {/* Floating Overlay Card */}
              <motion.div
                initial={{ opacity: 0, x: -50, scale: 0.8 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, type: 'spring' }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="hidden lg:block absolute -left-16 top-1/2 -translate-y-1/2 z-20 bg-cyan-100/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl w-64"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-semibold text-slate-700">En collaboration avec</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-700" />
                </div>
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className="bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                >
                  <Cpu className="text-cyan-400 w-6 h-6" />
                </motion.div>
                <h4 className="font-display font-medium text-slate-900 text-xl uppercase leading-none">
                  Technologie conçue <br /> avec vision claire
                </h4>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 3 - Original: Image Left, Content Right */}
      <section className="bg-white py-20 overflow-hidden">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Image Composition */}
            <motion.div
              variants={slideInFromLeft}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="relative"
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="relative z-10 rounded-[2rem] overflow-hidden"
              >
                <div className="relative h-[500px] w-full">
                  <Image
                    src="/replicate-prediction-78d0daq38srmr0cvntt8nwgxbr.jpg"
                    alt="By Project - Sourcing Platform"
                    fill
                    className="object-cover rounded-[2rem]"
                  />
                </div>
              </motion.div>

              {/* Floating Overlay Card */}
              <motion.div
                initial={{ opacity: 0, x: 50, scale: 0.8 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, type: 'spring' }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="hidden lg:block absolute -right-16 top-1/2 -translate-y-1/2 z-20 bg-cyan-100/90 backdrop-blur-sm p-6 rounded-2xl shadow-xl w-64"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-semibold text-slate-700">En collaboration avec</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-700" />
                </div>
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className="bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                >
                  <Cpu className="text-cyan-400 w-6 h-6" />
                </motion.div>
                <h4 className="font-display font-medium text-slate-900 text-xl uppercase leading-none">
                  Technologie conçue <br /> avec vision claire
                </h4>
              </motion.div>
            </motion.div>

            {/* Right Content */}
            <motion.div
              variants={slideInFromRight}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="lg:pl-12"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-5xl md:text-6xl font-display font-medium uppercase tracking-tight leading-[0.9] mb-8 text-slate-900"
              >
                Organiser vos Projets, <br /> Comparer et sourcer <br /> en ligne vos besoins
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                transition={{ delay: 0.2 }}
                className="text-slate-600 text-lg font-light mb-10 max-w-lg leading-relaxed"
              >
                By Project vous permet de lister les matériaux nécessaires à votre projet, demander une cotation en ligne auprès de notre réseau de fournisseurs chinois, recevoir et comparer les offres, puis commander directement ou venir sur place finaliser votre projet.
              </motion.p>
              <motion.div
                variants={fadeInUp}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-4"
              >
                <motion.a
                  href="https://byproject-twinsk.netlify.app/quote-request"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-full text-base font-semibold transition flex items-center gap-2 shadow-lg"
                >
                  Commencer un Projet <ChevronRight className="w-4 h-4" />
                </motion.a>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="border border-slate-300 hover:bg-slate-100 text-slate-900 px-8 py-4 rounded-full text-base font-semibold transition flex items-center gap-2"
                >
                  <ListChecks className="w-5 h-5" />
                  Voir nos Forfaits
                </motion.button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
};

export default TwinskTech;
