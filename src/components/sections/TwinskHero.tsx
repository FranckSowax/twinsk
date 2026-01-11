'use client';

import { motion } from 'framer-motion';
import { Home, Wrench, Crosshair, User, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

const TwinskHero = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { label: 'Home', icon: Home, href: '#home' },
    { label: 'Services', icon: Wrench, href: '#services' },
    { label: 'Tracking', icon: Crosshair, href: '#tracking' },
    { label: 'About Us', icon: User, href: '#about' }
  ];

  return (
    <div className="relative w-full mx-auto p-4 md:p-6 lg:p-8 max-w-[1600px]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="relative rounded-[2.5rem] overflow-hidden h-[85vh] min-h-[600px] w-full group"
      >
        {/* Background Image */}
        <div className="absolute inset-0 w-full h-full">
          <Image
            src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=2070&auto=format&fit=crop"
            alt="Logistics Port"
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent dark:from-black/95 dark:via-black/70"></div>

        {/* Navbar */}
        <motion.nav
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 flex items-center justify-between px-6 py-6 md:px-10"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="text-white text-2xl font-display font-semibold tracking-tighter uppercase cursor-pointer"
          >
            TWINSK
          </motion.div>
          
          <div className="hidden md:flex items-center space-x-8 text-white/90 text-sm font-medium">
            {navItems.map((item, index) => (
              <motion.a
                key={item.label}
                href={item.href}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.1, color: '#fff' }}
                className="flex items-center gap-2 hover:text-white transition"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </motion.a>
            ))}
          </div>

          <motion.a
            href="#details"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 px-6 py-3 rounded-full text-sm font-semibold transition flex items-center gap-2 shadow-lg"
          >
            See Details <ChevronRight className="w-4 h-4" />
          </motion.a>
        </motion.nav>

        {/* Hero Content */}
        <div className="relative z-10 h-full flex flex-col justify-center px-6 md:px-12 lg:px-20 max-w-4xl pb-20">
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-white text-6xl md:text-7xl lg:text-8xl font-medium uppercase leading-[0.9] tracking-tighter mb-8"
          >
            <motion.span
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="block"
            >
              Bringing the world
            </motion.span>
            <motion.span
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="block text-white/80"
            >
              Closer, One Delivery
            </motion.span>
            <motion.span
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="block"
            >
              At a Time
            </motion.span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="text-white/80 text-lg md:text-xl font-light max-w-lg leading-relaxed"
          >
            Fast, dependable, and most safest shipping for all your cargo needs across the globe.
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
};

export default TwinskHero;
