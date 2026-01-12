'use client';

import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Home, Wrench, Crosshair, User, ChevronRight, Menu, X, Moon, Sun, ArrowDownRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

const TwinskHero = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const navItems = [
    { label: 'Accueil', icon: Home, href: '#home' },
    { label: 'Services', icon: Wrench, href: '#services' },
    { label: 'Suivi', icon: Crosshair, href: '#tracking' },
    { label: 'À propos', icon: User, href: '#about' }
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Staggered text animation variants
  const letterVariants = {
    hidden: { opacity: 0, y: 100, rotateX: -90 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        duration: 0.8,
        delay: i * 0.05,
        ease: [0.215, 0.61, 0.355, 1]
      }
    })
  };

  return (
    <div ref={containerRef} className="relative w-full mx-auto max-w-[1800px]">
      {/* Navbar with glassmorphism */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.215, 0.61, 0.355, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? 'bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,0,0,0.05)] py-4'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 flex items-center justify-between">
          {/* Logo with refined typography */}
          <motion.a
            href="#home"
            whileHover={{ scale: 1.02 }}
            className="relative group"
          >
            <span className={`text-2xl md:text-3xl font-light tracking-[0.3em] uppercase transition-colors duration-300 ${
              isScrolled ? 'text-slate-900 dark:text-white' : 'text-white'
            }`}>
              TWINSK
            </span>
            <motion.span
              className={`absolute -bottom-1 left-0 h-[2px] bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300 ${
                isScrolled ? 'w-0 group-hover:w-full' : 'w-full'
              }`}
            />
          </motion.a>

          {/* Desktop Navigation - Editorial style */}
          <div className={`hidden lg:flex items-center gap-12 text-sm tracking-wider uppercase ${
            isScrolled ? 'text-slate-600 dark:text-slate-400' : 'text-white/80'
          }`}>
            {navItems.map((item, index) => (
              <motion.a
                key={item.label}
                href={item.href}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
                className="relative group py-2"
              >
                <span className="relative z-10 transition-colors duration-300 group-hover:text-amber-500">
                  {item.label}
                </span>
                <motion.span
                  className="absolute bottom-0 left-0 w-0 h-[1px] bg-amber-500 group-hover:w-full transition-all duration-300"
                />
              </motion.a>
            ))}
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            {/* Theme Toggle - Refined */}
            <motion.button
              onClick={toggleTheme}
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className={`p-2.5 rounded-full transition-all duration-300 ${
                isScrolled
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
              }`}
              aria-label="Toggle theme"
            >
              {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </motion.button>

            {/* CTA Button - Premium style */}
            <motion.a
              href="#details"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="hidden md:flex bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-500 hover:via-amber-600 hover:to-orange-600 text-slate-900 px-7 py-3.5 rounded-full text-sm font-medium tracking-wider uppercase transition-all items-center gap-2 shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30"
            >
              Devis gratuit
              <ArrowDownRight className="w-4 h-4" />
            </motion.a>

            {/* Mobile Menu Button */}
            <motion.button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              whileTap={{ scale: 0.9 }}
              className={`lg:hidden p-2.5 rounded-xl transition-all duration-300 ${
                isScrolled
                  ? 'text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'text-white hover:bg-white/10'
              }`}
              aria-label="Toggle menu"
            >
              <motion.div
                animate={{ rotate: isMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </motion.div>
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu - Fullscreen overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, clipPath: "circle(0% at calc(100% - 40px) 40px)" }}
              animate={{ opacity: 1, clipPath: "circle(150% at calc(100% - 40px) 40px)" }}
              exit={{ opacity: 0, clipPath: "circle(0% at calc(100% - 40px) 40px)" }}
              transition={{ duration: 0.5, ease: [0.215, 0.61, 0.355, 1] }}
              className="fixed inset-0 bg-slate-950 z-40 flex flex-col items-center justify-center"
            >
              <div className="flex flex-col items-center gap-8">
                {navItems.map((item, index) => (
                  <motion.a
                    key={item.label}
                    href={item.href}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 + index * 0.1 }}
                    onClick={() => setIsMenuOpen(false)}
                    className="text-4xl md:text-5xl font-light text-white hover:text-amber-400 transition-colors tracking-wider uppercase"
                  >
                    {item.label}
                  </motion.a>
                ))}
                <motion.a
                  href="#details"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                  onClick={() => setIsMenuOpen(false)}
                  className="mt-8 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 px-10 py-4 rounded-full text-lg font-medium tracking-wider uppercase"
                >
                  Devis gratuit
                </motion.a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Hero Section - Editorial Magazine Style */}
      <motion.div
        style={{ y, opacity }}
        className="relative min-h-screen overflow-hidden"
      >
        {/* Geometric background elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Gradient mesh background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

          {/* Animated gradient orbs */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent blur-3xl"
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-cyan-500/20 via-blue-500/10 to-transparent blur-3xl"
          />

          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '100px 100px'
            }}
          />
        </div>

        {/* Main Content Grid */}
        <div className="relative z-10 max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20 min-h-screen flex items-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-4 w-full pt-32 pb-20 lg:pt-0 lg:pb-0">

            {/* Left Column - Typography */}
            <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center">
              {/* Eyebrow */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="flex items-center gap-4 mb-8"
              >
                <span className="h-[1px] w-12 bg-gradient-to-r from-amber-400 to-amber-500" />
                <span className="text-amber-400 text-sm tracking-[0.3em] uppercase font-medium">
                  Logistics Excellence
                </span>
              </motion.div>

              {/* Main Headline - Dramatic typography */}
              <div className="overflow-hidden mb-8">
                <motion.h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extralight text-white leading-[0.9] tracking-tight">
                  {['Rapprocher', 'le', 'monde'].map((word, wordIndex) => (
                    <span key={wordIndex} className="block overflow-hidden">
                      <motion.span
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        transition={{
                          duration: 1,
                          delay: 0.5 + wordIndex * 0.15,
                          ease: [0.215, 0.61, 0.355, 1]
                        }}
                        className={`block ${wordIndex === 1 ? 'text-amber-400 font-light italic' : ''}`}
                      >
                        {word}
                      </motion.span>
                    </span>
                  ))}
                </motion.h1>
              </div>

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.2 }}
                className="text-slate-400 text-lg md:text-xl font-light leading-relaxed max-w-md mb-12"
              >
                Solutions logistiques premium de la Chine vers le monde.
                <span className="text-white font-normal"> Fiabilité absolue.</span>
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.4 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <motion.a
                  href="#services"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative bg-white text-slate-900 px-8 py-4 rounded-full text-sm font-medium tracking-wider uppercase overflow-hidden transition-all shadow-2xl shadow-white/10"
                >
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    Découvrir nos services
                    <motion.span
                      className="inline-block"
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </motion.span>
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.a>

                <motion.a
                  href="#tracking"
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  className="border border-white/20 text-white px-8 py-4 rounded-full text-sm font-medium tracking-wider uppercase transition-all backdrop-blur-sm flex items-center justify-center gap-3"
                >
                  Suivre un colis
                  <Crosshair className="w-4 h-4" />
                </motion.a>
              </motion.div>

              {/* Stats Row */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.6 }}
                className="flex gap-12 mt-16 pt-8 border-t border-white/10"
              >
                {[
                  { value: '10K+', label: 'Clients actifs' },
                  { value: '98%', label: 'Satisfaction' },
                  { value: '45', label: 'Pays desservis' }
                ].map((stat, index) => (
                  <div key={index} className="text-center sm:text-left">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 1.8 + index * 0.1 }}
                      className="text-3xl md:text-4xl font-light text-white mb-1"
                    >
                      {stat.value}
                    </motion.div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right Column - Image */}
            <div className="lg:col-span-6 xl:col-span-7 relative flex items-center justify-center lg:justify-end">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, x: 100 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.8, ease: [0.215, 0.61, 0.355, 1] }}
                className="relative w-full max-w-2xl aspect-[4/3] lg:aspect-[3/4]"
              >
                {/* Decorative frame */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 1.2 }}
                  className="absolute -inset-4 md:-inset-8 border border-amber-500/20 rounded-3xl"
                />

                {/* Main image container */}
                <div className="relative w-full h-full rounded-2xl overflow-hidden">
                  <Image
                    src="/bannertwinsk2.jpg"
                    alt="Twinsk Company Limited - Global Logistics"
                    fill
                    className="object-cover object-center"
                    priority
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-900/40 via-transparent to-transparent" />
                </div>

                {/* Floating badge */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 1.6 }}
                  className="absolute -bottom-6 -left-6 md:bottom-8 md:-left-12 bg-white/95 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <Crosshair className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-2xl font-light text-slate-900">24/7</div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider">Suivi temps réel</div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-xs text-slate-500 uppercase tracking-[0.3em]">Scroll</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-[1px] h-12 bg-gradient-to-b from-amber-400 to-transparent"
          />
        </motion.div>
      </motion.div>
    </div>
  );
};

export default TwinskHero;
