'use client';

import { motion } from 'framer-motion';
import { MousePointer2, Phone, Send } from 'lucide-react';

const TwinskFooter = () => {
  const footerLinks = [
    { label: 'Services', href: '#services' },
    { label: 'Contactez-nous', href: '#contact' },
    { label: 'Suivi', href: '#tracking', icon: MousePointer2 },
    { label: 'À propos', href: '#about' },
    { label: 'Politique de confidentialité', href: '#privacy', muted: true },
  ];

  return (
    <footer className="bg-slate-900 rounded-t-[3rem] mt-10 pt-20 pb-10 text-white overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 border-b border-white/10 pb-16">
          {/* Brand Column */}
          <div className="lg:col-span-2 flex flex-col justify-between">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="max-w-xl"
            >
              <div className="inline-flex items-center gap-3 mb-6">
                <span className="h-px w-10 bg-lime" />
                <span className="kicker text-lime">Twinsk Company</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-medium uppercase tracking-tight leading-[0.95]">
                Votre partenaire <span className="text-lime">logistique</span>
                <br />
                Hong&nbsp;Kong &harr; Afrique
              </h2>
              <p className="mt-6 text-slate-300 text-base max-w-lg leading-relaxed">
                Fret, sourcing, échantillonnage et délégations : on s&apos;occupe
                de tout, de la Chine à votre porte.
              </p>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-[80px] md:text-[140px] leading-none font-display font-bold text-lime/90 uppercase tracking-tighter -mb-6 mt-16"
            >
              TWINSK
            </motion.h1>
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
                    whileHover={{ x: 5, color: '#a3e635' }}
                    className={`flex items-center gap-2 text-2xl font-display font-medium uppercase tracking-tight transition ${
                      link.muted ? 'text-white/50' : ''
                    }`}
                  >
                    {link.label}
                    {link.icon && <link.icon className="w-6 h-6 text-lime" />}
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
              <h5 className="kicker text-lime mb-4">Contactez-nous</h5>
              <ul className="space-y-3 text-slate-300 text-sm font-light">
                <motion.li
                  whileHover={{ x: 5 }}
                  className="flex items-center gap-3 cursor-pointer hover:text-lime transition-colors"
                >
                  <Phone className="w-4 h-4 text-lime" />
                  +852 0000 0000
                </motion.li>
                <motion.li
                  whileHover={{ x: 5 }}
                  className="flex items-center gap-3 cursor-pointer hover:text-lime transition-colors"
                >
                  <Send className="w-4 h-4 text-lime" />
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
          className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400 text-sm"
        >
          <span>© 2024 Twinsk Company Limited. Tous droits réservés.</span>
          <span className="text-slate-500">
            Hong Kong &middot; <span className="text-lime">EST. 2018</span>
          </span>
        </motion.div>
      </div>
    </footer>
  );
};

export default TwinskFooter;
