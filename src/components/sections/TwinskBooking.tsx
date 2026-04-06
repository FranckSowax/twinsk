'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Bell, Truck, Ship, Train, Plane, MapPin, Calendar, Package, ArrowRight, ChevronDown, Globe, Shield, Clock, Sparkles } from 'lucide-react';

const TwinskBooking = () => {
  const [isEuropeOpen, setIsEuropeOpen] = useState(true);
  const [isAfricaOpen, setIsAfricaOpen] = useState(true);

  const stats = [
    { icon: Truck, label: 'Camions', value: '31,081', color: 'from-amber-500 to-orange-500' },
    { icon: Ship, label: 'Maritime', value: '215,076', color: 'from-cyan-500 to-blue-500' },
    { icon: Train, label: 'Trains', value: '5,053', color: 'from-emerald-500 to-teal-500' },
    { icon: Plane, label: 'Avions', value: '1,875', color: 'from-violet-500 to-purple-500' },
  ];

  const routesInternational = [
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'France', toFlag: '🇫🇷', price: '1,450' },
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'UK', toFlag: '🇬🇧', price: '1,580' },
    { type: 'FCL', size: "20'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'États-Unis', toFlag: '🇺🇸', price: '2,100' },
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Canada', toFlag: '🇨🇦', price: '2,250' },
  ];

  const routesAfrica = [
    { type: 'FCL', size: "20'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Libreville', toFlag: '🇬🇦', price: '1,250' },
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Lomé', toFlag: '🇹🇬', price: '890' },
    { type: 'LCL', size: "20'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Abidjan', toFlag: '🇨🇮', price: '680' },
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Niamey', toFlag: '🇳🇪', price: '1,350' },
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Kinshasa', toFlag: '🇨🇩', price: '1,480' },
    { type: 'LCL', size: "20'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Dar es Salaam', toFlag: '🇹🇿', price: '980' },
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Lagos', toFlag: '🇳🇬', price: '780' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.215, 0.61, 0.355, 1] as const
      }
    }
  };

  const RouteCard = ({ route, index }: { route: typeof routesInternational[0], index: number }) => (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className="group relative bg-white hover:bg-gradient-to-br hover:from-slate-50 hover:to-white rounded-2xl p-5 sm:p-6 transition-all duration-300 border border-slate-200/80 hover:border-amber-300/50 cursor-pointer shadow-sm hover:shadow-xl hover:shadow-amber-500/5 overflow-hidden"
    >
      {/* Decorative corner gradient */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-100/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-full" />

      {/* Type badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] sm:text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wider">
          {route.type}
        </span>
        <span className="text-xs text-slate-500 font-medium">{route.size}</span>
      </div>

      {/* Route info */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-lg">{route.fromFlag}</span>
          <span className="text-sm font-medium text-slate-700 hidden sm:inline">{route.from}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          <ArrowRight className="w-4 h-4 text-amber-500 mx-2 flex-shrink-0" />
          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">{route.toFlag}</span>
          <span className="text-sm font-medium text-slate-700 truncate max-w-[80px]">{route.to}</span>
        </div>
      </div>

      {/* Price */}
      <div className="flex items-end justify-between">
        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">À partir de</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900">${route.price}</span>
            <span className="text-xs text-slate-500">USD</span>
          </div>
        </div>
        <motion.div
          whileHover={{ scale: 1.1 }}
          className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300 shadow-lg shadow-amber-500/25"
        >
          <ArrowRight className="w-4 h-4 text-white" />
        </motion.div>
      </div>
    </motion.div>
  );

  return (
    <section id="booking" className="relative bg-gradient-to-b from-slate-100 via-slate-50 to-white text-slate-800 overflow-hidden py-16 sm:py-20 lg:py-28">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-amber-200/20 to-orange-200/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-cyan-200/20 to-blue-200/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Notification Bell - Floating */}
      <motion.div
        initial={{ opacity: 0, y: -30, scale: 0.8 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', damping: 15 }}
        className="relative z-20 flex justify-center mb-8 sm:mb-10"
      >
        <motion.div
          whileHover={{ scale: 1.1, rotate: 15 }}
          whileTap={{ scale: 0.95 }}
          animate={{ y: [0, -5, 0] }}
          transition={{ y: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }}
          className="bg-gradient-to-br from-amber-500 to-orange-500 text-white p-4 rounded-2xl shadow-xl shadow-amber-500/25 cursor-pointer"
        >
          <Bell className="w-6 h-6" />
        </motion.div>
      </motion.div>

      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12 sm:mb-16 px-4"
      >
        <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
          <Globe className="w-3.5 h-3.5" />
          Réservation en ligne
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-medium text-slate-900 leading-[0.95] tracking-tight mb-6">
          <span className="block">Réservez</span>
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600">
            votre fret
          </span>
        </h2>
        <p className="text-slate-500 text-lg font-light max-w-2xl mx-auto">
          Trouvez les meilleurs tarifs pour vos expéditions internationales
        </p>
      </motion.div>

      {/* Main Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Stats Row - Hidden
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ y: -5, scale: 1.02 }}
              className="relative bg-white backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between hover:shadow-xl hover:shadow-slate-900/5 transition-all duration-300 overflow-hidden group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

              <div className="flex items-center gap-3 relative">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-600">{stat.label}</span>
              </div>
              <span className="text-lg font-bold text-slate-900 relative">{stat.value}</span>
            </motion.div>
          ))}
        </motion.div>
        */}

        {/* Search Module - Hidden
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-3xl mx-auto mb-12"
        >
          <div className="bg-white rounded-3xl p-4 shadow-2xl shadow-slate-900/10 border border-slate-200/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="bg-slate-50 rounded-2xl flex items-center px-5 py-4 focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:bg-white transition-all group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mr-4">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Origine</label>
                  <input
                    type="text"
                    defaultValue="Chine"
                    className="bg-transparent border-none text-sm text-slate-900 font-medium placeholder-slate-400 w-full focus:outline-none"
                    placeholder="Ville de départ"
                  />
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl flex items-center px-5 py-4 focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:bg-white transition-all group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mr-4">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Destination</label>
                  <input
                    type="text"
                    className="bg-transparent border-none text-sm text-slate-900 font-medium placeholder-slate-400 w-full focus:outline-none"
                    placeholder="Ville d'arrivée"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-2xl flex items-center px-5 py-4 focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:bg-white transition-all">
                <Calendar className="w-5 h-5 text-slate-400 mr-3" />
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Date</label>
                  <input
                    type="date"
                    defaultValue="2025-07-07"
                    className="bg-transparent border-none text-sm text-slate-900 font-medium w-full focus:outline-none"
                  />
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl flex items-center px-5 py-4 focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:bg-white transition-all">
                <Package className="w-5 h-5 text-slate-400 mr-3" />
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Poids/Volume</label>
                  <input
                    type="text"
                    className="bg-transparent border-none text-sm text-slate-900 font-medium placeholder-slate-400 w-full focus:outline-none"
                    placeholder="100kg / 0.5m³"
                  />
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl px-6 py-4 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Rechercher
              </motion.button>
            </div>
          </div>
        </motion.div>
        */}

        {/* Routes Container */}
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 lg:p-12 shadow-2xl shadow-slate-900/5 border border-slate-200/50">

          {/* Europe/America Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-6"
          >
            <button
              onClick={() => setIsEuropeOpen(!isEuropeOpen)}
              className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 rounded-2xl transition-all duration-300 group border border-cyan-200/50"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
                    Chine vers Europe & Amérique
                  </h3>
                  <p className="text-sm text-slate-500">{routesInternational.length} destinations disponibles</p>
                </div>
              </div>
              <motion.div
                animate={{ rotate: isEuropeOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow"
              >
                <ChevronDown className="w-5 h-5 text-cyan-500" />
              </motion.div>
            </button>
          </motion.div>

          <AnimatePresence>
            {isEuropeOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.215, 0.61, 0.355, 1] }}
                className="overflow-hidden"
              >
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
                >
                  {routesInternational.map((route, index) => (
                    <RouteCard key={index} route={route} index={index} />
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Africa Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-6"
          >
            <button
              onClick={() => setIsAfricaOpen(!isAfricaOpen)}
              className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 rounded-2xl transition-all duration-300 group border border-amber-200/50"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
                    Chine vers Afrique
                  </h3>
                  <p className="text-sm text-slate-500">{routesAfrica.length} destinations disponibles</p>
                </div>
              </div>
              <motion.div
                animate={{ rotate: isAfricaOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow"
              >
                <ChevronDown className="w-5 h-5 text-amber-500" />
              </motion.div>
            </button>
          </motion.div>

          <AnimatePresence>
            {isAfricaOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.215, 0.61, 0.355, 1] }}
                className="overflow-hidden"
              >
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
                >
                  {routesAfrica.map((route, index) => (
                    <RouteCard key={index} route={route} index={index} />
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Value Propositions */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 pt-10 border-t border-slate-200/50"
          >
            <h3 className="text-2xl sm:text-3xl font-display font-medium text-slate-900 text-center mb-10">
              Pourquoi nous <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-500">choisir</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Shield,
                  title: 'Sécurité garantie',
                  desc: 'Assurance complète pour toutes vos expéditions avec suivi en temps réel.',
                  gradient: 'from-emerald-500 to-teal-500',
                  bg: 'from-emerald-50 to-teal-50'
                },
                {
                  icon: Clock,
                  title: 'Délais optimisés',
                  desc: 'Livraison rapide grâce à notre réseau logistique international optimisé.',
                  gradient: 'from-amber-500 to-orange-500',
                  bg: 'from-amber-50 to-orange-50'
                },
                {
                  icon: Globe,
                  title: 'Couverture mondiale',
                  desc: 'Expédition vers plus de 150 pays avec une expertise Chine-Afrique.',
                  gradient: 'from-cyan-500 to-blue-500',
                  bg: 'from-cyan-50 to-blue-50'
                }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -8 }}
                  className={`bg-gradient-to-br ${item.bg} rounded-3xl p-8 border border-slate-200/50 relative overflow-hidden group`}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${item.gradient} opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity duration-500`} />
                  <div className={`w-14 h-14 bg-gradient-to-br ${item.gradient} rounded-2xl flex items-center justify-center mb-5 shadow-lg`}>
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="text-xl font-semibold text-slate-900 mb-3">{item.title}</h4>
                  <p className="text-slate-600 font-light leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default TwinskBooking;
