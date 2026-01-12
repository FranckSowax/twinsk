'use client';

import { motion } from 'framer-motion';
import { Bell, Truck, Ship, Train, Plane, MapPin, Calendar, Package, ArrowRight } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../lib/animations';

const TwinskBooking = () => {
  const stats = [
    { icon: Truck, label: 'Camions', value: '31,081' },
    { icon: Ship, label: 'Maritime', value: '215,076' },
    { icon: Train, label: 'Trains', value: '5,053' },
    { icon: Plane, label: 'Avions', value: '1,875' },
  ];

  // Routes Chine vers Europe/Amérique
  const routesInternational = [
    { from: 'Chine', fromFlag: '🇨🇳', to: 'France', toFlag: '🇫🇷' },
    { from: 'Chine', fromFlag: '🇨🇳', to: 'UK', toFlag: '🇬🇧' },
    { from: 'Chine', fromFlag: '🇨🇳', to: 'États-Unis', toFlag: '🇺🇸' },
    { from: 'Chine', fromFlag: '🇨🇳', to: 'Canada', toFlag: '🇨🇦' },
  ];

  // Routes Guangzhou vers Afrique
  const routesAfrica = [
    { from: 'Guangzhou', fromFlag: '🇨🇳', to: 'Libreville', toFlag: '🇬🇦' },
    { from: 'Guangzhou', fromFlag: '🇨🇳', to: 'Lomé', toFlag: '🇹🇬' },
    { from: 'Guangzhou', fromFlag: '🇨🇳', to: 'Abidjan', toFlag: '🇨🇮' },
    { from: 'Guangzhou', fromFlag: '🇨🇳', to: 'Niamey', toFlag: '🇳🇪' },
    { from: 'Guangzhou', fromFlag: '🇨🇳', to: 'Kinshasa', toFlag: '🇨🇩' },
    { from: 'Guangzhou', fromFlag: '🇨🇳', to: 'Dar es Salaam', toFlag: '🇹🇿' },
    { from: 'Guangzhou', fromFlag: '🇨🇳', to: 'Lagos', toFlag: '🇳🇬' },
  ];

  return (
    <section className="relative bg-slate-50 text-slate-800 overflow-hidden py-16">
      {/* Notification Bell */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative z-20 flex justify-center mb-8"
      >
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="bg-[#007cb5] text-white p-3 rounded-full shadow-lg shadow-[#007cb5]/20 cursor-pointer"
        >
          <Bell className="w-5 h-5" />
        </motion.div>
      </motion.div>

      {/* Section Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-10"
      >
        <h2 className="text-3xl md:text-4xl font-display font-medium text-slate-900 uppercase tracking-tight mb-4">
          Réservez votre fret
        </h2>
        <p className="text-slate-600 text-lg font-light max-w-2xl mx-auto">
          Trouvez les meilleurs tarifs pour vos expéditions Chine-Afrique
        </p>
      </motion.div>

      {/* Main Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top Control Bar */}
        <div className="flex flex-col xl:flex-row items-end justify-center gap-4 mb-8">
          {/* Left Stats */}
          <div className="flex gap-4 w-full xl:w-auto">
            {stats.slice(0, 2).map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="flex-1 xl:w-48 bg-white backdrop-blur-xl border border-slate-200 rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition duration-300"
              >
                <div className="flex items-center gap-3">
                  <stat.icon className="w-5 h-5 text-[#007cb5]" />
                  <span className="text-sm font-medium text-slate-600">{stat.label}</span>
                </div>
                <span className="text-base font-semibold text-slate-900">{stat.value}</span>
              </motion.div>
            ))}
          </div>

          {/* Center Search Module */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="w-full xl:w-[500px] bg-white rounded-3xl p-3 shadow-xl border border-slate-200 z-20 relative"
          >
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-slate-100 rounded-xl flex items-center px-4 py-3 focus-within:ring-2 focus-within:ring-[#007cb5] transition">
                <MapPin className="w-4 h-4 text-[#007cb5] mr-3" />
                <input
                  type="text"
                  defaultValue="Guangzhou, CN"
                  className="bg-transparent border-none text-sm text-slate-900 placeholder-slate-500 w-full focus:outline-none"
                  placeholder="Source"
                />
              </div>
              <div className="bg-slate-100 rounded-xl flex items-center px-4 py-3 focus-within:ring-2 focus-within:ring-[#007cb5] transition">
                <MapPin className="w-4 h-4 text-[#007cb5] mr-3" />
                <input
                  type="text"
                  className="bg-transparent border-none text-sm text-slate-900 placeholder-slate-500 w-full focus:outline-none"
                  placeholder="Destination"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-100 rounded-xl flex items-center px-4 py-3 focus-within:ring-2 focus-within:ring-[#007cb5] transition">
                <Calendar className="w-4 h-4 text-[#007cb5] mr-3" />
                <input
                  type="date"
                  defaultValue="2025-07-07"
                  className="bg-transparent border-none text-sm text-slate-900 placeholder-slate-500 w-full focus:outline-none"
                />
              </div>
              <div className="bg-slate-100 rounded-xl flex items-center px-4 py-3 focus-within:ring-2 focus-within:ring-[#007cb5] transition">
                <Package className="w-4 h-4 text-[#007cb5] mr-3" />
                <input
                  type="text"
                  className="bg-transparent border-none text-sm text-slate-900 placeholder-slate-500 w-full focus:outline-none"
                  placeholder="100kg/0.5m³"
                />
              </div>
            </div>
          </motion.div>

          {/* Right Stats */}
          <div className="flex gap-4 w-full xl:w-auto">
            {stats.slice(2, 4).map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (index + 2) * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="flex-1 xl:w-48 bg-white backdrop-blur-xl border border-slate-200 rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition duration-300"
              >
                <div className="flex items-center gap-3">
                  <stat.icon className="w-5 h-5 text-[#007cb5]" />
                  <span className="text-sm font-medium text-slate-600">{stat.label}</span>
                </div>
                <span className="text-base font-semibold text-slate-900">{stat.value}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-[2.5rem] p-6 pt-10 pb-10 shadow-lg border border-slate-200">
          {/* Section Chine vers Europe/Amérique */}
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl font-medium text-slate-900 mb-6 tracking-tight flex items-center gap-2"
          >
            <span className="text-2xl">🌍</span> Chine vers Europe & Amérique
          </motion.h3>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12"
          >
            {routesInternational.map((route, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                whileHover={{ y: -5, boxShadow: '0 10px 40px rgba(0,124,181,0.1)' }}
                className="bg-slate-50 hover:bg-white rounded-2xl p-5 transition duration-300 border border-slate-200 hover:border-[#007cb5]/30 cursor-pointer"
              >
                <div className="flex items-center justify-center gap-3 text-base font-medium text-slate-800">
                  <span className="text-lg">{route.fromFlag}</span>
                  <span>{route.from}</span>
                  <ArrowRight className="w-4 h-4 text-[#007cb5]" />
                  <span className="text-lg">{route.toFlag}</span>
                  <span>{route.to}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Section Guangzhou vers Afrique */}
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl font-medium text-slate-900 mb-6 tracking-tight flex items-center gap-2"
          >
            <span className="text-2xl">🌍</span> Guangzhou vers Afrique
          </motion.h3>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12"
          >
            {routesAfrica.map((route, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                whileHover={{ y: -5, boxShadow: '0 10px 40px rgba(0,124,181,0.1)' }}
                className="bg-slate-50 hover:bg-white rounded-2xl p-5 transition duration-300 border border-slate-200 hover:border-[#007cb5]/30 cursor-pointer"
              >
                <div className="flex items-center justify-center gap-3 text-base font-medium text-slate-800">
                  <span className="text-lg">{route.fromFlag}</span>
                  <span>{route.from}</span>
                  <ArrowRight className="w-4 h-4 text-[#007cb5]" />
                  <span className="text-lg">{route.toFlag}</span>
                  <span>{route.to}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Value Proposition Section */}
          <div className="mt-12 mb-4">
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-2xl font-medium text-slate-900 text-center mb-10 tracking-tight"
            >
              Pourquoi nos clients nous font confiance
            </motion.h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-[#007cb5]/5 to-[#007cb5]/10 rounded-3xl p-8 border border-[#007cb5]/20 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#007cb5]/10 rounded-full blur-3xl group-hover:bg-[#007cb5]/20 transition duration-700"></div>
                <h4 className="text-xl font-medium text-slate-900 mb-3 tracking-tight">
                  Solutions de transport fiables
                </h4>
                <p className="text-base text-slate-600 font-light leading-relaxed max-w-md">
                  Livraison rapide et sécurisée par route, rail ou air, garantissant que votre cargaison arrive en toute sécurité et à temps.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-3xl p-8 border border-cyan-200 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-300/20 rounded-full blur-3xl group-hover:bg-cyan-300/30 transition duration-700"></div>
                <h4 className="text-xl font-medium text-slate-900 mb-3 tracking-tight">
                  Expédition Chine-Afrique
                </h4>
                <p className="text-base text-slate-600 font-light leading-relaxed max-w-md">
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
