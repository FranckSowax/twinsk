import HeroPro from '@/components/sections/HeroPro';
import ServicesBento from '@/components/sections/ServicesBento';
import TwinskFreightCalculator from '@/components/sections/TwinskFreightCalculator';
import TwinskSampling from '@/components/sections/TwinskSampling';
import TwinskYouTubeShop from '@/components/sections/TwinskYouTubeShop';
import TwinskQuickQuote from '@/components/sections/TwinskQuickQuote';
import TwinskCarsImport from '@/components/sections/TwinskCarsImport';
import TwinskDelegations from '@/components/sections/TwinskDelegations';
import TwinskStats from '@/components/sections/TwinskStats';
import TwinskTestimonials from '@/components/sections/TwinskTestimonials';
import TwinskFooter from '@/components/sections/TwinskFooter';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <HeroPro />
      <ServicesBento />
      <TwinskFreightCalculator />
      <TwinskQuickQuote />
      <TwinskYouTubeShop />
      <TwinskCarsImport />
      <section className="relative px-3 sm:px-5 lg:px-6 py-16 lg:py-24 border-t border-forest/5">
        <div className="max-w-[1600px] mx-auto px-2 sm:px-4 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <TwinskSampling />
          <TwinskDelegations />
        </div>
      </section>
      <TwinskStats />
      <TwinskTestimonials />
      <TwinskFooter />
    </div>
  );
}
