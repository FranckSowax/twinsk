import TwinskHero from '@/components/sections/TwinskHero';
import TwinskServices from '@/components/sections/TwinskServices';
import TwinskStats from '@/components/sections/TwinskStats';
import TwinskBooking from '@/components/sections/TwinskBooking';
import TwinskTech from '@/components/sections/TwinskTech';
import TwinskProcess from '@/components/sections/TwinskProcess';
import TwinskTestimonials from '@/components/sections/TwinskTestimonials';
import TwinskFooter from '@/components/sections/TwinskFooter';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <TwinskHero />
      <TwinskServices />
      <TwinskStats />
      <TwinskBooking />
      <TwinskProcess />
      <TwinskTech />
      <TwinskTestimonials />
      <TwinskFooter />
    </div>
  );
}
