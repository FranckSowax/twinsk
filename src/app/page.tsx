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
    <div className="min-h-screen bg-forest p-2 sm:p-3 lg:p-4">
      <div className="bg-cream rounded-[28px] sm:rounded-[32px] overflow-hidden shadow-[0_10px_40px_-15px_rgba(0,0,0,0.25)]">
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
    </div>
  );
}
