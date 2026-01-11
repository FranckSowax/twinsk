'use client';

import { motion } from 'framer-motion';
import { Truck, ShieldCheck, PhoneCall, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { fadeInUp } from '../../lib/animations';

const TwinskStats = () => {
  const avatars = [
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80"
  ];

  const bookings = [
    { name: 'Expédition acier', client: 'Jonathan Trott', amount: '248 750 €' },
    { name: 'Expédition automobile', client: 'Cameron Green', amount: '625,40 €' }
  ];

  return (
    <section className="max-w-[1600px] mx-auto px-4 md:px-8 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="bg-slate-50 rounded-[2.5rem] p-8 md:p-12 grid grid-cols-1 lg:grid-cols-3 gap-10 items-center"
      >
        {/* Testimonial / Chat UI */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          whileHover={{ y: -5 }}
          className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 max-w-sm mx-auto lg:mx-0"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="relative w-12 h-12 rounded-full overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop"
                alt="Utilisateur"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 text-base">Edward Blake</h4>
              <p className="text-slate-500 text-sm">Support Client, Twinsk</p>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-slate-100 p-4 rounded-xl rounded-tl-none mb-4 text-slate-700 text-sm font-medium"
          >
            Bonjour, comment puis-je vous aider ?
          </motion.div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-cyan-100 hover:bg-cyan-200 text-cyan-800 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
          >
            <PhoneCall className="w-4 h-4" />
            Appeler et réserver
          </motion.button>
          <div className="mt-4 flex items-center gap-2 text-slate-500 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-slate-900" />
            Plus de 60 000 clients satisfaits
          </div>
        </motion.div>

        {/* Center Text */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm font-medium mb-4">
            <Truck className="w-4 h-4" />
            Livraison à domicile
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-medium text-slate-900 uppercase tracking-tight leading-none mb-6">
            Confiance, tranquillité d&apos;esprit <br /> et qualité incomparable
          </h2>
          <div className="flex items-center justify-center gap-4">
            <div className="flex -space-x-3">
              {avatars.map((avatar, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="relative w-10 h-10 rounded-full border-2 border-white overflow-hidden"
                >
                  <Image src={avatar} alt="" fill className="object-cover" />
                </motion.div>
              ))}
            </div>
            <div className="text-left">
              <div className="text-slate-900 font-bold text-lg leading-none">20K+</div>
              <div className="text-slate-500 text-xs font-medium">Utilisateurs mensuels</div>
            </div>
          </div>
        </motion.div>

        {/* Stats Table */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          whileHover={{ y: -5 }}
          className="bg-cyan-100/50 p-6 rounded-3xl"
        >
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-display font-medium uppercase text-slate-800 text-lg">Réservations totales</h4>
            <span className="bg-white px-3 py-1 rounded-full text-xs font-semibold text-slate-600 flex items-center gap-1">
              Aujourd&apos;hui <ChevronDown className="w-3 h-3" />
            </span>
          </div>
          <div className="space-y-4">
            {bookings.map((booking, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="flex justify-between items-center pb-3 border-b border-slate-200/50"
              >
                <div>
                  <div className="text-slate-900 font-semibold text-sm">{booking.name}</div>
                  <div className="text-slate-500 text-xs">{booking.client}</div>
                </div>
                <div className="font-semibold text-slate-900 text-sm">{booking.amount}</div>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="flex justify-between items-center pt-1"
            >
              <div className="text-slate-900 font-semibold text-sm">Total expéditions :</div>
              <div className="font-bold text-slate-900 text-base">311 290 €</div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default TwinskStats;
