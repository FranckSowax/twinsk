'use client';

import { useEffect } from 'react';

// CSS issu du document source (WE_ARE_KIN_Theme_Festival), augmente de
// breakpoints supplementaires pour une responsivite jusqu a ~320px.
const css = `
:root{
  --noir:#0B0A08; --noir2:#12100C; --noir3:#171410;
  --or:#C9A227; --champagne:#E2C97E; --ivoire:#F0E8D8;
  --gris:#9A9080; --ligne:rgba(201,162,39,.28); --ligne-faible:rgba(240,232,216,.10);
  --atlantique:#0E1820; --terre:#8A5A2B;
}
.kinova,.kinova *{margin:0;padding:0;box-sizing:border-box}
.kinova{background:var(--noir);color:var(--ivoire);font-family:'Inter',sans-serif;font-weight:300;line-height:1.7;font-size:16px;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.kinova ::selection{background:var(--or);color:var(--noir)}
.kinova .serif{font-family:'Cormorant Garamond',serif}
.kinova .gold{color:var(--or)}
.kinova em{font-style:italic}
.kinova .wrap{max-width:1180px;margin:0 auto;padding:0 7vw}
.kinova section{padding:110px 0;border-top:1px solid var(--ligne-faible)}
.kinova .eyebrow{font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--or);font-weight:500;margin-bottom:28px}
.kinova h1,.kinova h2,.kinova h3,.kinova h4{color:var(--ivoire)}
.kinova h2{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:clamp(30px,4.6vw,58px);line-height:1.08;letter-spacing:.01em;margin-bottom:30px}
.kinova h3{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:24px;line-height:1.2;margin-bottom:14px}
.kinova p.lead{font-family:'Cormorant Garamond',serif;font-size:clamp(18px,2.2vw,26px);line-height:1.45;color:var(--ivoire);max-width:760px}
.kinova p.body,.kinova li.body{color:var(--gris);max-width:680px;font-size:15.5px}
.kinova .kin{color:var(--or);font-weight:inherit}
.kinova .rule{width:54px;height:1px;background:var(--or);margin:34px 0}
.kinova .grid2{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:start}
.kinova .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--ligne-faible)}
.kinova .reveal{opacity:0;transform:translateY(26px);transition:opacity .9s ease,transform .9s ease}
.kinova .reveal.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.kinova{scroll-behavior:auto}.kinova .reveal{opacity:1;transform:none;transition:none}}

/* HERO */
.kinova .hero{min-height:96vh;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden;border-top:none;
  background:radial-gradient(1200px 600px at 78% 18%,rgba(201,162,39,.10),transparent 60%),
             radial-gradient(900px 500px at 12% 90%,rgba(138,90,43,.12),transparent 60%),var(--noir);padding:80px 0}
.kinova .hero .label{display:flex;gap:18px;align-items:center;flex-wrap:wrap;font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--gris);margin-bottom:54px}
.kinova .hero .label b{color:var(--or);font-weight:500}
.kinova .hero h1{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:clamp(56px,12vw,170px);line-height:.92;letter-spacing:.01em}
.kinova .hero h1 .dot{color:var(--or)}
.kinova .hero .triptyque{margin-top:46px;font-family:'Cormorant Garamond',serif;font-size:clamp(20px,3vw,34px);font-weight:400;color:var(--gris);display:flex;flex-wrap:wrap;gap:8px 34px}
.kinova .hero .triptyque span{white-space:nowrap}
.kinova .hero .pitch{margin-top:56px;max-width:640px;color:var(--ivoire);font-size:17px;line-height:1.8}
.kinova .hero .pitch .en{display:block;margin-top:18px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:21px;color:var(--champagne)}
.kinova .scroll-hint{position:absolute;bottom:34px;left:7vw;font-size:10px;letter-spacing:.4em;text-transform:uppercase;color:var(--gris)}

/* ARC */
.kinova .arc-band{background:linear-gradient(180deg,var(--noir) 0%,var(--atlantique) 26%,var(--atlantique) 74%,var(--noir) 100%);border-top:none;padding:90px 0}
.kinova .arc-svg{width:100%;height:auto;display:block}
.kinova .arc-caption{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:var(--gris);margin-top:8px}
.kinova .arc-caption b{color:var(--champagne);font-weight:500}

/* STATS */
.kinova .stat{background:var(--noir2);padding:44px 36px}
.kinova .stat .n{font-family:'Cormorant Garamond',serif;font-size:54px;font-weight:500;color:var(--champagne);line-height:1}
.kinova .stat .l{margin-top:14px;font-size:13px;color:var(--gris);line-height:1.6}
.kinova .stat .src{margin-top:10px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(154,144,128,.55)}

/* MANIFESTO */
.kinova .manifesto{background:var(--noir2)}
.kinova .manifesto blockquote{font-family:'Cormorant Garamond',serif;font-size:clamp(24px,3.4vw,42px);line-height:1.3;font-weight:400;max-width:900px}
.kinova .manifesto blockquote .kin{font-weight:600}
.kinova .kinword{font-family:'Cormorant Garamond',serif;font-size:clamp(26px,4vw,52px);letter-spacing:.14em;margin:6px 0;color:var(--ivoire)}
.kinova .kinword .kin{border-bottom:1px solid var(--or)}

/* FALLY */
.kinova .roles{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--ligne-faible);margin-top:54px}
.kinova .role{background:var(--noir);padding:38px 34px}
.kinova .role .tag{font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:var(--or);margin-bottom:14px;font-weight:500}
.kinova .role p{color:var(--gris);font-size:14.5px}

/* PILIERS */
.kinova .pilier{display:grid;grid-template-columns:200px 1fr;gap:54px;padding:64px 0;border-top:1px solid var(--ligne-faible)}
.kinova .pilier:first-of-type{border-top:1px solid var(--ligne)}
.kinova .pilier .num{font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--or);letter-spacing:.06em}
.kinova .pilier .num small{display:block;font-family:'Inter',sans-serif;font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:var(--gris);margin-top:10px}
.kinova .pilier h3{font-size:clamp(22px,2.6vw,32px);font-weight:500}
.kinova .pilier .sub{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:19px;color:var(--champagne);margin-bottom:20px}
.kinova .pilier ul{list-style:none;margin-top:22px;display:grid;gap:12px}
.kinova .pilier ul li{padding-left:26px;position:relative;color:var(--gris);font-size:14.5px;max-width:720px}
.kinova .pilier ul li::before{content:"";position:absolute;left:0;top:11px;width:12px;height:1px;background:var(--or)}
.kinova .pilier .note{margin-top:26px;padding:20px 24px;border-left:1px solid var(--or);background:var(--noir2);font-size:14px;color:var(--ivoire);max-width:720px}
.kinova .pilier .note b{color:var(--champagne);font-weight:500}

/* JOURNEY */
.kinova .journey{background:var(--atlantique)}
.kinova .steps{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:var(--ligne-faible);margin-top:60px}
.kinova .step{background:var(--noir2);padding:34px 24px;min-height:300px;display:flex;flex-direction:column}
.kinova .step .s{font-family:'Cormorant Garamond',serif;font-size:17px;color:var(--or);margin-bottom:16px;letter-spacing:.04em}
.kinova .step h4{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:19px;margin-bottom:12px;line-height:1.25}
.kinova .step p{font-size:12.5px;color:var(--gris);line-height:1.65}
.kinova .step .rev{margin-top:auto;padding-top:16px;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--champagne)}

/* BUSINESS */
.kinova .table-wrap{overflow-x:auto;margin-top:50px;-webkit-overflow-scrolling:touch}
.kinova table{width:100%;border-collapse:collapse;min-width:560px}
.kinova th{font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:var(--or);font-weight:500;text-align:left;padding:0 22px 18px 0;border-bottom:1px solid var(--ligne)}
.kinova td{padding:22px 22px 22px 0;border-bottom:1px solid var(--ligne-faible);vertical-align:top;font-size:14px;color:var(--gris)}
.kinova td:first-child{font-family:'Cormorant Garamond',serif;font-size:19px;color:var(--ivoire);white-space:nowrap}
.kinova td .h{color:var(--champagne)}

/* CIBLES */
.kinova .cibles{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--ligne-faible);margin-top:54px}
.kinova .cible{background:var(--noir);padding:40px 36px}
.kinova .cible .tag{font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:var(--or);margin-bottom:16px;font-weight:500}
.kinova .cible p{font-size:14px;color:var(--gris)}
.kinova .cible p b{color:var(--ivoire);font-weight:400}

/* MOMENTS */
.kinova .moment{border-top:1px solid var(--ligne-faible);padding:44px 0;display:grid;grid-template-columns:1fr 2fr;gap:50px}
.kinova .moment:first-of-type{border-top:1px solid var(--ligne)}
.kinova .moment h4{font-family:'Cormorant Garamond',serif;font-size:clamp(22px,2.4vw,26px);font-weight:500;line-height:1.2}
.kinova .moment h4 span{display:block;font-size:14px;font-style:italic;color:var(--champagne);margin-top:8px;font-weight:400}
.kinova .moment p{color:var(--gris);font-size:14.5px;max-width:640px}

/* ROADMAP */
.kinova .phase{display:grid;grid-template-columns:170px 1fr;gap:46px;padding:40px 0;border-top:1px solid var(--ligne-faible)}
.kinova .phase:first-of-type{border-top:1px solid var(--ligne)}
.kinova .phase .m{font-family:'Cormorant Garamond',serif;font-size:21px;color:var(--champagne)}
.kinova .phase .m small{display:block;font-family:'Inter',sans-serif;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--gris);margin-top:8px}
.kinova .phase p{color:var(--gris);font-size:14.5px;max-width:760px}
.kinova .phase p b{color:var(--ivoire);font-weight:400}

/* KPI */
.kinova .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--ligne-faible);margin-top:54px}
.kinova .kpi{background:var(--noir2);padding:36px 28px}
.kinova .kpi .n{font-family:'Cormorant Garamond',serif;font-size:40px;color:var(--champagne)}
.kinova .kpi .l{font-size:12px;color:var(--gris);margin-top:10px;line-height:1.6}

/* CLOSING */
.kinova .closing{padding:150px 0;text-align:left;border-top:1px solid var(--ligne)}
.kinova .closing h2{font-size:clamp(34px,6vw,76px);max-width:980px}
.kinova .closing .lingala{font-family:'Cormorant Garamond',serif;font-size:24px;color:var(--or);margin-top:44px;letter-spacing:.06em}
.kinova .closing .sig{margin-top:70px;font-size:11px;letter-spacing:.4em;text-transform:uppercase;color:var(--gris)}

.kinova footer{padding:44px 0;border-top:1px solid var(--ligne-faible);font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:rgba(154,144,128,.6)}
.kinova footer .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}

/* Tablette */
@media(max-width:980px){
  .kinova .grid2{grid-template-columns:1fr;gap:40px}
  .kinova .grid3{grid-template-columns:1fr}
  .kinova .steps{grid-template-columns:repeat(2,1fr)}
  .kinova .pilier{grid-template-columns:1fr;gap:22px}
  .kinova .roles,.kinova .cibles{grid-template-columns:1fr}
  .kinova .moment{grid-template-columns:1fr;gap:18px}
  .kinova .phase{grid-template-columns:1fr;gap:12px}
  .kinova .kpis{grid-template-columns:repeat(2,1fr)}
  .kinova section{padding:80px 0}
  .kinova .hero{padding:70px 0}
  .kinova .hero .label{margin-bottom:36px;gap:10px 18px}
  .kinova .hero .pitch{margin-top:38px}
}

/* Mobile L */
@media(max-width:640px){
  .kinova .wrap{padding:0 6vw}
  .kinova section{padding:64px 0}
  .kinova .arc-band{padding:60px 0}
  .kinova .closing{padding:80px 0}
  .kinova .hero{min-height:auto;padding:80px 0 64px}
  .kinova .hero h1{font-size:clamp(54px,15vw,90px)}
  .kinova .hero .triptyque{margin-top:30px;font-size:clamp(20px,5vw,28px);gap:4px 24px}
  .kinova .hero .pitch{font-size:15.5px;line-height:1.7}
  .kinova .hero .pitch .en{font-size:18px}
  .kinova .stat{padding:32px 26px}
  .kinova .stat .n{font-size:44px}
  .kinova .role{padding:32px 28px}
  .kinova .pilier{padding:48px 0}
  .kinova .pilier ul li{font-size:14px}
  .kinova .pilier .note{padding:18px 20px}
  .kinova .cible{padding:32px 28px}
  .kinova .kpi{padding:30px 24px}
  .kinova .kpi .n{font-size:34px}
  .kinova .closing .lingala{font-size:20px}
  .kinova .closing .sig{margin-top:50px;letter-spacing:.32em}
  .kinova footer{font-size:9px;letter-spacing:.22em}
  .kinova footer .wrap{flex-direction:column;align-items:flex-start}
  .kinova .scroll-hint{font-size:9px;letter-spacing:.32em;bottom:24px}
  .kinova .step{min-height:auto;padding:28px 22px}
  .kinova h2{margin-bottom:22px}
  .kinova .eyebrow{margin-bottom:20px;letter-spacing:.36em}
}

/* Mobile S */
@media(max-width:480px){
  .kinova .steps{grid-template-columns:1fr}
  .kinova .kpis{grid-template-columns:1fr}
  .kinova .hero h1{font-size:clamp(46px,16vw,72px)}
  .kinova .pilier .num{font-size:18px}
  .kinova .closing .sig{font-size:10px;letter-spacing:.28em}
  .kinova p.body,.kinova li.body{font-size:15px}
  .kinova p.lead{font-size:18px}
  .kinova .roles,.kinova .cibles{margin-top:36px}
  .kinova .grid3{margin-top:48px}
  .kinova .moment{padding:32px 0}
}

/* Mobile XS */
@media(max-width:360px){
  .kinova{font-size:15px}
  .kinova .wrap{padding:0 5vw}
  .kinova .eyebrow{font-size:10px;letter-spacing:.28em}
  .kinova .hero .label{font-size:10px;letter-spacing:.32em}
}
`;

