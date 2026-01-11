'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Home, Wrench, Crosshair, User, ChevronRight, Menu, X, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import Image from 'next/image';

const TwinskHero = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const navItems = [
    { label: 'Accueil', icon: Home, href: '#home' },
    { label: 'Services', icon: Wrench, href: '#services' },
    { label: 'Suivi', icon: Crosshair, href: '#tracking' },
    { label: 'À propos', icon: User, href: '#about' }
  ];

  // Gestion du scroll pour la navbar sticky
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Gestion du theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);

    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <div className="relative w-full mx-auto p-4 md:p-6 lg:p-8 max-w-[1600px]">
      {/* Navbar Sticky */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg py-3'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-6 md:px-10 flex items-center justify-between">
          <motion.a
            href="#home"
            whileHover={{ scale: 1.05 }}
            className={`text-2xl font-display font-semibold tracking-tighter uppercase cursor-pointer transition-colors ${
              isScrolled ? 'text-slate-900 dark:text-white' : 'text-white'
            }`}
          >
            TWINSK
          </motion.a>

          {/* Desktop Navigation */}
          <div className={`hidden md:flex items-center space-x-8 text-sm font-medium ${
            isScrolled ? 'text-slate-700 dark:text-slate-300' : 'text-white/90'
          }`}>
            {navItems.map((item, index) => (
              <motion.a
                key={item.label}
                href={item.href}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.1 }}
                className={`flex items-center gap-2 transition ${
                  isScrolled ? 'hover:text-yellow-500' : 'hover:text-white'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </motion.a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <motion.button
              onClick={toggleTheme}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className={`p-2 rounded-full transition-colors ${
                isScrolled
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-yellow-400'
                  : 'bg-white/20 text-white'
              }`}
              aria-label="Toggle theme"
            >
              {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </motion.button>

            {/* CTA Button - Desktop */}
            <motion.a
              href="#details"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="hidden md:flex bg-yellow-400 hover:bg-yellow-500 text-slate-900 px-6 py-3 rounded-full text-sm font-semibold transition items-center gap-2 shadow-lg"
            >
              Voir détails <ChevronRight className="w-4 h-4" />
            </motion.a>

            {/* Mobile Menu Button */}
            <motion.button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              whileTap={{ scale: 0.9 }}
              className={`md:hidden p-2 rounded-lg transition-colors ${
                isScrolled
                  ? 'text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'text-white hover:bg-white/20'
              }`}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700"
            >
              <div className="px-6 py-4 flex flex-col space-y-4">
                {navItems.map((item, index) => (
                  <motion.a
                    key={item.label}
                    href={item.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 * index }}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 text-slate-700 dark:text-slate-300 hover:text-yellow-500 dark:hover:text-yellow-400 py-2 font-medium transition"
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </motion.a>
                ))}
                <motion.a
                  href="#details"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  onClick={() => setIsMenuOpen(false)}
                  className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 px-6 py-3 rounded-full text-sm font-semibold transition flex items-center justify-center gap-2 shadow-lg mt-2"
                >
                  Voir détails <ChevronRight className="w-4 h-4" />
                </motion.a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="relative rounded-[2.5rem] overflow-hidden h-[80vh] min-h-[500px] md:h-[85vh] md:min-h-[600px] w-full group mt-16"
      >
        {/* Background blanc uniquement */}
        <div className="absolute inset-0 w-full h-full bg-white dark:bg-white">
          <Image
            src="/bannertwinsk2.jpg"
            alt="Twinsk Company Limited - Global Logistics"
            fill
            className="object-contain object-center transition-transform duration-700 group-hover:scale-[1.02]"
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1600px"
          />
        </div>

        {/* Overlay transparent pour la lisibilité du texte */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/50 to-transparent dark:from-white/90 dark:via-white/50 dark:to-transparent"></div>

        {/* Hero Content - Textes */}
        <div className="relative z-10 h-full flex flex-col justify-center px-6 md:px-12 lg:px-20 max-w-2xl">
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold uppercase leading-tight tracking-tight mb-6"
          >
            <motion.span
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="block text-slate-900"
            >
              Rapprocher le monde
            </motion.span>
            <motion.span
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="block text-slate-500"
            >
              Une livraison
            </motion.span>
            <motion.span
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="block text-slate-900"
            >
              À la fois
            </motion.span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="text-slate-600 text-base md:text-lg font-light max-w-md leading-relaxed mb-8"
          >
            Expédition rapide, fiable et sécurisée pour tous vos besoins de fret à travers le monde.
          </motion.p>
          <motion.a
            href="#services"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-full text-sm md:text-base font-semibold transition-all inline-flex items-center gap-2 shadow-xl hover:shadow-2xl w-fit"
          >
            Découvrir nos services <ChevronRight className="w-5 h-5" />
          </motion.a>
        </div>
      </motion.div>
    </div>
  );
};

export default TwinskHero;
