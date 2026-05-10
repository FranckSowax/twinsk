'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  /** Two-digit section index, eg "01" */
  index: string;
  /** Short label below the index, eg "Logistique" */
  kicker: string;
  /** Main editorial title — supports JSX for line breaks and accents */
  title: ReactNode;
  /** Lead body paragraph */
  lead?: ReactNode;
  /** Visual accent color theme */
  accent?: 'forest' | 'lime' | 'cream' | 'red';
  /** Right-side metadata (e.g., trust marks, KPIs) */
  meta?: ReactNode;
  /** Center-align text instead of left */
  align?: 'left' | 'center';
  className?: string;
}

const ACCENT_RULE: Record<NonNullable<SectionHeaderProps['accent']>, string> = {
  forest: 'bg-forest',
  lime: 'bg-lime',
  cream: 'bg-forest/30',
  red: 'bg-red-600',
};

const ACCENT_TEXT: Record<NonNullable<SectionHeaderProps['accent']>, string> = {
  forest: 'text-forest',
  lime: 'text-forest',
  cream: 'text-forest/70',
  red: 'text-red-600',
};

const TITLE_ACCENT: Record<NonNullable<SectionHeaderProps['accent']>, string> = {
  forest: 'text-forest',
  lime: 'text-forest',
  cream: 'text-forest',
  red: 'text-red-600',
};

export default function SectionHeader({
  index,
  kicker,
  title,
  lead,
  accent = 'forest',
  meta,
  align = 'left',
  className = '',
}: SectionHeaderProps) {
  const isCentered = align === 'center';
  return (
    <div className={className} data-accent={accent}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: [0.215, 0.61, 0.355, 1] }}
        className={`flex items-center gap-3 ${isCentered ? 'justify-center' : ''}`}
      >
        <span className={`h-px w-10 ${ACCENT_RULE[accent]}`} />
        <span className={`kicker ${ACCENT_TEXT[accent]}`}>
          <span className="tabular-nums opacity-70">{index}</span>
          <span className="mx-2 opacity-30">/</span>
          {kicker}
        </span>
      </motion.div>

      <div
        className={`mt-5 grid gap-8 lg:gap-12 ${
          meta ? 'lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end' : 'grid-cols-1'
        } ${isCentered ? 'text-center' : ''}`}
      >
        <div className={isCentered ? 'mx-auto max-w-3xl' : 'max-w-3xl'}>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.215, 0.61, 0.355, 1] }}
            className={`font-display text-[40px] sm:text-5xl lg:text-[64px] font-medium leading-[0.95] tracking-tight uppercase ${TITLE_ACCENT[accent]}`}
          >
            {title}
          </motion.h2>

          {lead && (
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.215, 0.61, 0.355, 1] }}
              className="mt-5 max-w-xl text-base sm:text-[17px] leading-relaxed text-forest/70 font-light"
            >
              {lead}
            </motion.p>
          )}
        </div>

        {meta && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:pb-2"
          >
            {meta}
          </motion.div>
        )}
      </div>
    </div>
  );
}
