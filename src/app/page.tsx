import TwinskHero from '@/components/sections/TwinskHero';
import TwinskServices from '@/components/sections/TwinskServices';
import TwinskStats from '@/components/sections/TwinskStats';
import TwinskTech from '@/components/sections/TwinskTech';
import TwinskProcess from '@/components/sections/TwinskProcess';
import TwinskTestimonials from '@/components/sections/TwinskTestimonials';
import TwinskFooter from '@/components/sections/TwinskFooter';

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <TwinskHero />
      <TwinskServices />
      <TwinskStats />
      <TwinskTech />
      <TwinskProcess />
      <TwinskTestimonials />
      <TwinskFooter />
    </div>
  );
}
