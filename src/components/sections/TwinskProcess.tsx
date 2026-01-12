'use client';

import { motion } from 'framer-motion';
import { Smartphone, ChevronRight, ArrowUpRight, Plane } from 'lucide-react';
import Image from 'next/image';
import { fadeInUp, staggerContainer } from '../../lib/animations';

const TwinskProcess = () => {
  const steps = [
    {
      number: '01',
      title: 'Envoyez vos marchandises',
      description: 'Envoyez vos marchandises à nos dépôts en Chine. Nous les réceptionnons et les préparons pour l&apos;expédition.',
      image: '/replicate-prediction-w1jy4f0nr5rmr0cvpatsn89k10.jpg',
      featured: true
    },
    {
      number: '02',
      title: 'Notifications',
      description: 'Recevez une notification à chaque étape de votre expédition. Restez informé en temps réel via WhatsApp.',
      image: '/replicate-prediction-3rx19n2pa1rmt0cvpavaeesdpm.jpg',
      featured: true
    },
    {
      number: '03',
      title: 'Suivi AirTags',
      description: 'Suivez les AirTags de votre marchandise en temps réel. Localisez vos colis à tout moment pendant le transport.',
      image: '/replicate-prediction-txdm83tykdrmt0cvpavvwytpxr.jpg',
      featured: true
    }
  ];

  return (
    <section className="bg-white py-20">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8">
        <div className="flex flex-col lg:flex-row justify-between items-end mb-12">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wide mb-4">
              <Smartphone className="w-4 h-4" />
              Service sur mesure digitalisé
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-medium text-slate-900 dark:text-white uppercase leading-[0.9] tracking-tight max-w-2xl">
              Envoyez votre <br /> Marchandise, Suivez-la <br /> sur WhatsApp
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="hidden lg:block relative w-64"
          >
            <motion.div
              animate={{ y: [-10, 10, -10], rotate: [45, 50, 45] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-20 right-0"
            >
              <Plane className="w-24 h-24 text-slate-800 dark:text-slate-300" />
            </motion.div>
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium mt-4">
              Un suivi digitalisé de bout en bout pour une transparence totale.
            </p>
          </motion.div>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {/* CTA Card */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-col justify-end"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-[#007cb5] hover:bg-[#006a9e] text-white px-8 py-4 rounded-full text-base font-semibold transition flex items-center gap-2 w-fit mb-8 shadow-lg"
            >
              Booker votre marchandise <ChevronRight className="w-4 h-4" />
            </motion.button>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="mt-auto relative h-48 rounded-2xl overflow-hidden"
            >
              <Image
                src="/replicate-prediction-d565emm6a1rmt0cvpazbqyreer.png"
                alt="Service digitalisé"
                fill
                className="object-cover"
              />
            </motion.div>
          </motion.div>

          {/* Process Steps */}
          {steps.map((step, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              whileHover={{ y: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-slate-800 p-4 rounded-3xl h-[300px] relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white dark:bg-slate-800 z-20 p-6 flex flex-col justify-between">
                <div className="flex justify-between">
                  <span className="font-display font-medium text-lg uppercase text-slate-900 dark:text-white">
                    {step.number}/ {step.title}
                  </span>
                  <ArrowUpRight className="w-5 h-5 text-slate-900 dark:text-white" />
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                  {step.description}
                </p>
                <div className="h-32 w-full rounded-2xl overflow-hidden relative">
                  <Image
                    src={step.image}
                    alt={step.title}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TwinskProcess;
