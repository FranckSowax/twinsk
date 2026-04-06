'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Truck, ShieldCheck, MessageCircle, ChevronDown, TrendingUp, Star, Zap } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

// Animated counter component
const AnimatedCounter = ({ value, suffix = '' }: { value: number; suffix?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 50, stiffness: 100 });
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isInView) {
          setIsInView(true);
          motionValue.set(value);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [motionValue, value, isInView]);

  const display = useTransform(springValue, (latest) =>
    Math.floor(latest).toLocaleString() + suffix
  );

  return <motion.span ref={ref}>{display}</motion.span>;
};

const TwinskStats = () => {
  const avatars = [
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80"
  ];

  const bookings = [
    { name: 'Expédition acier', client: 'Jonathan Trott', amount: '248 750 €', trend: '+12%' },
    { name: 'Expédition automobile', client: 'Cameron Green', amount: '625,40 €', trend: '+8%' }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: [0.215, 0.61, 0.355, 1] as const
      }
    }
  };

  return (
    <section className="relative max-w-[1600px] mx-auto px-4 md:px-8 pb-24">
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-100/30 to-transparent rounded-full blur-3xl" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="relative"
      >
        {/* Main container with glass effect */}
        <div className="relative bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-[3rem] p-8 md:p-12 lg:p-16 overflow-hidden border border-slate-200/50 shadow-2xl shadow-slate-900/5">
          {/* Inner decorative elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-200/20 to-orange-200/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-cyan-200/20 to-blue-200/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
              backgroundSize: '32px 32px'
            }}
          />

          <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12 items-center">
            {/* Testimonial / Chat UI */}
            <motion.div
              variants={itemVariants}
              className="order-2 lg:order-1"
            >
              <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="bg-white p-7 rounded-[2rem] shadow-xl shadow-slate-900/5 border border-slate-100 max-w-sm mx-auto lg:mx-0"
              >
                {/* Header with status indicator */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <div className="relative w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-slate-100">
                      <Image
                        src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop"
                        alt="Utilisateur"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-base">Edward Blake</h4>
                    <p className="text-slate-500 text-sm flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-amber-500" />
                      Support Client, Twinsk
                    </p>
                  </div>
                </div>

                {/* Chat bubble with typing indicator */}
                <motion.div
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  whileInView={{ opacity: 1, x: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="relative bg-gradient-to-br from-slate-50 to-slate-100 p-5 rounded-2xl rounded-tl-md mb-5"
                >
                  <p className="text-slate-700 text-sm font-medium leading-relaxed">
                    Bonjour, comment puis-je vous aider ?
                  </p>
                  <div className="absolute -bottom-2 left-4 w-4 h-4 bg-slate-100 transform rotate-45" />
                </motion.div>

                {/* CTA Button */}
                <motion.a
                  href="#chatbot"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <MessageCircle className="w-4 h-4" />
                  Discuter avec nous
                </motion.a>

                {/* Trust badge */}
                <div className="mt-5 flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-slate-900 font-semibold text-sm">60 000+</div>
                    <div className="text-slate-500 text-xs">Clients satisfaits</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Center Text with Stats */}
            <motion.div
              variants={itemVariants}
              className="text-center order-1 lg:order-2"
            >
              {/* Label */}
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-8">
                <Truck className="w-3.5 h-3.5" />
                Livraison à domicile
              </div>

              {/* Main headline */}
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-medium text-slate-900 leading-[0.95] tracking-tight mb-8">
                <span className="block">Confiance,</span>
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600">
                  tranquillité d&apos;esprit
                </span>
                <span className="block font-light italic text-slate-600">&amp; qualité incomparable</span>
              </h2>

              {/* Avatar group with stats */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
                <div className="flex -space-x-3">
                  {avatars.map((avatar, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0, x: -10 }}
                      whileInView={{ opacity: 1, scale: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 + index * 0.1, type: 'spring' }}
                      whileHover={{ scale: 1.1, zIndex: 10 }}
                      className="relative w-12 h-12 rounded-full border-3 border-white overflow-hidden shadow-lg cursor-pointer"
                    >
                      <Image src={avatar} alt="" fill className="object-cover" />
                    </motion.div>
                  ))}
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.7, type: 'spring' }}
                    className="relative w-12 h-12 rounded-full border-3 border-white bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg"
                  >
                    <span className="text-white text-xs font-bold">+99</span>
                  </motion.div>
                </div>
                <div className="text-left">
                  <div className="text-slate-900 font-bold text-2xl leading-none">
                    <AnimatedCounter value={20} suffix="K+" />
                  </div>
                  <div className="text-slate-500 text-sm font-medium">Utilisateurs mensuels</div>
                </div>
              </div>

              {/* Rating */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
                className="inline-flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-full"
              >
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-500" />
                  ))}
                </div>
                <span className="text-slate-600 text-sm font-medium">4.9/5 • 2,340 avis</span>
              </motion.div>
            </motion.div>

            {/* Stats Table */}
            <motion.div
              variants={itemVariants}
              className="order-3"
            >
              <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-7 rounded-[2rem] max-w-sm mx-auto lg:ml-auto lg:mr-0 shadow-2xl"
              >
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h4 className="font-display font-medium text-white text-lg">Réservations</h4>
                    <p className="text-slate-400 text-xs">Tableau de bord</p>
                  </div>
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-white flex items-center gap-1 cursor-pointer hover:bg-white/20 transition"
                  >
                    Aujourd&apos;hui <ChevronDown className="w-3 h-3" />
                  </motion.span>
                </div>

                {/* Booking items */}
                <div className="space-y-4">
                  {bookings.map((booking, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.5 + index * 0.15 }}
                      className="flex justify-between items-center p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                          <Truck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-white font-semibold text-sm group-hover:text-amber-400 transition-colors">{booking.name}</div>
                          <div className="text-slate-400 text-xs">{booking.client}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-white text-sm">{booking.amount}</div>
                        <div className="text-emerald-400 text-xs flex items-center gap-0.5 justify-end">
                          <TrendingUp className="w-3 h-3" /> {booking.trend}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Divider */}
                <div className="my-5 border-t border-white/10" />

                {/* Total */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 }}
                  className="flex justify-between items-center"
                >
                  <div className="text-slate-400 font-medium text-sm">Total expéditions</div>
                  <div className="text-right">
                    <div className="font-bold text-white text-xl">311 290 €</div>
                    <div className="text-emerald-400 text-xs flex items-center gap-0.5 justify-end">
                      <TrendingUp className="w-3 h-3" /> +15% vs hier
                    </div>
                  </div>
                </motion.div>

                {/* Progress bar */}
                <div className="mt-5">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>Objectif mensuel</span>
                    <span>78%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: '78%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                    />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default TwinskStats;
