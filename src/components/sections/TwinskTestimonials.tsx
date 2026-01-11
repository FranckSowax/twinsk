'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import Image from 'next/image';
import { fadeInUp, staggerContainer } from '../../lib/animations';

const TwinskTestimonials = () => {
  const testimonials = [
    {
      rating: 4.8,
      text: 'Top-notch logistics with expert, and dedicated support for all your cargo transport needs.',
      name: 'Martin Edwards',
      role: 'General Manager',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
      tag: 'Reliable & expert logistics service'
    },
    {
      rating: 4.7,
      text: 'We trust Twinsk\'s dedicated team and we highly recommend them as a leading freight forwarder.',
      name: 'James Atkinson',
      role: 'Business Proprietor',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=100&q=80',
      tag: 'Accurate support, Fully dedication'
    },
    {
      rating: null,
      text: 'Exceptional 24/7 logistics support by a professional, fully committed team just to solve your headaches.',
      name: 'Natasha Portman',
      role: 'Business Owner',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80',
      tag: null
    }
  ];

  return (
    <section className="max-w-[1600px] mx-auto px-4 md:px-8 py-16">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="flex justify-between items-end mb-10"
      >
        <h2 className="text-5xl font-display font-medium text-slate-900 dark:text-white uppercase tracking-tight">
          Our Client Testimonials
        </h2>
        <div className="flex gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-12 h-12 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-12 h-12 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </motion.button>
        </div>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {testimonials.map((testimonial, index) => (
          <motion.div
            key={index}
            variants={fadeInUp}
            whileHover={{ y: -10, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm"
          >
            <div className="flex justify-between mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                [ Client ]
              </span>
              {testimonial.rating && (
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + index * 0.1, type: 'spring' }}
                  className="flex items-center gap-1"
                >
                  <span className="font-bold text-slate-900 dark:text-white">{testimonial.rating}</span>
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                </motion.div>
              )}
            </div>
            <p className="text-slate-800 dark:text-slate-200 text-xl font-medium leading-relaxed mb-8">
              {testimonial.text}
            </p>
            <div className="flex items-center gap-4 border-t border-slate-100 dark:border-slate-700 pt-6">
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <h5 className="text-slate-900 dark:text-white font-bold text-sm">{testimonial.name}</h5>
                <p className="text-slate-500 dark:text-slate-400 text-xs">{testimonial.role}</p>
              </div>
              {testimonial.tag && (
                <div className="ml-auto text-right">
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {testimonial.tag.split(',')[0]}<br />{testimonial.tag.split(',')[1]}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};

export default TwinskTestimonials;
