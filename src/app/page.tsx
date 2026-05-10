import TwinskHero from '@/components/sections/TwinskHero';
import TwinskFreightCalculator from '@/components/sections/TwinskFreightCalculator';
import TwinskSampling from '@/components/sections/TwinskSampling';
import TwinskYouTubeShop from '@/components/sections/TwinskYouTubeShop';
import TwinskQuickQuote from '@/components/sections/TwinskQuickQuote';
import TwinskCarsImport from '@/components/sections/TwinskCarsImport';
import TwinskDelegations from '@/components/sections/TwinskDelegations';
import TwinskBooking from '@/components/sections/TwinskBooking';
import TwinskProcess from '@/components/sections/TwinskProcess';
import TwinskStats from '@/components/sections/TwinskStats';
import TwinskTestimonials from '@/components/sections/TwinskTestimonials';
import TwinskFooter from '@/components/sections/TwinskFooter';

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <TwinskHero />
      <TwinskFreightCalculator />
      <TwinskYouTubeShop />
      <TwinskQuickQuote />
      <TwinskCarsImport />
      <TwinskSampling />
      <TwinskDelegations />
      <TwinskBooking />
      <TwinskProcess />
      <TwinskStats />
      <TwinskTestimonials />
      <TwinskFooter />
    </div>
  );
}
