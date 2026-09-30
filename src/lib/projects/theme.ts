// Thème clair / sombre de l'espace projet : clé de mémorisation et script
// lancé avant l'affichage (pas de flash). Module neutre : importable par la
// page serveur comme par le bouton client (ThemeSwitch).

export const THEME_KEY = 'twinsk-project-theme';
export const THEME_COLORS = { light: '#ffffff', dark: '#0f172a' } as const;

/** Applique le thème mémorisé au conteneur parent du script (data-theme + color-scheme). */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var el=document.currentScript&&document.currentScript.parentElement;if(el&&(t==='light'||t==='dark')){el.setAttribute('data-theme',t);el.style.colorScheme=t;document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',t==='dark'?'${THEME_COLORS.dark}':'${THEME_COLORS.light}');});}}catch(e){}})();`;