export default function KinovaPage() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const els = document.querySelectorAll<HTMLElement>('.kinova .reveal');
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div
        className="kinova"
        dangerouslySetInnerHTML={{
          __html: `
<header class="hero">
  <div class="wrap">
    <div class="label"><b>KINOVA</b><span>·</span><span>Proposition de thème — Première édition</span><span>·</span><span>Confidentiel</span></div>
    <h1>WE ARE<br>KIN<span class="dot">.</span></h1>
    <div class="triptyque">
      <span><span class="kin">Kin</span>shasa.</span>
      <span><span class="kin">Kin</span>ship.</span>
      <span><span class="kin">Kin</span>ova.</span>
    </div>
    <p class="pitch">
      En anglais, <em>kin</em> signifie <strong>la famille, le sang, les siens</strong>.
      Kinshasa est la seule capitale au monde qui porte littéralement ce mot dans son nom.
      Le thème de la première édition transforme cette coïncidence en destin&nbsp;:
      faire de Kinshasa le point de retour des 47&nbsp;millions d'Afro-Américains qui cherchent leurs racines.
      <span class="en">"Come home. Come meet your kin."</span>
    </p>
  </div>
  <div class="scroll-hint">Le grand retour — The Homecoming</div>
</header>

<div class="arc-band">
  <div class="wrap reveal">
    <svg class="arc-svg" viewBox="0 0 1000 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Arc transatlantique reliant les États-Unis à Kinshasa">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#E2C97E" stop-opacity=".25"/>
          <stop offset=".5" stop-color="#C9A227"/>
          <stop offset="1" stop-color="#E2C97E" stop-opacity=".25"/>
        </linearGradient>
      </defs>
      <path d="M 60 210 C 300 20, 700 20, 940 210" fill="none" stroke="url(#g)" stroke-width="1.4"/>
      <path d="M 60 210 C 300 60, 700 60, 940 210" fill="none" stroke="rgba(201,162,39,.18)" stroke-width="1" stroke-dasharray="2 7"/>
      <circle cx="60" cy="210" r="4" fill="#E2C97E"/>
      <circle cx="940" cy="210" r="5.5" fill="#C9A227"/>
      <circle cx="940" cy="210" r="11" fill="none" stroke="rgba(201,162,39,.5)" stroke-width="1"/>
      <circle cx="500" cy="68" r="3" fill="#C9A227"/>
      <text x="500" y="46" text-anchor="middle" fill="#9A9080" font-family="Inter" font-size="10" letter-spacing="4">L'ATLANTIQUE — LE RETOUR</text>
      <text x="60" y="240" fill="#9A9080" font-family="Inter" font-size="11" letter-spacing="3">ATLANTA · HOUSTON · NEW YORK</text>
      <text x="940" y="240" text-anchor="end" fill="#E2C97E" font-family="Inter" font-size="11" letter-spacing="3">KINSHASA</text>
    </svg>
    <div class="arc-caption"><span>Il y a 400 ans, une traversée forcée.</span><b>Aujourd'hui, une traversée choisie.</b></div>
  </div>
</div>

<section>
  <div class="wrap">
    <div class="eyebrow reveal">01 — L'insight</div>
    <h2 class="reveal">Le Ghana a capté le récit du retour.<br>Le Congo en possède <span class="gold">la source</span>.</h2>
    <div class="grid2 reveal">
      <p class="lead">En 2019, l'« Année du Retour » a transformé le Ghana en destination spirituelle de la diaspora noire américaine — et en machine économique. Pourtant, historiquement, c'est l'Afrique centrale-ouest — l'espace Kongo — qui fut le premier bassin d'origine des Africains déportés vers les Amériques.</p>
      <div>
        <p class="body">Près de la moitié des captifs de la traite transatlantique sont partis des côtes de l'Afrique centrale-ouest, l'espace culturel kongo. Une part majeure des Afro-Américains porte donc un héritage <em>congolais</em> — sans le savoir, et sans aucune plateforme pour le découvrir.</p>
        <div class="rule"></div>
        <p class="body">Le Ghana a construit son succès sur une porte de sortie (Cape Coast). Kinshasa peut construire le sien sur quelque chose de plus puissant&nbsp;: <strong style="color:var(--ivoire);font-weight:400">la parenté vivante</strong> — la musique, la langue, la rumba classée à l'UNESCO, les visages, le mot <em>kin</em> lui-même.</p>
      </div>
    </div>
    <div class="grid3" style="margin-top:70px">
      <div class="stat reveal"><div class="n">≈45%</div><div class="l">des Africains déportés vers les Amériques venaient d'Afrique centrale-ouest (espace Kongo–Angola) — premier bassin d'origine de la traite.</div><div class="src">Base SlaveVoyages</div></div>
      <div class="stat reveal"><div class="n">47M</div><div class="l">Afro-Américains aux États-Unis, dont une génération massivement engagée dans la recherche de ses origines (tests ADN, généalogie, voyages racines).</div><div class="src">US Census</div></div>
      <div class="stat reveal"><div class="n">$1,9Md</div><div class="l">de retombées économiques générées par l'Année du Retour au Ghana en 2019, pour environ 200 000 visiteurs diaspora supplémentaires.</div><div class="src">Ghana Tourism Authority</div></div>
      <div class="stat reveal"><div class="n">$1,8T</div><div class="l">de pouvoir d'achat annuel de la communauté afro-américaine — l'équivalent de la 4ᵉ économie d'Afrique s'il s'agissait d'un PIB.</div><div class="src">Selig Center</div></div>
      <div class="stat reveal"><div class="n">17M+</div><div class="l">d'habitants à Kinshasa, plus grande ville francophone du monde, patrimoine musical reconnu par l'UNESCO — sans plateforme à son échelle.</div><div class="src">Dossier KINOVA</div></div>
      <div class="stat reveal"><div class="n">0</div><div class="l">événement mondial ne relie aujourd'hui la diaspora américaine à l'Afrique centrale. La place est vide. Le premier qui la prend la garde.</div><div class="src">Analyse Alkebulan</div></div>
    </div>
  </div>
</section>

<section class="manifesto">
  <div class="wrap">
    <div class="eyebrow reveal">02 — Le thème</div>
    <h2 class="reveal">Un mot que l'Amérique comprend<br>avant même qu'on le traduise.</h2>
    <div class="grid2" style="margin-top:50px">
      <div class="reveal">
        <div class="kinword"><span class="kin">KIN</span>SHASA</div>
        <div class="kinword"><span class="kin">KIN</span>SHIP</div>
        <div class="kinword"><span class="kin">KIN</span>OVA</div>
        <div class="rule"></div>
        <p class="body">Aucun slogan à inventer, aucune explication à donner. Sur un panneau à Atlanta, dans un post Instagram, dans la bouche d'un animateur de late-show&nbsp;: <em>« We are kin »</em> fonctionne immédiatement. C'est un thème né bilingue — émotionnel en anglais, géographique en lingala-français.</p>
      </div>
      <blockquote class="reveal">
        «&nbsp;Vous n'êtes pas des touristes.<br>
        Vous n'êtes pas des visiteurs.<br>
        Vous êtes de la <span class="kin">famille</span> qui rentre à la maison.&nbsp;»
        <p style="font-size:15px;font-family:Inter;color:var(--gris);margin-top:26px;font-weight:300">Le festival ne « présente » pas la culture congolaise à la diaspora. Il l'accueille comme on accueille un parent perdu de vue — exactement la posture de puissance culturelle définie par le Vision Document KINOVA.</p>
      </blockquote>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow reveal">03 — Fally Ipupa</div>
    <h2 class="reveal">Du symbole national<br>au <span class="gold">pont transatlantique</span>.</h2>
    <p class="lead reveal">Fally a déjà conquis Paris, l'Afrique et la diaspora francophone. Ce qui lui reste à conquérir, c'est l'Amérique — et l'Amérique ne se conquiert pas par la radio&nbsp;: elle se conquiert par le récit. <em>L'homme qui a ramené la diaspora à Kinshasa</em> est un récit que les médias américains voudront raconter.</p>
    <div class="roles">
      <div class="role reveal"><div class="tag">Tête d'affiche</div><p>Performance de clôture historique au bord du fleuve — le moment que les caméras américaines viennent filmer, l'équivalent kinois du Stade de France.</p></div>
      <div class="role reveal"><div class="tag">Parrain culturel — « The Godfather of the Return »</div><p>Hôte officiel de la cérémonie d'accueil de la diaspora. C'est lui qui prononce le « Welcome home ». Aucune marque, aucune institution ne peut incarner ce rôle à sa place.</p></div>
      <div class="role reveal"><div class="tag">Pont artistique &amp; héros de la série</div><p>Un duo officiel Fally × artiste afro-américain — l'hymne « KIN » — sorti aux États-Unis avant le festival, et le rôle central de la série « The Return to Kin » pensée pour Netflix&nbsp;: c'est par le récit, pas par la radio, qu'il entre dans les foyers américains.</p></div>
      <div class="role reveal"><div class="tag">Co-actionnaire de l'écosystème</div><p>Fally ne reçoit pas un cachet&nbsp;: il détient une part de la plateforme (festival, parcours, forum, média). Son intérêt est structurel et de long terme — aligné avec la logique d'institution du Vision Document.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow reveal">04 — L'écosystème</div>
    <h2 class="reveal">Un festival au centre.<br>Quatre moteurs autour.</h2>
    <p class="lead reveal">Le festival est le moment émotionnel. Mais le business model vit sur douze mois, des deux côtés de l'Atlantique. Chaque pilier alimente les autres&nbsp;: le test ADN crée le voyageur, le voyage crée le festivalier, le festival crée l'investisseur, l'investisseur crée le récit.</p>

    <div class="pilier reveal">
      <div class="num">Pilier I<small>Le cœur</small></div>
      <div>
        <h3>KINOVA — The Homecoming Edition</h3>
        <div class="sub">Trois jours, une ville, une famille réunie.</div>
        <p class="body">La première édition KINOVA telle que définie dans les documents fondateurs (3 jours, 3&nbsp;000–5&nbsp;000 personnes/jour, sunset-focused), mais portée par le thème du retour&nbsp;: une scène principale au bord du fleuve, une scène « Diaspora Stage » dédiée aux dialogues musicaux Congo × Amérique, et l'environnement dansant immersif.</p>
        <ul>
          <li>Programmation en miroir&nbsp;: chaque soir, un dialogue rumba × R&amp;B / gospel × soukous / amapiano-ndombolo × hip-hop.</li>
          <li>Quartier « Heritage Village »&nbsp;: généalogie, expositions sur le royaume Kongo, artisans, mode congolaise, sapologie.</li>
          <li>Quota assumé de 1&nbsp;500–2&nbsp;500 visiteurs américains payants en édition 1 — la rareté fait le prestige.</li>
        </ul>
      </div>
    </div>

    <div class="pilier reveal">
      <div class="num">Pilier II<small>Le déclencheur</small></div>
      <div>
        <h3><span class="kin">KIN</span> Origins — l'ADN comme billet d'entrée</h3>
        <div class="sub">"Your DNA is your boarding pass."</div>
        <p class="body">Plutôt que de créer un laboratoire de zéro (lourd, réglementé), KIN Origins se lance en <strong style="color:var(--ivoire);font-weight:400">co-marque avec un acteur établi des tests d'ascendance africaine</strong> — idéalement un acteur black-owned américain spécialisé dans les lignages africains, dont la crédibilité communautaire est déjà acquise. La société KIN Origins (à créer) détient la marque, la campagne, les données opt-in et la relation client&nbsp;; le partenaire détient la science.</p>
        <ul>
          <li>Campagne US «&nbsp;Where does your story begin?&nbsp;»&nbsp;: pasteurs, barbershops, sororités/fraternités, TikTok — le test à prix accessible, subventionné par les sponsors.</li>
          <li>Révélation filmée&nbsp;: les vidéos de révélation d'origines sont un genre viral établi. Chaque résultat «&nbsp;Afrique centrale / Kongo&nbsp;» déclenche une invitation personnalisée au festival.</li>
          <li>Certificat d'héritage remis à Kinshasa lors de la cérémonie — pas par la poste. Le résultat se vit, il ne se télécharge pas.</li>
          <li>À terme&nbsp;: KIN Origins devient la porte d'entrée des démarches de séjour longue durée et d'installation (modèle ghanéen de la citoyenneté accordée à la diaspora).</li>
        </ul>
        <div class="note"><b>Pourquoi c'est le génie du modèle&nbsp;:</b> chaque test vendu aux États-Unis est à la fois une marge commerciale, un prospect qualifié pour les voyages, et une histoire médiatisable. Le marketing s'autofinance.</div>
      </div>
    </div>

    <div class="pilier reveal">
      <div class="num">Pilier III<small>Le voyage</small></div>
      <div>
        <h3><span class="kin">KIN</span> Routes — les parcours du retour</h3>
        <div class="sub">Du mémorial à la maison.</div>
        <p class="body">Des packages 7 à 14 jours construits avec des agences spécialisées du Black Travel Movement américain, vendus en dollars, festival inclus. Trois niveaux&nbsp;: <em>Pèlerinage</em> (essentiel), <em>Immersion</em> (premium), <em>Héritage</em> (prestige — petits groupes, accès artistes, dîners privés).</p>
        <ul>
          <li>Route Kongo&nbsp;: Kinshasa, le fleuve, les sites de mémoire de l'ancien royaume Kongo, ateliers de rumba et de sape.</li>
          <li>Route panafricaine&nbsp;: combinés multi-pays (ex. Sénégal–Bénin–Congo ou Ghana–Congo) — on ne concurrence pas le Ghana, on le complète&nbsp;: «&nbsp;ils ont visité la porte, ils viennent retrouver la maison&nbsp;».</li>
          <li>Partenariats structurants&nbsp;: compagnies aériennes desservant FIH (charters directs USA–Kinshasa pendant la semaine du festival = moment média en soi), hôtels, e-visa facilité négocié avec les autorités.</li>
        </ul>
      </div>
    </div>

    <div class="pilier reveal">
      <div class="num">Pilier IV<small>Le business</small></div>
      <div>
        <h3><span class="kin">KIN</span> Bridge — le forum économique transatlantique</h3>
        <div class="sub">La diaspora ne vient pas que danser. Elle vient bâtir.</div>
        <p class="body">Deux jours adossés au festival (J-2, J-1), en synergie directe avec la plateforme N'SELE du Congo Initiative. Le forum donne à la diaspora américaine une raison <em>professionnelle</em> de venir — et donne au voyage un statut déductible/corporate pour les entreprises.</p>
        <ul>
          <li>Délégations cibles&nbsp;: HBCU (universités historiquement noires — accords d'échanges avec les universités et institutions congolaises), chambres de commerce noires américaines, fonds et family offices afro-américains, franchises et marques black-owned cherchant l'Afrique.</li>
          <li>Côté congolais&nbsp;: entrepreneurs, banques, immobilier, agro, industries créatives, tech — avec une «&nbsp;deal room&nbsp;» et des signatures de MoU mises en scène devant la presse.</li>
          <li>Produit financier signature&nbsp;: le «&nbsp;KIN Fund&nbsp;» ou des véhicules d'investissement diaspora (immobilier, hôtellerie, créatif) présentés au forum — le festival devient un canal de levée de fonds.</li>
        </ul>
        <div class="note"><b>L'argument pour les sponsors US&nbsp;:</b> banques, télécoms, compagnies aériennes et marques lifestyle américaines investissent massivement dans le marketing multiculturel. Un événement qui combine héritage, voyage et business leur offre les trois cases en une seule signature.</div>
      </div>
    </div>

    <div class="pilier reveal">
      <div class="num">Pilier V<small>Le récit</small></div>
      <div>
        <h3><span class="kin">KIN</span> Stories — la machine médiatique américaine</h3>
        <div class="sub">Le festival se gagne à Kinshasa. Il se raconte à New York.</div>
        <p class="body">Une cellule contenu dédiée au marché US, pensée dès le premier jour — pas après coup.</p>
        <ul>
          <li>5 à 7 ambassadeurs américains&nbsp;: artistes, athlètes, créateurs et figures culturelles ayant déjà exprimé publiquement leur quête de racines africaines — invités à faire le test, puis le voyage, caméras embarquées.</li>
          <li>La série documentaire événement «&nbsp;The Return to Kin&nbsp;», conçue dès le premier jour pour Netflix — détaillée au chapitre 06. Ce n'est pas un produit dérivé du festival&nbsp;: c'est son amplificateur mondial.</li>
          <li>Partenariats médias noirs américains (presse, radio, podcasts généalogie et culture) + un correspondant permanent du festival aux USA.</li>
          <li>Le single «&nbsp;KIN&nbsp;» Fally × artiste US comme bande-son de tous les assets.</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section class="journey">
  <div class="wrap">
    <div class="eyebrow reveal">05 — Le parcours</div>
    <h2 class="reveal">D'Atlanta à Kinshasa<br>en six étapes.</h2>
    <p class="lead reveal">Chaque étape est à la fois une expérience pour la personne et une ligne de revenus pour l'écosystème.</p>
    <div class="steps">
      <div class="step reveal"><div class="s">Étape 1</div><h4>La question</h4><p>La campagne KIN Origins touche une Américaine de 34 ans à Houston&nbsp;: «&nbsp;Where does your story begin?&nbsp;». Elle commande le test.</p><div class="rev">Revenu · test ADN</div></div>
      <div class="step reveal"><div class="s">Étape 2</div><h4>La révélation</h4><p>Résultat&nbsp;: lignage Afrique centrale — espace Kongo. Vidéo de révélation, invitation personnalisée à la Homecoming Edition.</p><div class="rev">Asset · contenu viral</div></div>
      <div class="step reveal"><div class="s">Étape 3</div><h4>Le voyage</h4><p>Elle réserve un package KIN Routes «&nbsp;Immersion&nbsp;» — vol, hôtel, festival, parcours mémoire — payé en dollars depuis les USA.</p><div class="rev">Revenu · package voyage</div></div>
      <div class="step reveal"><div class="s">Étape 4</div><h4>La cérémonie</h4><p>À Kinshasa, Fally préside la cérémonie d'accueil. Elle reçoit son certificat d'héritage et un nom congolais. Sa famille pleure en story Instagram.</p><div class="rev">Asset · moment média</div></div>
      <div class="step reveal"><div class="s">Étape 5</div><h4>Le festival &amp; le forum</h4><p>Trois jours de musique. Et comme elle dirige une PME, elle assiste au KIN Bridge — elle repart avec deux contacts fournisseurs congolais.</p><div class="rev">Revenu · billetterie + forum</div></div>
      <div class="step reveal"><div class="s">Étape 6</div><h4>L'ambassadrice</h4><p>De retour à Houston, elle raconte. Son église organise un groupe de 30 personnes pour l'édition suivante. Le cycle recommence — en plus grand.</p><div class="rev">Croissance · organique</div></div>
    </div>
  </div>
</section>

<section style="background:linear-gradient(180deg,var(--noir) 0%,#0D0C0A 50%,var(--noir) 100%)">
  <div class="wrap">
    <div class="eyebrow reveal">06 — La série documentaire</div>
    <h2 class="reveal">«&nbsp;THE RETURN TO KIN.&nbsp;»<br>Une série événement pensée pour <span class="gold">Netflix</span>.</h2>
    <p class="lead reveal" style="max-width:860px">La logline tient en deux phrases&nbsp;— c'est le signe d'un projet que les plateformes comprennent&nbsp;:
      <em>«&nbsp;Sept Américains découvrent par un test ADN que leur histoire commence au Congo.
      La plus grande star d'Afrique centrale les ramène à la maison.&nbsp;»</em></p>

    <div class="grid2" style="margin-top:64px">
      <div class="reveal">
        <h3>Pourquoi les plateformes la voudront</h3>
        <p class="body">Le récit du retour aux racines est l'un des filons les plus performants du streaming américain de la dernière décennie&nbsp;: <em>Homecoming</em> de Beyoncé (Netflix), <em>Black Is King</em> (Disney+), <em>High on the Hog</em> (Netflix — la cuisine afro-américaine retracée jusqu'à ses origines africaines, deux saisons), <em>Finding Your Roots</em> (PBS, plus de dix saisons portées par les révélations généalogiques de célébrités), <em>African Queens</em> (Netflix). Les audiences noires américaines comptent parmi les plus engagées du streaming US — et les plateformes investissent structurellement dans les contenus qui les servent.</p>
        <div class="rule"></div>
        <p class="body">«&nbsp;The Return to Kin&nbsp;» combine ces filons en un seul objet&nbsp;: la révélation ADN de <em>Finding Your Roots</em>, l'émotion du retour du Year of Return, la puissance scénique d'<em>Homecoming</em> — avec un élément qu'aucun de ces titres n'avait&nbsp;: <strong style="color:var(--ivoire);font-weight:400">une destination que le public peut réserver à la fin de l'épisode</strong>.</p>
      </div>
      <div class="reveal">
        <h3>Le format</h3>
        <ul style="list-style:none;display:grid;gap:14px;margin-top:8px">
          <li class="body" style="padding-left:26px;position:relative"><span style="position:absolute;left:0;top:11px;width:12px;height:1px;background:var(--or)"></span><b style="color:var(--ivoire);font-weight:400">1 saison · 6 épisodes · ~45 min</b> — docu-suivi choral&nbsp;: les sept ambassadeurs, du prélèvement ADN dans leur ville américaine jusqu'à la scène de Kinshasa.</li>
          <li class="body" style="padding-left:26px;position:relative"><span style="position:absolute;left:0;top:11px;width:12px;height:1px;background:var(--or)"></span><b style="color:var(--ivoire);font-weight:400">Fally, fil rouge et producteur exécutif</b> — il n'est pas un sujet filmé&nbsp;: il porte la narration, ouvre les portes de Kinshasa, et signe l'œuvre. Le modèle <em>Homecoming</em>&nbsp;: l'artiste propriétaire de son récit.</li>
          <li class="body" style="padding-left:26px;position:relative"><span style="position:absolute;left:0;top:11px;width:12px;height:1px;background:var(--or)"></span><b style="color:var(--ivoire);font-weight:400">Co-production crédible</b> — une société de production black américaine reconnue des plateformes + une production exécutive congolaise. Le pitch se fait avec un teaser réel, tourné lors des premières révélations ADN des ambassadeurs.</li>
          <li class="body" style="padding-left:26px;position:relative"><span style="position:absolute;left:0;top:11px;width:12px;height:1px;background:var(--or)"></span><b style="color:var(--ivoire);font-weight:400">Renouvelable par construction</b> — le festival est annuel, donc la série l'est aussi&nbsp;: nouvelles histoires, nouveaux ambassadeurs, nouvelle édition. Une franchise, pas un one-shot.</li>
        </ul>
      </div>
    </div>

    <div class="steps" style="margin-top:70px">
      <div class="step reveal"><div class="s">Épisode 1</div><h4>The Question</h4><p>Sept vies américaines — Atlanta, Houston, Brooklyn, La Nouvelle-Orléans. Une même absence&nbsp;: ne pas savoir d'où l'on vient. Le test part au laboratoire.</p><div class="rev">Hook · l'identification</div></div>
      <div class="step reveal"><div class="s">Épisode 2</div><h4>The Reveal</h4><p>Les révélations, une par une. Lignages kongo, luba, mongo. Larmes, appels aux grands-parents. À Kinshasa, Fally reçoit la liste des noms&nbsp;: «&nbsp;Amenez-les moi.&nbsp;»</p><div class="rev">Le moment viral</div></div>
      <div class="step reveal"><div class="s">Épisode 3</div><h4>The Kingdom</h4><p>L'histoire que l'école américaine n'enseigne pas&nbsp;: le royaume Kongo, la traite depuis l'Afrique centrale, la rumba revenue de Cuba. Fally en narrateur, archives et création.</p><div class="rev">Le socle historique</div></div>
      <div class="step reveal"><div class="s">Épisode 4</div><h4>The Landing</h4><p>Le charter décolle. À N'djili&nbsp;: tambours, tarmac, premiers pas. La ville les avale — marchés, studios, sapeurs, le fleuve. Le choc et la reconnaissance.</p><div class="rev">L'épisode signature</div></div>
      <div class="step reveal"><div class="s">Épisode 5</div><h4>The Naming</h4><p>La cérémonie des noms au coucher du soleil, puis le festival. Le duo «&nbsp;KIN&nbsp;» joué pour la première fois. L'apothéose émotionnelle et musicale de la saison.</p><div class="rev">Le final musical</div></div>
      <div class="step reveal"><div class="s">Épisode 6</div><h4>The Bridge</h4><p>Ce qui reste quand la musique s'arrête&nbsp;: les deals du forum, celle qui investit, celui qui revient s'installer. Générique sur la question&nbsp;: «&nbsp;And you — where does your story begin?&nbsp;»</p><div class="rev">L'appel à l'action</div></div>
    </div>

    <div class="grid2" style="margin-top:64px">
      <div class="note reveal" style="margin-top:0"><b>L'effet de levier business&nbsp;:</b> chaque épisode est un entonnoir mondial vers les tests KIN Origins et les packages KIN Routes — un marketing que la plateforme paie et diffuse dans 190 pays. La présence d'une série en production multiplie aussi la valeur faciale du sponsoring&nbsp;: les marques n'achètent plus trois jours de festival, elles achètent une présence à l'écran pour des années.</div>
      <div class="note reveal" style="margin-top:0"><b>L'argument décisif pour Fally&nbsp;:</b> Beyoncé a changé de dimension avec <em>Homecoming</em> — d'artiste à institution culturelle. «&nbsp;The Return to Kin&nbsp;» offre à Fally le même véhicule&nbsp;: héros, narrateur et producteur exécutif d'une série diffusée dans des centaines de millions de foyers, dont la majorité ne connaît pas encore son nom. Aucune tournée américaine ne peut produire cet effet.</div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow reveal">07 — Le modèle économique</div>
    <h2 class="reveal">Sept flux de revenus.<br>Deux devises. Un récit.</h2>
    <div class="table-wrap reveal">
      <table>
        <thead><tr><th>Flux</th><th>Mécanique</th><th>Origine</th></tr></thead>
        <tbody>
          <tr><td>Sponsoring US</td><td>Marques américaines (banques, télécoms, aérien, spiritueux, beauté) sur les budgets <span class="h">marketing multiculturel</span> — naming des scènes, de la cérémonie, du forum.</td><td>USA · $</td></tr>
          <tr><td>Sponsoring Afrique</td><td>Banques, brasseurs, télécoms et institutions de la région — selon la philosophie partenaires KINOVA&nbsp;: intégrés, jamais envahissants.</td><td>RDC / région</td></tr>
          <tr><td>Tests KIN Origins</td><td>Marge sur chaque kit vendu + base de données opt-in qui qualifie les futurs voyageurs. <span class="h">Le marketing qui se fait payer.</span></td><td>USA · $</td></tr>
          <tr><td>Packages KIN Routes</td><td>Commission sur les packages 7–14 jours (3 niveaux de gamme), vendus en dollars, festival inclus.</td><td>USA · $</td></tr>
          <tr><td>Billetterie</td><td>Tarification duale assumée&nbsp;: pass international en dollars, pass local accessible — la jeunesse kinoise est l'âme du festival, pas une variable d'ajustement.</td><td>Mixte</td></tr>
          <tr><td>Forum KIN Bridge</td><td>Pass délégués, stands, deal room, commissions de mise en relation, et à terme frais de structuration des véhicules d'investissement diaspora.</td><td>USA / RDC</td></tr>
          <tr><td>Série &amp; contenu</td><td>Vente de la série «&nbsp;The Return to Kin&nbsp;» à une plateforme (<span class="h">licence Netflix = revenu en dollars + marketing mondial gratuit</span>), droits dérivés, licensing du single «&nbsp;KIN&nbsp;», contenus de marque produits par la cellule KIN Stories.</td><td>Global · $</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow reveal">08 — Les alliés américains</div>
    <h2 class="reveal">On ne « fait pas du marketing » vers la diaspora.<br>On <span class="gold">s'allie à ses réseaux</span>.</h2>
    <div class="cibles">
      <div class="cible reveal"><div class="tag">Les réseaux organisés</div><p><b>Fraternités et sororités noires (Divine Nine), HBCU et leurs alumni, grandes églises, chambres de commerce noires, associations généalogiques.</b> Ces structures déplacent des groupes entiers — un seul partenariat peut remplir un charter. L'approche&nbsp;: leur proposer un rôle officiel (délégation fondatrice, chapitre KIN), pas une publicité.</p></div>
      <div class="cible reveal"><div class="tag">Les artistes &amp; figures culturelles</div><p><b>Artistes ayant exploré leurs racines, athlètes, acteurs, auteurs, pasteurs médiatiques.</b> On ne leur achète pas un post&nbsp;: on leur offre une révélation d'origine, un voyage fondateur et un rôle de parrain d'édition aux côtés de Fally. Leur histoire devient le contenu.</p></div>
      <div class="cible reveal"><div class="tag">Le Black Travel Movement</div><p><b>Agences, collectifs et créateurs de voyage afro-américains</b> qui ont industrialisé les voyages de groupe vers le Ghana, le Sénégal ou l'Égypte. Ils cherchent la prochaine destination&nbsp;: on leur donne l'exclusivité de la première — avec commissions et co-branding.</p></div>
      <div class="cible reveal"><div class="tag">Médias &amp; plateformes</div><p><b>Presse et audiovisuel noirs américains, podcasts d'héritage et de généalogie, streamers.</b> Angle servi sur un plateau&nbsp;: «&nbsp;la plus grande ville francophone du monde accueille l'Amérique noire chez elle&nbsp;». Inviter une délégation presse dès l'édition 1, en classe affaires.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow reveal">09 — Les moments conçus pour les médias</div>
    <h2 class="reveal">Quatre images qui font<br>le tour du monde.</h2>
    <div style="margin-top:60px">
      <div class="moment reveal"><h4>L'arrivée<span>"The Landing"</span></h4><p>Un charter direct USA–Kinshasa atterrit à N'djili. Tapis, tambours, Fally sur le tarmac. Des passagers en larmes filment leur premier pas sur la terre de leurs ancêtres. C'est l'ouverture du documentaire — et le contenu le plus partagé de la semaine.</p></div>
      <div class="moment reveal"><h4>La cérémonie des noms<span>"The Naming Ceremony"</span></h4><p>Au coucher du soleil sur le fleuve, chaque membre de la diaspora reçoit son certificat d'héritage et un nom congolais, remis par des anciens et parrainé par Fally. Le moment signature du festival — solennel, photogénique, impossible à copier ailleurs.</p></div>
      <div class="moment reveal"><h4>Le duo<span>L'hymne « KIN »</span></h4><p>Fally et un artiste américain interprètent leur single ensemble pour la première fois, sur la scène principale. Le clip, tourné entre Kinshasa et une ville américaine, est sorti trois mois avant — la performance live en est l'apothéose.</p></div>
      <div class="moment reveal"><h4>La signature<span>Le deal du forum</span></h4><p>Devant la presse, une HBCU signe un accord d'échange avec une institution congolaise, ou un fonds diaspora annonce un premier investissement. Le message&nbsp;: ce festival produit autre chose que des souvenirs.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow reveal">10 — Roadmap</div>
    <h2 class="reveal">Alignée sur les phases KINOVA.<br>Augmentée du moteur américain.</h2>
    <div style="margin-top:56px">
      <div class="phase reveal"><div class="m">Mois 1–2<small>Fondation</small></div><p><b>Valider le thème avec Fally et son management.</b> Structurer KIN Origins (entité + shortlist de partenaires ADN), poser l'architecture juridique US (LLC dédiée pour le sponsoring et la billetterie en dollars), identifier les 7 ambassadeurs prioritaires.</p></div>
      <div class="phase reveal"><div class="m">Mois 3–4<small>Structure</small></div><p>Signer le <b>partenariat ADN</b> et 2–3 <b>agences du Black Travel Movement</b>. Attacher la <b>société de co-production américaine</b> et tourner le teaser de la série lors des premières révélations ADN. Négocier charters et facilitation e-visa. Construire le deck sponsors US (en anglais, chiffré en dollars) et le programme du forum KIN Bridge avec premières HBCU contactées.</p></div>
      <div class="phase reveal"><div class="m">Mois 5–6<small>Lancement public</small></div><p><b>Annonce mondiale du thème</b> avec Fally (Kinshasa + relais médias US le même jour). <b>Pitch de la série aux plateformes</b> — Netflix en priorité — teaser et ambassadeurs à l'appui&nbsp;; objectif&nbsp;: un accord de diffusion ou de développement avant le festival. Lancement de la campagne «&nbsp;Where does your story begin?&nbsp;» et des ventes de packages early-bird. Enregistrement du single «&nbsp;KIN&nbsp;».</p></div>
      <div class="phase reveal"><div class="m">Mois 7–9<small>Build-up</small></div><p>Sortie du single et du trailer officiel de la série (les révélations ADN des ambassadeurs)&nbsp;: tournage en continu, équipes embarquées des deux côtés de l'Atlantique. Vente des délégations forum. Lineup finalisé&nbsp;: dialogues musicaux Congo × Amérique confirmés. Pression médiatique croissante des deux côtés.</p></div>
      <div class="phase reveal"><div class="m">Mois 10–12<small>Activation</small></div><p><b>La Homecoming Edition.</b> Charter, Landing, Naming Ceremony, festival, forum — les épisodes 4, 5 et 6 se tournent en direct. Post-production immédiate pour une diffusion de la série quelques mois après l'événement, qui relance la machine pour l'édition 2. Reporting chiffré → dossier «&nbsp;Year 2&nbsp;» pour sponsors, plateformes et institutions, et bascule de KIN Origins en plateforme permanente.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow reveal">11 — Objectifs édition 1</div>
    <h2 class="reveal">Des cibles volontairement tenables.<br>Le prestige avant le volume.</h2>
    <div class="kpis">
      <div class="kpi reveal"><div class="n">10–15k</div><div class="l">tests KIN Origins vendus aux USA avant le festival — chacun étant un prospect voyage qualifié.</div></div>
      <div class="kpi reveal"><div class="n">1 500+</div><div class="l">visiteurs américains payants (packages + billets), sur une jauge totale de 3 000–5 000/jour fidèle au Structure Document.</div></div>
      <div class="kpi reveal"><div class="n">10+</div><div class="l">accords signés au forum KIN Bridge (HBCU, chambres de commerce, premiers véhicules d'investissement diaspora).</div></div>
      <div class="kpi reveal"><div class="n">500M+</div><div class="l">d'impressions médias cumulées, dont une majorité générée par des médias et créateurs américains.</div></div>
      <div class="kpi reveal" style="grid-column:1/-1;display:grid;grid-template-columns:auto 1fr;gap:28px;align-items:center"><div class="n">1 deal</div><div class="l">de diffusion ou de développement signé avec une plateforme mondiale (Netflix en cible prioritaire) avant la tenue du festival — l'objectif qui change l'échelle de tous les autres&nbsp;: sponsors, ambassadeurs et billetterie se négocient différemment quand le projet est «&nbsp;une série en production&nbsp;».</div></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="eyebrow reveal">12 — Ce que Fally y gagne</div>
    <div class="grid2">
      <div class="reveal">
        <h2 style="font-size:clamp(28px,3.6vw,46px)">Plus grand que la musique.</h2>
        <p class="body">Le Stade de France a prouvé qu'il remplit l'Europe. La Homecoming Edition prouve autre chose&nbsp;: qu'il peut faire <em>traverser l'Atlantique</em> à l'Amérique. Aucun artiste africain ne détient encore ce titre.</p>
      </div>
      <div class="reveal">
        <ul style="list-style:none;display:grid;gap:18px">
          <li class="body" style="padding-left:26px;position:relative"><span style="position:absolute;left:0;top:11px;width:12px;height:1px;background:var(--or)"></span><b style="color:var(--ivoire);font-weight:400">Entrée sur le marché américain</b> par le récit et un duo majeur — pas par une tournée de plus.</li>
          <li class="body" style="padding-left:26px;position:relative"><span style="position:absolute;left:0;top:11px;width:12px;height:1px;background:var(--or)"></span><b style="color:var(--ivoire);font-weight:400">Le véhicule Beyoncé</b>&nbsp;: héros, narrateur et producteur exécutif d'une série mondiale — <em>Homecoming</em> a transformé une artiste en institution&nbsp;; «&nbsp;The Return to Kin&nbsp;» fait la même chose pour lui, depuis Kinshasa.</li>
          <li class="body" style="padding-left:26px;position:relative"><span style="position:absolute;left:0;top:11px;width:12px;height:1px;background:var(--or)"></span><b style="color:var(--ivoire);font-weight:400">Un statut institutionnel</b>&nbsp;: figure du retour, interlocuteur des gouvernements, des HBCU et des organisations panafricaines.</li>
          <li class="body" style="padding-left:26px;position:relative"><span style="position:absolute;left:0;top:11px;width:12px;height:1px;background:var(--or)"></span><b style="color:var(--ivoire);font-weight:400">Du patrimoine, pas un cachet</b>&nbsp;: des parts dans KIN Origins, KIN Routes et le festival — des actifs qui grandissent chaque année.</li>
          <li class="body" style="padding-left:26px;position:relative"><span style="position:absolute;left:0;top:11px;width:12px;height:1px;background:var(--or)"></span><b style="color:var(--ivoire);font-weight:400">L'héritage</b>&nbsp;: dans dix ans, on dira que le retour de la diaspora vers l'Afrique centrale a commencé par lui, à Kinshasa.</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<div class="closing">
  <div class="wrap">
    <h2 class="reveal">Le Ghana leur a ouvert une porte.<br>Kinshasa leur ouvre <span class="gold">la maison</span>.</h2>
    <div class="lingala reveal">NGONGA EKOKI. — L'heure est venue.</div>
    <div class="sig reveal">We are kin · Proposition de thème — Première édition KINOVA · À l'attention de Fally Ipupa</div>
  </div>
</div>

<footer>
  <div class="wrap">
    <span>Alkebulan Advisory × The Congo Initiative</span>
    <span>Document de travail confidentiel — chiffres indicatifs à valider en due diligence</span>
  </div>
</footer>
        `,
        }}
      />
    </>
  );
}
