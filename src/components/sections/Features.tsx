'use client';

import { motion } from 'framer-motion';
import { Zap, Shield, Globe, Smartphone, BarChart, Users } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../lib/animations';

const Features = () => {
  const features = [
    {
      icon: Zap,
      title: 'Performance Rapide',
      description: 'Des temps de chargement ultra-rapides pour une expérience utilisateur optimale.',
      gradient: 'from-yellow-400 to-orange-500'
    },
    {
      icon: Shield,
      title: 'Sécurité Maximale',
      description: 'Protection avancée de vos données et de celles de vos clients.',
      gradient: 'from-blue-400 to-cyan-500'
    },
    {
      icon: Globe,
      title: 'Déploiement Global',
      description: 'Distribution mondiale de votre application avec une latence minimale.',
      gradient: 'from-green-400 to-teal-500'
    },
    {
      icon: Smartphone,
      title: 'Design Responsive',
      description: 'Interface parfaite sur tous les appareils, du mobile au desktop.',
      gradient: 'from-purple-400 to-pink-500'
    },
    {
      icon: BarChart,
      title: 'Analytics Avancés',
      description: 'Suivi détaillé des performances et comportements des utilisateurs.',
      gradient: 'from-red-400 to-rose-500'
    },
    {
      icon: Users,
      title: 'Support 24/7',
      description: 'Équipe dédiée disponible à tout moment pour vous assister.',
      gradient: 'from-indigo-400 to-blue-500'
    }
  ];

  return (
    <section id="services" className="py-20 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.h2
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Des fonctionnalités qui
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              {' '}transforment
            </span>
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed"
          >
            Découvrez notre suite complète d'outils et de services conçus pour propulser votre entreprise vers de nouveaux sommets.
          </motion.p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -10 }}
              className="group relative"
            >
              <div className="relative p-8 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:shadow-2xl transition-all duration-300 h-full">
                {/* Icon */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className={`inline-flex p-4 bg-gradient-to-r ${feature.gradient} rounded-2xl mb-6`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </motion.div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover effect overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-2xl pointer-events-none"
                />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-20 text-center"
        >
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 relative overflow-hidden">
            {/* Background decoration */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              className="absolute top-10 right-10 w-32 h-32 border-4 border-white/20 rounded-full"
            />
            <motion.div
              animate={{ y: [-20, 20, -20] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-10 left-10 w-24 h-24 bg-white/10 rounded-2xl"
            />

            <div className="relative z-10">
              <h3 className="text-3xl font-bold text-white mb-4">
                Prêt à commencer votre projet ?
              </h3>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Rejoignez des centaines d'entreprises qui nous font déjà confiance pour leur transformation digitale.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white text-blue-600 px-8 py-4 rounded-full font-semibold hover:shadow-xl transition-all duration-300"
              >
                Discuter avec un expert
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
