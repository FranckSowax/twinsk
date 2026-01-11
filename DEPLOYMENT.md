# Guide de Déploiement Netlify - Twinsk Company

## ✅ Étapes Complétées

1. ✅ Build de production réussi (`npm run build`)
2. ✅ Configuration Netlify créée (`netlify.toml`)
3. ✅ Connexion Netlify établie
4. ✅ Code poussé sur GitHub

## 🚀 Options de Déploiement

### Option 1 : Déploiement via Netlify CLI (Recommandé)

Exécutez cette commande dans votre terminal :

```bash
cd "/Users/sowax/Desktop/TWINSK COMPANY WEB/CascadeProjects/windsurf-project"
netlify init
```

Puis suivez les instructions :
1. Sélectionnez **"Create & configure a new project"**
2. Choisissez votre équipe Netlify
3. Nom du site : `twinsk-company` (ou votre choix)
4. Build command : `npm run build`
5. Publish directory : `.next`

Ensuite déployez :
```bash
netlify deploy --prod
```

### Option 2 : Déploiement via GitHub (Plus Simple)

1. Allez sur [https://app.netlify.com](https://app.netlify.com)
2. Cliquez sur **"Add new site"** → **"Import an existing project"**
3. Sélectionnez **GitHub**
4. Choisissez le repository **FranckSowax/twinsk**
5. Configurez :
   - **Build command** : `npm run build`
   - **Publish directory** : `.next`
   - **Framework** : Next.js
6. Cliquez sur **"Deploy site"**

### Option 3 : Déploiement Direct (Drag & Drop)

1. Allez sur [https://app.netlify.com/drop](https://app.netlify.com/drop)
2. Glissez-déposez le dossier `.next` de votre projet
3. Le site sera déployé instantanément

## 📋 Configuration Netlify

Le fichier `netlify.toml` est déjà configuré avec :

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "18"
```

## 🔧 Variables d'Environnement (si nécessaire)

Si vous avez des variables d'environnement, ajoutez-les dans :
- Netlify Dashboard → Site settings → Environment variables

## 📝 Après le Déploiement

Une fois déployé, vous obtiendrez :
- URL de production : `https://twinsk-company.netlify.app` (ou similaire)
- URL de prévisualisation pour chaque commit
- Déploiements automatiques à chaque push sur `main`

## 🎯 Fonctionnalités du Site Déployé

- ✅ Animations Framer Motion fluides
- ✅ Mode sombre/clair fonctionnel
- ✅ Images optimisées Next.js
- ✅ Performance optimale
- ✅ Responsive sur tous les appareils
- ✅ SEO optimisé

## 🐛 Résolution de Problèmes

Si vous rencontrez des erreurs :

1. **Build fails** : Vérifiez les dépendances
   ```bash
   npm install
   npm run build
   ```

2. **Images ne chargent pas** : Vérifiez `next.config.ts` pour les domaines autorisés

3. **Erreurs de déploiement** : Consultez les logs dans Netlify Dashboard

## 📞 Support

- Documentation Netlify : https://docs.netlify.com
- Documentation Next.js : https://nextjs.org/docs

---

**Note** : Le build de production a déjà été effectué avec succès. Vous êtes prêt à déployer !
