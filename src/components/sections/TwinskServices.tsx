'use client';

import { motion } from 'framer-motion';
import { Settings, ChevronRight, Anchor, ArrowUpRight } from 'lucide-react';
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
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wide">
            <Settings className="w-4 h-4" />
            Service & Supports
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-medium text-slate-900 dark:text-white uppercase leading-[0.95] tracking-tight">
            Fast Precision <br /> Cargo Delivery <br /> For Everyone
          </h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 w-fit px-8 py-4 rounded-full text-base font-semibold transition flex items-center gap-2 mt-4 shadow-lg"
          >
            Explore Services <ChevronRight className="w-4 h-4" />
          </motion.button>
          <p className="text-slate-600 dark:text-slate-300 text-lg font-light leading-relaxed mt-4">
            We provide complete logistics support from pickup to final delivery with secure warehousing and real-time tracking.
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
            src="https://images.unsplash.com/photo-1559297434-fae8a1916a79?q=80&w=2070&auto=format&fit=crop"
            alt="Air Freight"
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
              Charter Air Freight
            </motion.h3>
          </div>
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white text-slate-900 px-6 py-3 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg"
            >
              Book a Shipment <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>

        {/* Ocean Freight Card */}
        <motion.div
          variants={fadeInUp}
          whileHover={{ y: -10 }}
          transition={{ duration: 0.3 }}
          className="relative group rounded-[2rem] overflow-hidden h-[500px] bg-blue-500"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800"></div>
          <div className="absolute inset-0 p-8 flex flex-col items-center justify-center">
            <motion.h3
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="text-white text-3xl font-display font-medium uppercase tracking-tight text-center leading-none mb-2"
            >
              Continental <br /> Ocean Freight
            </motion.h3>
            <p className="text-white/80 text-center mt-2 text-sm">
              One customer can fill a full container load
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1/2">
            <Image
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800"
              alt="Container"
              fill
              className="object-cover"
            />
          </div>
          <div className="absolute bottom-6 left-6">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              className="bg-white w-12 h-12 rounded-full flex items-center justify-center text-slate-900 transition shadow-lg"
            >
              <ArrowUpRight className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default TwinskServices;
