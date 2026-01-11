'use client';

import { motion } from 'framer-motion';
import { ChevronRight, MousePointer2, Phone, Send } from 'lucide-react';
import Image from 'next/image';
import { fadeInUp } from '../../lib/animations';

const TwinskFooter = () => {
  const footerLinks = [
    { label: 'Services', href: '#services' },
    { label: 'Contactez-nous', href: '#contact' },
    { label: 'Suivi', href: '#tracking', icon: MousePointer2 },
    { label: 'À propos', href: '#about' },
    { label: 'Politique de confidentialité', href: '#privacy', muted: true }
  ];

  return (
    <footer className="bg-[#081836] dark:bg-black rounded-t-[3rem] mt-10 pt-20 pb-10 text-white overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 border-b border-white/10 pb-16">
          {/* Signup Column */}
          <div className="lg:col-span-2">
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-4xl md:text-5xl font-display font-medium uppercase tracking-tight mb-8 max-w-xl"
            >
              Inscrivez-vous pour recevoir <br /> nos offres et rester informé
            </motion.h2>
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex flex-col md:flex-row gap-4 max-w-2xl"
            >
              <input
                type="text"
                placeholder="Votre nom"
                className="bg-[#0F2448] dark:bg-slate-900 border border-white/10 text-white placeholder-slate-400 px-6 py-4 rounded-xl flex-1 focus:outline-none focus:border-yellow-400 transition"
              />
              <input
                type="email"
                placeholder="Adresse email"
                className="bg-[#0F2448] dark:bg-slate-900 border border-white/10 text-white placeholder-slate-400 px-6 py-4 rounded-xl flex-1 focus:outline-none focus:border-yellow-400 transition"
              />
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                Envoyer <ChevronRight className="w-4 h-4" />
              </motion.button>
            </motion.form>

            <div className="mt-20 flex flex-col md:flex-row items-end justify-between">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="w-64 h-32 rounded-xl overflow-hidden relative opacity-80 mb-8 md:mb-0"
              >
                <Image
                  src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=2070&auto=format&fit=crop"
                  alt="Logistics"
                  fill
                  className="object-cover"
                />
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="text-[80px] md:text-[120px] leading-none font-display font-bold text-white/90 uppercase tracking-tighter -mb-6"
              >
                TWINSK
              </motion.h1>
            </div>
          </div>

          {/* Links Column */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col justify-between pl-0 lg:pl-12 border-l-0 lg:border-l border-white/10"
          >
            <div className="space-y-6">
              {footerLinks.map((link, index) => (
                <div key={index}>
                  <motion.a
                    href={link.href}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    whileHover={{ x: 5, color: '#facc15' }}
                    className={`flex items-center gap-2 text-2xl font-display font-medium uppercase tracking-tight transition ${
                      link.muted ? 'text-white/50' : ''
                    }`}
                  >
                    {link.label}
                    {link.icon && <link.icon className="w-6 h-6 fill-white" />}
                  </motion.a>
                  {index < footerLinks.length - 1 && (
                    <div className="h-px bg-white/10 w-full mt-6"></div>
                  )}
                </div>
              ))}
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 }}
              className="mt-12"
            >
              <h5 className="font-display font-medium uppercase text-white mb-4">Contactez-nous</h5>
              <ul className="space-y-3 text-slate-300 text-sm font-light">
                <motion.li
                  whileHover={{ x: 5 }}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  +1 (800) 123-4567
                </motion.li>
                <motion.li
                  whileHover={{ x: 5 }}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  hello@twinsk.com
                </motion.li>
              </ul>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.9 }}
          className="mt-8 text-center text-slate-400 text-sm"
        >
          © 2024 Twinsk Company. Tous droits réservés.
        </motion.div>
      </div>
    </footer>
  );
};

export default TwinskFooter;
