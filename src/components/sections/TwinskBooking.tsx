'use client';

import { motion } from 'framer-motion';
import { Bell, Truck, Car, Train, Plane, MapPin, Calendar, Package, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { fadeInUp, staggerContainer } from '../../lib/animations';

const TwinskBooking = () => {
  const stats = [
    { icon: Truck, label: 'Camions', value: '31,081' },
    { icon: Car, label: 'Local', value: '215,076' },
    { icon: Train, label: 'Trains', value: '5,053' },
    { icon: Plane, label: 'Avions', value: '1,875' },
  ];

  const routes = [
    { type: 'FCL', size: "20'ST", from: 'Shanghai', fromFlag: '🇨🇳', to: 'Le Havre', toFlag: '🇫🇷', price: '1,050' },
    { type: 'FCL', size: "40'ST", from: 'Shenzhen', fromFlag: '🇨🇳', to: 'Rotterdam', toFlag: '🇳🇱', price: '640' },
    { type: 'LCL', size: "40'ST", from: 'Ningbo', fromFlag: '🇨🇳', to: 'Lagos', toFlag: '🇳🇬', price: '550' },
    { type: 'LCL', size: "20'ST", from: 'Qingdao', fromFlag: '🇨🇳', to: 'Hamburg', toFlag: '🇩🇪', price: '2,330' },
    { type: 'FCL', size: "40'ST", from: 'Guangzhou', fromFlag: '🇨🇳', to: 'Mombasa', toFlag: '🇰🇪', price: '520' },
    { type: 'FCL', size: "20'ST", from: 'Tianjin', fromFlag: '🇨🇳', to: 'Barcelona', toFlag: '🇪🇸', price: '1,010' },
    { type: 'LCL', size: "20'ST", from: 'Xiamen', fromFlag: '🇨🇳', to: 'Cape Town', toFlag: '🇿🇦', price: '1,930' },
    { type: 'FCL', size: "20'ST", from: 'Dalian', fromFlag: '🇨🇳', to: 'Genoa', toFlag: '🇮🇹', price: '1,400' },
  ];

  return (
    <section className="relative bg-[#0d0f12] text-gray-300 overflow-hidden">
      {/* Background Image with Gradient Overlay */}
      <div className="absolute top-0 left-0 w-full h-[500px] z-0 pointer-events-none">
        <Image
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop"
          alt="Shipping Containers"
          fill
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0f12]/30 via-[#0d0f12]/90 to-[#0d0f12]"></div>
      </div>

      {/* Notification Bell */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative z-20 flex justify-center pt-12"
      >
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="bg-yellow-400 text-black p-3 rounded-full shadow-lg shadow-yellow-400/20 cursor-pointer"
        >
          <Bell className="w-5 h-5" />
        </motion.div>
      </motion.div>

      {/* Main Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-20 pt-8">
        {/* Top Control Bar */}
        <div className="flex flex-col xl:flex-row items-end justify-center gap-4 mb-6">
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
                className="flex-1 xl:w-48 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 transition duration-300"
              >
                <div className="flex items-center gap-3">
                  <stat.icon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-400">{stat.label}</span>
                </div>
                <span className="text-base font-medium text-white">{stat.value}</span>
              </motion.div>
            ))}
          </div>

          {/* Center Search Module */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="w-full xl:w-[500px] bg-[#1c1e24] rounded-3xl p-2 shadow-2xl border border-white/5 -mb-4 z-20 relative"
          >
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-[#252830] rounded-xl flex items-center px-4 py-3 focus-within:ring-1 focus-within:ring-gray-500 transition">
                <MapPin className="w-4 h-4 text-gray-500 mr-3" />
                <input
                  type="text"
                  defaultValue="Shanghai, CN"
                  className="bg-transparent border-none text-sm text-white placeholder-gray-500 w-full focus:outline-none"
                  placeholder="Source"
                />
              </div>
              <div className="bg-[#252830] rounded-xl flex items-center px-4 py-3 focus-within:ring-1 focus-within:ring-gray-500 transition">
                <MapPin className="w-4 h-4 text-gray-500 mr-3" />
                <input
                  type="text"
                  className="bg-transparent border-none text-sm text-white placeholder-gray-500 w-full focus:outline-none"
                  placeholder="Destination"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#252830] rounded-xl flex items-center px-4 py-3 focus-within:ring-1 focus-within:ring-gray-500 transition">
                <Calendar className="w-4 h-4 text-gray-500 mr-3" />
                <input
                  type="date"
                  defaultValue="2025-07-07"
                  className="bg-transparent border-none text-sm text-white placeholder-gray-500 w-full focus:outline-none"
                />
              </div>
              <div className="bg-[#252830] rounded-xl flex items-center px-4 py-3 focus-within:ring-1 focus-within:ring-gray-500 transition">
                <Package className="w-4 h-4 text-gray-500 mr-3" />
                <input
                  type="text"
                  className="bg-transparent border-none text-sm text-white placeholder-gray-500 w-full focus:outline-none"
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
                className="flex-1 xl:w-48 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 transition duration-300"
              >
                <div className="flex items-center gap-3">
                  <stat.icon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-400">{stat.label}</span>
                </div>
                <span className="text-base font-medium text-white">{stat.value}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-[#16181d] rounded-[2.5rem] p-6 pt-12 pb-10 shadow-2xl border border-white/5 min-h-[600px]">
          {/* Route Grid */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16"
          >
            {routes.map((route, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                whileHover={{ y: -5, borderColor: 'rgba(255,255,255,0.1)' }}
                className="bg-[#1c1e24] hover:bg-[#23262d] rounded-2xl p-6 transition duration-300 border border-transparent cursor-pointer"
              >
                <div className="text-xs text-gray-500 mb-4 font-medium tracking-wide">
                  {route.type} • {route.size}
                </div>
                <div className="flex flex-col gap-2 mb-6">
                  <div className="flex items-center gap-2 text-base font-medium text-gray-200">
                    <span>{route.from}</span>
                    <span className="text-xs">{route.fromFlag}</span>
                    <ArrowRight className="w-3 h-3 text-gray-600" />
                    <span className="text-xs">{route.toFlag}</span>
                    <span>{route.to}</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-medium text-white">USD {route.price}</span>
                  <span className="text-xs text-gray-600 font-light">à partir de</span>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Value Proposition Section */}
          <div className="mt-20 mb-8">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-2xl font-medium text-white text-center mb-10 tracking-tight"
            >
              Pourquoi nos clients nous font confiance
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-[#1c1e24] rounded-3xl p-8 border border-white/5 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition duration-700"></div>
                <h3 className="text-xl font-medium text-gray-100 mb-3 tracking-tight">
                  Solutions de transport fiables
                </h3>
                <p className="text-base text-gray-500 font-light leading-relaxed max-w-md">
                  Livraison rapide et sécurisée par route, rail ou air, garantissant que votre cargaison arrive en toute sécurité et à temps.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-[#1c1e24] rounded-3xl p-8 border border-white/5 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition duration-700"></div>
                <h3 className="text-xl font-medium text-gray-100 mb-3 tracking-tight">
                  Expédition mondiale, expertise locale
                </h3>
                <p className="text-base text-gray-500 font-light leading-relaxed max-w-md">
                  Expédition rapide et fiable vers toute destination dans le monde, avec une gestion simplifiée des douanes.
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
