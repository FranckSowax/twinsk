// Textes du pays de ce déploiement.
import { COUNTRY, type CountryCode } from '@/config/countries';
import type { CountryContent } from './types';
import GA from './GA';
import CI from './CI';

export const CONTENTS: Record<CountryCode, CountryContent> = { GA, CI };
export const CONTENT: CountryContent = CONTENTS[COUNTRY.code];
export type { CountryContent };
