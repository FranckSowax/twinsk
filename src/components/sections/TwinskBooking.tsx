'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Bell, Truck, Ship, Train, Plane, MapPin, Calendar, Package, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../lib/animations';

const TwinskBooking = () => {
  const [isEuropeOpen, setIsEuropeOpen] = useState(true);
  const [isAfricaOpen, setIsAfricaOpen] = useState(true);

  const stats = [
    { icon: Truck, label: 'Camions', value: '31,081' },
    { icon: Ship, label: 'Maritime', value: '215,076' },
    { icon: Train, label: 'Trains', value: '5,053' },
    { icon: Plane, label: 'Avions', value: '1,875' },
  ];

  // Routes Chine vers Europe/Amérique
  const routesInternational = [
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'France', toFlag: '🇫🇷', price: '1,450' },
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'UK', toFlag: '🇬🇧', price: '1,580' },
    { type: 'FCL', size: "20'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'États-Unis', toFlag: '🇺🇸', price: '2,100' },
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Canada', toFlag: '🇨🇦', price: '2,250' },
  ];

  // Routes Chine vers Afrique
  const routesAfrica = [
    { type: 'FCL', size: "20'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Libreville', toFlag: '🇬🇦', price: '1,250' },
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Lomé', toFlag: '🇹🇬', price: '890' },
    { type: 'LCL', size: "20'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Abidjan', toFlag: '🇨🇮', price: '680' },
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Niamey', toFlag: '🇳🇪', price: '1,350' },
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Kinshasa', toFlag: '🇨🇩', price: '1,480' },
    { type: 'LCL', size: "20'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Dar es Salaam', toFlag: '🇹🇿', price: '980' },
    { type: 'FCL', size: "40'ST", from: 'Chine', fromFlag: '🇨🇳', to: 'Lagos', toFlag: '🇳🇬', price: '780' },
  ];

  const RouteCard = ({ route, index }: { route: typeof routesInternational[0], index: number }) => (
    <motion.div
      variants={fadeInUp}
      whileHover={{ y: -5, boxShadow: '0 10px 40px rgba(0,124,181,0.1)' }}
      className="bg-slate-50 hover:bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 transition duration-300 border border-slate-200 hover:border-[#007cb5]/30 cursor-pointer"
    >
      <div className="text-[10px] sm:text-xs text-[#007cb5] mb-2 sm:mb-4 font-semibold tracking-wide">
        {route.type} • {route.size}
      </div>
      <div className="flex flex-col gap-1 sm:gap-2 mb-3 sm:mb-6">
        <div className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base font-medium text-slate-800 flex-wrap">
          <span className="text-xs sm:text-sm">{route.fromFlag}</span>
          <span className="hidden xs:inline">{route.from}</span>
          <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="text-xs sm:text-sm">{route.toFlag}</span>
          <span className="truncate">{route.to}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-1 sm:gap-2">
        <span className="text-lg sm:text-xl font-bold text-slate-900">USD {route.price}</span>
        <span className="text-[10px] sm:text-xs text-slate-500 font-light">à partir de</span>
      </div>
    </motion.div>
  );

  return (
    <section className="relative bg-slate-50 text-slate-800 overflow-hidden py-8 sm:py-12 md:py-16">
      {/* Notification Bell */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative z-20 flex justify-center mb-4 sm:mb-6 md:mb-8"
      >
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="bg-[#007cb5] text-white p-2 sm:p-3 rounded-full shadow-lg shadow-[#007cb5]/20 cursor-pointer"
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
        </motion.div>
      </motion.div>

      {/* Section Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-6 sm:mb-8 md:mb-10 px-4"
      >
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-medium text-slate-900 uppercase tracking-tight mb-2 sm:mb-4">
          Réservez votre fret
        </h2>
        <p className="text-slate-600 text-sm sm:text-base md:text-lg font-light max-w-2xl mx-auto">
          Trouvez les meilleurs tarifs pour vos expéditions internationales
        </p>
      </motion.div>

      {/* Main Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 md:px-6">
        {/* Top Control Bar - Responsive */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8">
          {/* Stats Row - Mobile: 2x2 grid, Desktop: inline */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="bg-white backdrop-blur-xl border border-slate-200 rounded-xl sm:rounded-2xl p-2 sm:p-3 md:p-4 flex items-center justify-between hover:shadow-md transition duration-300"
              >
                <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
                  <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#007cb5]" />
                  <span className="text-xs sm:text-sm font-medium text-slate-600">{stat.label}</span>
                </div>
                <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-900">{stat.value}</span>
              </motion.div>
            ))}
          </div>

          {/* Center Search Module */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-2xl mx-auto bg-white rounded-2xl sm:rounded-3xl p-2 sm:p-3 shadow-xl border border-slate-200"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              <div className="bg-slate-100 rounded-lg sm:rounded-xl flex items-center px-3 sm:px-4 py-2.5 sm:py-3 focus-within:ring-2 focus-within:ring-[#007cb5] transition">
                <MapPin className="w-4 h-4 text-[#007cb5] mr-2 sm:mr-3 flex-shrink-0" />
                <input
                  type="text"
                  defaultValue="Chine"
                  className="bg-transparent border-none text-xs sm:text-sm text-slate-900 placeholder-slate-500 w-full focus:outline-none"
                  placeholder="Source"
                />
              </div>
              <div className="bg-slate-100 rounded-lg sm:rounded-xl flex items-center px-3 sm:px-4 py-2.5 sm:py-3 focus-within:ring-2 focus-within:ring-[#007cb5] transition">
                <MapPin className="w-4 h-4 text-[#007cb5] mr-2 sm:mr-3 flex-shrink-0" />
                <input
                  type="text"
                  className="bg-transparent border-none text-xs sm:text-sm text-slate-900 placeholder-slate-500 w-full focus:outline-none"
                  placeholder="Destination"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-slate-100 rounded-lg sm:rounded-xl flex items-center px-3 sm:px-4 py-2.5 sm:py-3 focus-within:ring-2 focus-within:ring-[#007cb5] transition">
                <Calendar className="w-4 h-4 text-[#007cb5] mr-2 sm:mr-3 flex-shrink-0" />
                <input
                  type="date"
                  defaultValue="2025-07-07"
                  className="bg-transparent border-none text-xs sm:text-sm text-slate-900 placeholder-slate-500 w-full focus:outline-none"
                />
              </div>
              <div className="bg-slate-100 rounded-lg sm:rounded-xl flex items-center px-3 sm:px-4 py-2.5 sm:py-3 focus-within:ring-2 focus-within:ring-[#007cb5] transition">
                <Package className="w-4 h-4 text-[#007cb5] mr-2 sm:mr-3 flex-shrink-0" />
                <input
                  type="text"
                  className="bg-transparent border-none text-xs sm:text-sm text-slate-900 placeholder-slate-500 w-full focus:outline-none"
                  placeholder="100kg/0.5m³"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] p-4 sm:p-6 pt-6 sm:pt-8 md:pt-10 pb-6 sm:pb-8 md:pb-10 shadow-lg border border-slate-200">

          {/* Section Chine vers Europe/Amérique - Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 sm:mb-6"
          >
            <button
              onClick={() => setIsEuropeOpen(!isEuropeOpen)}
              className="w-full flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-[#007cb5]/10 to-[#007cb5]/5 hover:from-[#007cb5]/15 hover:to-[#007cb5]/10 rounded-xl sm:rounded-2xl transition-all duration-300 group"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl">🌍</span>
                <h3 className="text-base sm:text-lg md:text-xl font-medium text-slate-900 tracking-tight text-left">
                  Chine vers Europe & Amérique
                </h3>
                <span className="hidden sm:inline-block bg-[#007cb5] text-white text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium">
                  {routesInternational.length} destinations
                </span>
              </div>
              <motion.div
                animate={{ rotate: isEuropeOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-full p-1.5 sm:p-2 shadow-sm group-hover:shadow-md transition-shadow"
              >
                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#007cb5]" />
              </motion.div>
            </button>
          </motion.div>

          <AnimatePresence>
            {isEuropeOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  whileInView="animate"
                  viewport={{ once: true }}
                  className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-6 sm:mb-8 md:mb-12"
                >
                  {routesInternational.map((route, index) => (
                    <RouteCard key={index} route={route} index={index} />
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Section Chine vers Afrique - Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 sm:mb-6"
          >
            <button
              onClick={() => setIsAfricaOpen(!isAfricaOpen)}
              className="w-full flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-amber-500/10 to-amber-500/5 hover:from-amber-500/15 hover:to-amber-500/10 rounded-xl sm:rounded-2xl transition-all duration-300 group"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl">🌍</span>
                <h3 className="text-base sm:text-lg md:text-xl font-medium text-slate-900 tracking-tight text-left">
                  Chine vers Afrique
                </h3>
                <span className="hidden sm:inline-block bg-amber-500 text-white text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium">
                  {routesAfrica.length} destinations
                </span>
              </div>
              <motion.div
                animate={{ rotate: isAfricaOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-full p-1.5 sm:p-2 shadow-sm group-hover:shadow-md transition-shadow"
              >
                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              </motion.div>
            </button>
          </motion.div>

          <AnimatePresence>
            {isAfricaOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  whileInView="animate"
                  viewport={{ once: true }}
                  className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-6 sm:mb-8 md:mb-12"
                >
                  {routesAfrica.map((route, index) => (
                    <RouteCard key={index} route={route} index={index} />
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Value Proposition Section */}
          <div className="mt-8 sm:mt-10 md:mt-12 mb-2 sm:mb-4">
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-lg sm:text-xl md:text-2xl font-medium text-slate-900 text-center mb-6 sm:mb-8 md:mb-10 tracking-tight"
            >
              Pourquoi nos clients nous font confiance
            </motion.h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-[#007cb5]/5 to-[#007cb5]/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 border border-[#007cb5]/20 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-[#007cb5]/10 rounded-full blur-3xl group-hover:bg-[#007cb5]/20 transition duration-700"></div>
                <h4 className="text-base sm:text-lg md:text-xl font-medium text-slate-900 mb-2 sm:mb-3 tracking-tight">
                  Solutions de transport fiables
                </h4>
                <p className="text-sm sm:text-base text-slate-600 font-light leading-relaxed">
                  Livraison rapide et sécurisée par route, rail ou air, garantissant que votre cargaison arrive en toute sécurité et à temps.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 border border-cyan-200 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-cyan-300/20 rounded-full blur-3xl group-hover:bg-cyan-300/30 transition duration-700"></div>
                <h4 className="text-base sm:text-lg md:text-xl font-medium text-slate-900 mb-2 sm:mb-3 tracking-tight">
                  Expédition Chine-Afrique
                </h4>
                <p className="text-sm sm:text-base text-slate-600 font-light leading-relaxed">
                  Expédition rapide et fiable vers toutes les destinations africaines, avec une gestion simplifiée des douanes.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TwinskBooking;
