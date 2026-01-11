'use client';

import { motion } from 'framer-motion';
import { Twitter, Linkedin, Github, Mail, Phone, MapPin } from 'lucide-react';
import { fadeInUp } from '../../lib/animations';

const Footer = () => {
  const socialLinks = [
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
    { icon: Github, href: '#', label: 'GitHub' }
  ];

  const footerLinks = {
    produit: [
      { label: 'Fonctionnalités', href: '#features' },
      { label: 'Tarifs', href: '#pricing' },
      { label: 'Documentation', href: '#docs' },
      { label: 'API', href: '#api' }
    ],
    entreprise: [
      { label: 'À propos', href: '#about' },
      { label: 'Blog', href: '#blog' },
      { label: 'Carrières', href: '#careers' },
      { label: 'Presse', href: '#press' }
    ],
    support: [
      { label: 'Centre d\'aide', href: '#help' },
      { label: 'Contact', href: '#contact' },
      { label: 'Statut', href: '#status' },
      { label: 'Communauté', href: '#community' }
    ]
  };

  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8">
            {/* Brand Section */}
            <motion.div
              variants={fadeInUp}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="space-y-4"
            >
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg mr-2"></div>
                <span className="text-xl font-bold">YourBrand</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Nous créons des expériences web exceptionnelles qui transforment vos idées en succès numérique.
              </p>
              <div className="flex space-x-4">
                {socialLinks.map((social, index) => (
                  <motion.a
                    key={social.label}
                    href={social.href}
                    whileHover={{ scale: 1.1, y: -2 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
                    aria-label={social.label}
                  >
                    <social.icon className="w-5 h-5" />
                  </motion.a>
                ))}
              </div>
            </motion.div>

            {/* Links Sections */}
            {Object.entries(footerLinks).map(([category, links], categoryIndex) => (
              <motion.div
                key={category}
                variants={fadeInUp}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
                transition={{ delay: categoryIndex * 0.1 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold capitalize">
                  {category === 'produit' ? 'Produit' : category === 'entreprise' ? 'Entreprise' : 'Support'}
                </h3>
                <ul className="space-y-2">
                  {links.map((link, linkIndex) => (
                    <motion.li
                      key={link.label}
                      whileHover={{ x: 5 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <a
                        href={link.href}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="border-t border-gray-800 py-8"
        >
          <div className="grid md:grid-cols-3 gap-8 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-3">
              <Mail className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400">contact@yourbrand.com</span>
            </div>
            <div className="flex items-center justify-center md:justify-start space-x-3">
              <Phone className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400">+33 1 23 45 67 89</span>
            </div>
            <div className="flex items-center justify-center md:justify-start space-x-3">
              <MapPin className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400">Paris, France</span>
            </div>
          </div>
        </motion.div>

        {/* Bottom Section */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="border-t border-gray-800 py-6"
        >
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-400 text-sm">
              © 2024 YourBrand. Tous droits réservés.
            </p>
            <div className="flex space-x-6 text-sm">
              <a href="#privacy" className="text-gray-400 hover:text-white transition-colors">
                Politique de confidentialité
              </a>
              <a href="#terms" className="text-gray-400 hover:text-white transition-colors">
                Conditions d'utilisation
              </a>
              <a href="#cookies" className="text-gray-400 hover:text-white transition-colors">
                Cookies
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
