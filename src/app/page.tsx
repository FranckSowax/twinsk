import HeroPro from '@/components/sections/HeroPro';
import ServicesBento from '@/components/sections/ServicesBento';
import TrustStats from '@/components/sections/TrustStats';
import HowItWorks from '@/components/sections/HowItWorks';
import FreightTeaser from '@/components/sections/FreightTeaser';
import TwinskSampling from '@/components/sections/TwinskSampling';
import TwinskYouTubeShop from '@/components/sections/TwinskYouTubeShop';
import TwinskCarsImport from '@/components/sections/TwinskCarsImport';
import TwinskDelegations from '@/components/sections/TwinskDelegations';
import Testimonials from '@/components/sections/Testimonials';
import FAQ from '@/components/sections/FAQ';
import FinalCTA from '@/components/sections/FinalCTA';
import TwinskFooter from '@/components/sections/TwinskFooter';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <HeroPro />
      <ServicesBento />
      <TrustStats />
      <HowItWorks />
      <FreightTeaser />
      <TwinskYouTubeShop />
      <TwinskCarsImport />
      <section className="relative px-3 sm:px-5 lg:px-6 py-16 lg:py-24 border-t border-slate-200">
        <div className="max-w-[1600px] mx-auto px-2 sm:px-4 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <TwinskSampling />
          <TwinskDelegations />
        </div>
      </section>
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <TwinskFooter />
    </div>
  );
}
