'use client';

import gsap from 'gsap';
import { useEffect, useRef } from 'react';

const CITIES = ['Libreville', 'Lagos', 'Abidjan', 'Dakar'];

export default function HeroCargoDrop() {
  const stageRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const cityTagRef = useRef<HTMLSpanElement>(null);
  const planeRef = useRef<SVGSVGElement>(null);
  const cargoRef = useRef<HTMLDivElement>(null);
  const parachuteRef = useRef<SVGSVGElement>(null);
  const puffRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const accentRef = useRef<HTMLSpanElement>(null);
  const trajWrapRef = useRef<SVGSVGElement>(null);
  const trajPathRef = useRef<SVGPathElement>(null);
  const cityIdxRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let timeoutId: number | undefined;

    const ctx = gsap.context(() => {
      const buildTimeline = () => {
        if (!mounted || !stageRef.current) return;
        const stage = stageRef.current;
        const w = stage.clientWidth;
        const h = stage.clientHeight;

        // Reset state
        gsap.set(brandRef.current, { opacity: 0, x: -16 });
        gsap.set(planeRef.current, { left: -w * 0.35, rotation: 0, y: 0 });
        gsap.set(cargoRef.current, {
          opacity: 0,
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          left: w * 0.5,
          top: h * 0.3,
        });
        gsap.set(parachuteRef.current, { scale: 0, opacity: 1 });
        gsap.set(puffRef.current, { opacity: 0, scale: 0 });
        gsap.set(ctaRef.current, { opacity: 0, y: 30 });
        gsap.set(accentRef.current, { backgroundSize: '0% 6px' });
        gsap.set(trajWrapRef.current, { opacity: 0 });
        gsap.set(trajPathRef.current, { attr: { d: '' } });

        if (cityTagRef.current) {
          cityTagRef.current.textContent = CITIES[cityIdxRef.current];
        }
        cityIdxRef.current = (cityIdxRef.current + 1) % CITIES.length;

        const releaseX = w * 0.5;
        const releaseY = h * 0.3;
        const landX = w * 0.5 + w * 0.05;
        const landY = h * 0.66;

        const tl = gsap.timeline({
          onComplete: () => {
            if (!mounted) return;
            timeoutId = window.setTimeout(buildTimeline, 1000);
          },
        });

        // Brand
        tl.to(
          brandRef.current,
          { opacity: 1, x: 0, duration: 0.7, ease: 'power2.out' },
          0,
        );

        // Plane crosses
        tl.to(
          planeRef.current,
          { left: w + w * 0.15, duration: 6.2, ease: 'none' },
          0.2,
        );
        tl.to(
          planeRef.current,
          {
            rotation: 1.2,
            y: 4,
            duration: 1.6,
            yoyo: true,
            repeat: 3,
            ease: 'sine.inOut',
          },
          0.2,
        );

        // Trajectory dashed line
        const pathD = `M${releaseX},${releaseY} Q${releaseX + w * 0.04},${(releaseY + landY) / 2} ${landX},${landY}`;
        tl.set(trajWrapRef.current, { opacity: 1 }, 2.5);
        tl.set(trajPathRef.current, { attr: { d: pathD } }, 2.5);

        // Package release
        tl.set(cargoRef.current, { opacity: 1 }, 2.5);
        tl.to(
          cargoRef.current,
          { y: h * 0.06, duration: 0.55, ease: 'power1.in' },
          2.5,
        );

        // Parachute deploys
        tl.to(
          parachuteRef.current,
          { scale: 1, duration: 0.45, ease: 'back.out(2.2)' },
          3.05,
        );

        // Slow descent + drift + sway
        tl.to(
          cargoRef.current,
          {
            x: landX - releaseX,
            y: landY - releaseY,
            duration: 2.7,
            ease: 'power1.inOut',
          },
          3.05,
        );
        tl.to(
          cargoRef.current,
          {
            rotation: 5,
            duration: 1.0,
            yoyo: true,
            repeat: 2,
            ease: 'sine.inOut',
          },
          3.15,
        );

        // Landing puff
        tl.set(
          puffRef.current,
          { left: landX, top: landY + h * 0.02, xPercent: -50, yPercent: -50 },
          5.75,
        );
        tl.to(
          puffRef.current,
          { opacity: 1, scale: 1.4, duration: 0.4, ease: 'power3.out' },
          5.75,
        );
        tl.to(
          puffRef.current,
          { opacity: 0, scale: 1.8, duration: 0.6, ease: 'power2.out' },
          6.05,
        );

        // Package landing bounce + parachute collapse
        tl.to(
          cargoRef.current,
          {
            scale: 1.08,
            duration: 0.12,
            yoyo: true,
            repeat: 1,
            ease: 'power2.out',
          },
          5.75,
        );
        tl.to(
          parachuteRef.current,
          { scale: 0.7, opacity: 0.35, duration: 0.6, ease: 'power2.in' },
          5.75,
        );

        // CTA reveal
        tl.to(
          ctaRef.current,
          { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
          6.1,
        );
        tl.to(
          accentRef.current,
          { backgroundSize: '100% 6px', duration: 0.5, ease: 'power2.out' },
          6.55,
        );

        // Hold final frame
        tl.to({}, { duration: 1.2 }, 7.4);
      };

      buildTimeline();
    }, stageRef);

    return () => {
      mounted = false;
      if (timeoutId) window.clearTimeout(timeoutId);
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={stageRef}
      className="relative w-full aspect-square rounded-3xl overflow-hidden border border-slate-200 bg-gradient-to-br from-white via-lime-soft/30 to-white shadow-xl shadow-slate-900/5"
    >
      {/* Soft lime glow overlays */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 80% 18%, rgba(163,230,53,0.22) 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, rgba(163,230,53,0.10) 0%, transparent 60%)',
        }}
      />

      {/* Sun (top-right) */}
      <div
        aria-hidden
        className="absolute top-[8%] right-[10%] w-16 h-16 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 35% 35%, #ecfccb 0%, #a3e635 70%)',
          boxShadow:
            '0 0 50px rgba(163,230,53,0.45), 0 0 100px rgba(163,230,53,0.25)',
        }}
      />

      {/* Brand badge */}
      <div
        ref={brandRef}
        className="absolute top-5 left-5 flex items-center gap-2 text-[10px] font-bold tracking-[0.14em] uppercase text-slate-900 opacity-0 z-10"
      >
        <span className="w-[22px] h-[22px] rounded-md border border-slate-900 text-slate-900 inline-flex items-center justify-center font-display text-xs bg-white">
          T
        </span>
        <span>Twinsk</span>
        <span className="opacity-30">·</span>
        <span ref={cityTagRef} className="text-lime-600 font-bold">
          Libreville
        </span>
      </div>

      {/* Trajectory dashed line */}
      <svg
        ref={trajWrapRef}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-0"
      >
        <path
          ref={trajPathRef}
          d=""
          fill="none"
          stroke="#84cc16"
          strokeWidth="1.8"
          strokeDasharray="6 5"
          strokeLinecap="round"
          opacity="0.85"
        />
      </svg>

      {/* African city silhouette */}
      <svg
        aria-hidden
        viewBox="0 0 1280 280"
        preserveAspectRatio="none"
        className="absolute left-0 right-0 bottom-0 w-full h-[34%] pointer-events-none"
      >
        <path
          d="M0,180 L80,180 L80,140 L140,140 L140,165 L210,165 L210,120 L260,120 L260,160 L320,160 L320,130 L380,130 L380,170 L460,170 L460,150 L520,150 L520,175 L600,175 L600,135 L660,135 L660,170 L740,170 L740,155 L820,155 L820,120 L880,120 L880,160 L960,160 L960,140 L1040,140 L1040,170 L1120,170 L1120,150 L1200,150 L1200,175 L1280,175 L1280,280 L0,280 Z"
          fill="#475569"
          opacity="0.55"
        />
        <path
          d="M0,210 L60,210 L60,180 L130,180 L130,200 L220,200 L220,170 L300,170 L300,205 L380,205 L380,190 L470,190 L470,210 L560,210 L560,180 L650,180 L650,200 L760,200 L760,175 L850,175 L850,205 L940,205 L940,185 L1040,185 L1040,210 L1140,210 L1140,195 L1280,195 L1280,280 L0,280 Z"
          fill="#0f172a"
        />
        <g fill="#a3e635" opacity="0.95">
          <rect x="92" y="195" width="3" height="3" />
          <rect x="100" y="195" width="3" height="3" />
          <rect x="92" y="202" width="3" height="3" />
          <rect x="240" y="180" width="3" height="3" />
          <rect x="248" y="180" width="3" height="3" />
          <rect x="240" y="188" width="3" height="3" />
          <rect x="320" y="215" width="3" height="3" />
          <rect x="328" y="215" width="3" height="3" />
          <rect x="500" y="200" width="3" height="3" />
          <rect x="600" y="190" width="3" height="3" />
          <rect x="800" y="185" width="3" height="3" />
          <rect x="808" y="185" width="3" height="3" />
          <rect x="800" y="193" width="3" height="3" />
          <rect x="970" y="195" width="3" height="3" />
          <rect x="1080" y="200" width="3" height="3" />
          <rect x="1170" y="205" width="3" height="3" />
        </g>
        <g fill="#0f172a">
          <path d="M70,280 Q72,250 75,225 Q70,210 78,200 Q90,205 96,195 Q88,210 100,212 Q92,222 102,225 Q90,228 95,240 Q82,238 80,250 Q78,265 75,280 Z" />
          <rect x="72" y="240" width="5" height="40" />
          <path d="M1190,280 Q1188,250 1185,225 Q1190,210 1182,200 Q1170,205 1164,195 Q1172,210 1160,212 Q1168,222 1158,225 Q1170,228 1165,240 Q1178,238 1180,250 Q1182,265 1185,280 Z" />
          <rect x="1183" y="240" width="5" height="40" />
        </g>
      </svg>

      {/* Cargo plane */}
      <svg
        ref={planeRef}
        viewBox="0 0 220 90"
        aria-hidden
        className="absolute"
        style={{
          top: '22%',
          left: '-200px',
          width: '40%',
          height: 'auto',
          filter: 'drop-shadow(0 10px 18px rgba(15,23,42,0.18))',
          zIndex: 3,
        }}
      >
        <defs>
          <linearGradient id="hcdBodyGrad" x1="0" x2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>
        <polygon points="15,42 30,12 50,40" fill="#a3e635" />
        <polygon points="10,45 0,52 35,52" fill="#a3e635" />
        <ellipse
          cx="115"
          cy="45"
          rx="95"
          ry="11"
          fill="url(#hcdBodyGrad)"
          stroke="#cbd5e1"
          strokeWidth="0.8"
        />
        <path
          d="M195,42 Q205,42 208,46 L205,49 Q200,48 192,49 Z"
          fill="#0f172a"
        />
        <g fill="#0f172a">
          <circle cx="75" cy="45" r="1.8" />
          <circle cx="90" cy="45" r="1.8" />
          <circle cx="105" cy="45" r="1.8" />
          <circle cx="120" cy="45" r="1.8" />
          <circle cx="135" cy="45" r="1.8" />
          <circle cx="150" cy="45" r="1.8" />
          <circle cx="165" cy="45" r="1.8" />
        </g>
        <polygon points="95,52 130,52 155,75 100,75" fill="#a3e635" />
        <ellipse cx="118" cy="73" rx="14" ry="5" fill="#0f172a" />
        <ellipse cx="142" cy="73" rx="11" ry="4" fill="#0f172a" />
        <line
          x1="100"
          y1="62"
          x2="148"
          y2="62"
          stroke="#84cc16"
          strokeWidth="1"
        />
      </svg>

      {/* Cargo (parachute + crate) */}
      <div
        ref={cargoRef}
        className="absolute opacity-0 will-change-transform"
        style={{ width: '13%', zIndex: 4, transform: 'translateX(-50%)' }}
      >
        <svg
          ref={parachuteRef}
          viewBox="0 0 110 70"
          aria-hidden
          className="absolute"
          style={{
            left: '50%',
            top: '-95%',
            transform: 'translateX(-50%) scale(0)',
            transformOrigin: '50% 100%',
            width: '170%',
            height: 'auto',
          }}
        >
          <path
            d="M5,40 Q55,-12 105,40 L92,38 L83,55 L75,38 L65,55 L55,38 L45,55 L35,38 L27,55 L18,38 Z"
            fill="#a3e635"
            stroke="#84cc16"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <g
            stroke="#0f172a"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.7"
          >
            <line x1="18" y1="40" x2="42" y2="68" />
            <line x1="35" y1="34" x2="48" y2="68" />
            <line x1="55" y1="28" x2="55" y2="68" />
            <line x1="75" y1="34" x2="62" y2="68" />
            <line x1="92" y1="40" x2="68" y2="68" />
          </g>
        </svg>
        <div className="relative mx-auto w-full" style={{ aspectRatio: '1 / 1' }}>
          <div
            className="absolute inset-0 rounded-[6px] border-2 flex items-center justify-center"
            style={{
              background:
                'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
              borderColor: '#78350f',
              boxShadow: '0 10px 22px rgba(15,23,42,0.25)',
            }}
          >
            <span
              className="font-display text-[9px] font-extrabold text-lime tracking-wider relative z-[2]"
              style={{ textShadow: '0 1px 0 rgba(0,0,0,0.45)' }}
            >
              TWINSK
            </span>
            <span
              aria-hidden
              className="absolute left-[-2px] right-[-2px] top-1/2 h-1 bg-lime -translate-y-1/2"
            />
            <span
              aria-hidden
              className="absolute top-[-2px] bottom-[-2px] left-1/2 w-1 bg-lime -translate-x-1/2"
            />
          </div>
        </div>
      </div>

      {/* Landing puff */}
      <div
        ref={puffRef}
        className="absolute pointer-events-none"
        style={{
          width: '22%',
          height: '11%',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(163,230,53,0.55) 0%, rgba(163,230,53,0) 70%)',
          opacity: 0,
          zIndex: 4,
        }}
      />

      {/* CTA inside the stage */}
      <div
        ref={ctaRef}
        className="absolute left-1/2 -translate-x-1/2 text-center opacity-0 z-[6] px-6"
        style={{ bottom: '6%', maxWidth: '92%' }}
      >
        <span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] uppercase text-lime-600 mb-2">
          <span className="w-6 h-px bg-lime" />
          Livraison Twinsk
          <span className="w-6 h-px bg-lime" />
        </span>
        <h3
          className="font-display uppercase tracking-tight text-slate-900 leading-[0.95] mb-3"
          style={{ fontSize: 'clamp(20px, 3.4vw, 30px)', fontWeight: 800 }}
        >
          Livrés{' '}
          <span
            ref={accentRef}
            className="text-lime relative inline-block"
            style={{
              backgroundImage:
                'linear-gradient(transparent calc(100% - 6px), #a3e635 6px)',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'left bottom',
              backgroundSize: '0% 6px',
            }}
          >
            partout
          </span>{' '}
          en Afrique
        </h3>
        <a
          href="/freight"
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-colors"
        >
          Demander une cotation
          <span className="inline-flex w-4 h-4 items-center justify-center bg-lime text-slate-900 rounded-full text-[10px]">
            →
          </span>
        </a>
      </div>
    </div>
  );
}
