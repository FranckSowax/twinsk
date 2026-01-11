'use client';

import { motion } from 'framer-motion';
import { PackageCheck, ChevronRight, ArrowUpRight, Plane } from 'lucide-react';
import Image from 'next/image';
import { fadeInUp, staggerContainer } from '../../lib/animations';

const TwinskProcess = () => {
  const steps = [
    {
      number: '01',
      title: 'Warehouse',
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800',
      featured: false
    },
    {
      number: '02',
      title: 'Electric Lifter',
      description: 'Our warehouse system ensures precision handling, guaranteeing accurate, safe, and timely delivery of every product.',
      image: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800',
      featured: true
    },
    {
      number: '03',
      title: 'Delivery',
      image: 'https://images.unsplash.com/photo-1617347454431-f49d7ff5c301?w=800',
      featured: false
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
              <PackageCheck className="w-4 h-4" />
              Optimized Handling
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-medium text-slate-900 dark:text-white uppercase leading-[0.9] tracking-tight max-w-2xl">
              Precision Handling <br /> For Accurate Product <br /> Delivery
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
              Our warehouse system ensures safe, accurate, and on-time delivery.
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
              className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 px-8 py-4 rounded-full text-base font-semibold transition flex items-center gap-2 w-fit mb-8 shadow-lg"
            >
              Explore Process <ChevronRight className="w-4 h-4" />
            </motion.button>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="mt-auto relative h-48 rounded-2xl overflow-hidden"
            >
              <Image
                src="https://img.freepik.com/premium-photo/red-semi-truck-with-trailer-road-generative-ai_58409-28955.jpg?w=826"
                alt="Red Truck"
                fill
                className="object-cover mix-blend-multiply dark:mix-blend-normal dark:opacity-80"
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
              className={`bg-white dark:bg-slate-800 p-4 rounded-3xl h-[300px] relative overflow-hidden group ${
                step.featured ? 'md:col-span-2 lg:col-span-1' : ''
              }`}
            >
              {step.featured ? (
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
              ) : (
                <>
                  <div className="flex justify-between items-start mb-2 relative z-10">
                    <span className="font-display font-medium text-lg uppercase text-slate-900 dark:text-white">
                      {step.number}/ {step.title}
                    </span>
                    {index === 0 && <ArrowUpRight className="w-5 h-5 text-slate-900 dark:text-white" />}
                  </div>
                  <div className="absolute inset-0 mt-12 rounded-3xl overflow-hidden">
                    <Image
                      src={step.image}
                      alt={step.title}
                      fill
                      className="object-cover group-hover:scale-105 transition duration-500"
                    />
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TwinskProcess;
