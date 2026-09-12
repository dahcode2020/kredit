# Brief de reprise — ce qu'il faut garder, ce qu'il faut cesser de faire

À coller (ou à pointer) dans la nouvelle discussion, avec le dossier `reprise/` comme matériel de
départ. Rien ici n'est une préférence : chaque ligne correspond à un défaut rencontré, mesuré, et
parfois corrigé deux fois dans `dahcode2020/kredit`.

## 1. Ce que ce dossier contient (copie tel quel dans le nouveau repo)

| Chemin | Ce que c'est | Pourquoi le garder |
| --- | --- | --- |
| `i18n/{fr,en,nl,de}/*.json` (45 fichiers, **706 clés**) | Toute la copie du site, par namespace | C'est le plus long à réécrire à la main, et le plus facile à mal faire. Les 4 langues sont alignées au caractère près. |
| `styles/couche-visuelle.css` | Design system : utilitaires de section, Motion, Formulaire, **les 4 sorties de secours** | 270 lignes qui encodent « une animation ne doit jamais cacher du contenu ». |
| `styles/tailwind.theme.js` | Encres, surface, primaire #FF4A17, Raleway/Inter, ombres `card`/`soft` | La signature visuelle du projet, mesurée sur l'existant. |
| `gardes/*.mjs` | 6 contrôles statiques + le barème de copie | Le garde-fou a rattrapé chaque dérive dans cette session. À installer au **premier** commit. |
| `gardes/credit-engine.ts`, `gardes/auth-service.ts` | Moteur de crédit à table générée ; règles de validation du portail | Deux exemples de « une seule source de vérité », avec leurs règles de validation hors composant. |
| `motion/*` | 4 primitives React (Reveal, CountUp, ScrollProgress, Parallax) + `lib/motion.ts` | Un seul écouteur de scroll partagé, `prefers-reduced-motion` respecté, aucun `style` inline au render. |
| `tests/*` | 6 suites : parité des clés, hydratation, mouvement, portail, grille, Immutabilité | Les tests sont la vraie documentation des contraintes. |

À ne **pas** reprendre tels quels : les 119 pages statiques (une façade), les contrôleurs Nest qui
répondent des payloads codés en dur (`auth.controller.ts` renvoie `'eyJ…'`), les 4 clés legacy
présentes en français uniquement (`address.format`, `common.nav.home`, `credit.simulator.legal`,
`legal.disclaimer.simulation`) — à traduire ou supprimer.

## 2. Langage visuel (les chiffres, pas l'impression)

- **Marque** : primaire `#FF4A17` (hover `#E8450A`, light `#FFF0EC`, dark `#CC3A12`), encre `#0F1115`
  /`#1A1E26`/`#2A303C`, surface `#F8F9FA`. Ombres `0 10px 30px -10px rgba(0,0,0,.12)` et
  `0 4px 24px rgba(0,0,0,.06)`. Rayons 14–28 px et `rounded-full` pour tout ce qui est bouton/pillule.
- **Typo** : Raleway 700–800 en display (h1–h4, titres de section), Inter en corps. Titres de section
  en 13 px, `tracking-[0.18em]`, majuscules, couleur primaire — le contraste 40 px / 13 px est ce qui
  fait « fintech », pas la couleur.
- **Mouvement** : deux courbes (`cubic-bezier(.22,.61,.36,1)` et `(.16,1,.3,1)`), une durée
  d'entrée 0,62 s, une sortie lente 1,1 s maximum ; **`transform` et `opacity` seulement** (jamais
  `width`/`height`/`top`/`margin` : chaque frame recalculerait la page). Rafales calculées
  (`retard={i * 80}`), jamais aléatoires.
- **Les 4 échappatoires, non négociables** : `prefers-reduced-motion` neutralise *l'état* (pas
  seulement la durée) ; `<noscript>` dans le `<head>` rend `[data-reveal]` lisible ; `@media print`
  idem ; `@media (hover: none)` tue les états de survol collants au tactile.

## 3. Données métier : une valeur = une table = un endroit

Grille commerciale en vigueur (Belgique) : **le taux suit le montant, pas le produit**.

| Tranche | Taux | | Produit | Montant | Durée |
| --- | --- |---| --- | --- | --- |
| 1 500–50 000 € | 2,50 % | | Personnel | 1 500–200 000 € | 12–84 m |
| 50 001–500 000 € | 1,90 % | | Hypothécaire | 20 000–1 000 000 € | 60–300 m |
| 500 001–1 000 000 € | 1,80 % | | Professionnel | 20 000–3 000 000 € | 12–120 m |
| > 1 000 000 € | 1,50 % | | Investissement | 200 000–30 000 000 € | 24–240 m |

Ce nombre a vécu en **six exemplaires** (moteur, service de règles backend, deux services de démo,
tuiles de l'accueil, descriptions des dictionnaires) — et chaque changement n'en atteignait que
deux. La règle à poser dès le premier commit : **les règles sont une table, les écrans la lisent** ;
les identifiants de règle (`rate_BE_PERSONAL_1500_50000`) sortent dans l'audit et le `meta` de réponse.
Effet de bord à accepter et afficher : sur 1 500 € / 12 mois, le TAEG est de 7,50 % — les 75 € de
frais minimum pèsent 5 % sur un an. Un « dès 2,50 % » sans ce détail est une promesse fausse.

## 4. Contrat d'hydratation (les quatre règles qui ont sauvé ce projet)

1. **Aucune API navigateur au render** : `matchMedia`, `IntersectionObserver`, `window.scrollY`,
   `localStorage`, `Date.now()` → uniquement en effet ou dans un gestionnaire. Un état qui dépend de
   l'environnement au premier rendu client = « Hydration failed ».
2. **L'état caché vit dans la feuille de style**, jamais dans `style={{ opacity: 0 }}` : seul le CSS
   est annulable par les médias queries et par `<noscript>`.
3. **Formatage `Intl` identique des deux côtés** : passer par `normalizeIntlSpaces` (l'espace fine
   U+202F du serveur contre l'insécable U+00A0 du navigateur a cassé ce site plus d'une fois), et la
   locale vient **du segment `[locale]`**, jamais d'un défaut codé en dur.
4. **Un nombre animé revient à la chaîne du serveur** : `CountUp` reçoit `final` (le texte rendu) et y
   revient à la fin de la montée — l'animation ne recompose jamais le libellé.

## 5. Les gardes, et le défaut dont chacun est né

| Garde | Ce qu'il interdit | Origine |
| --- | --- | --- |
| `check:hydration` | API navigateur au render, locale implicite, date au render, URL préfixée par une langue, document HTML mis en cache par le service worker, chunk non haché en cache, worker enregistré en dev, `respondWith` rendant autre chose qu'une `Response`, mouvement sans repli, `@keyframes` orphelin, contenu caché au render | Le « le site disparaît après être apparu » : un worker qui renvoyait `null` tuait la requête du chunk manquant. |
| `check:dom-nesting` | `<button>` dans `<a>`, `<div>` dans `<p>`, imbrications invalides | Le navigateur « réparait » le HTML, React hydratait autre chose. |
| `check:copy` | Copie française nouvelle dans `app/`/`components/`/`features/` (budget **décroissant**), clé manquante dans une langue, accent en dur comme défaut de prop | `/nl` et `/de` servaient des menus français. |
| `check:links` (routes) | Lien interne qui ne pointe aucune route existante | Le README promettait `/fr/admin` (inexistant) et l'accueil avait un bouton de demande **sans action**. |
| `check:assets` | Ressource référencée par le HTML et non servie | Un serveur tout vert au terminal et une page blanche dans le navigateur : le seul contrôle qui tranche. |
| `check:state` | Poste dans un état incohérent (pull non arrivé, `.next` mélangé dev/prod, compilation plus vieille que les sources, fichier servi ≠ fichier du disque) | Deux compilations partageant le même dossier produisaient exactement la panne « reading 'call' ». |

Les installer au commit n°1, avec le script `npm run check` qui les enchaîne, **et la CI qui les
exécute**. Ils ne valent que si quelqu'un — ou GitHub Actions — les lance.

## 6. Ce qu'il faut cesser de faire (liste courte, tous vécus ici)

- Livrer 119 pages simulées au lieu de 5 pages vraies ; une route qui existe mais ne fait rien est
  **pire** qu'une route absente (le visiteur conclut que le produit est faux).
- Promettre dans le README un écran, un compte ou un rôle qui n'existe pas.
- Faire croire à une connexion : un bouton qui fabrique un token aléatoire au lieu d'appeler
  l'authentification. Le rôle vient du compte, jamais d'un sélecteur d'interface.
- Mettre en cache une URL non hachée (en dev, `webpack.js` est stable et réécrit à chaque compile).
- Répondre à un symptôme par un outil de plus sans livrer l'écran. (Leçon de méthode, pour l'agent
  comme pour l'équipe : **une correction = un écran visible + une ligne « ce que je n'ai pas vérifié »**.)
- Travailler sur un dépôt sans historique utilisable. Le commit initial de cette session
  (`0edea59`) contenait **un seul fichier, `README.md`** : 461 fichiers et 53 000 lignes ont été
  déposés d'un bloc. Sans commit par décision, on ne peut plus dire pourquoi quoi que ce soit est là.

## 7. Premier slice demandé : la page d'accueil, irréprochable (UX d'abord)

Périmètre : **une** page, en 4 langues, animée, sans une seule donnée fausse à l'écran.

Acceptation, à cocher avant de dire « c'est bon » :
- [ ] chaque chiffre affiché vient d'une table (grille de taux, plafonds, taux plancher par produit) ;
- [ ] aucun texte en dur : 100 % passe par les 706 clés, contrôle de parité dans les 4 langues au CI ;
- [ ] les 6 gardes passent, en local **et** en CI ;
- [ ] `prefers-reduced-motion` : plus rien ne bouge, tout reste lisible ; JS désactivé : idem ;
- [ ] scroll, survol, focus clavier et onglet actif fonctionnent sur mobile réel (pas seulement au clavier) ;
- [ ] le CTA du simulateur mène à quelque chose qui existe (sinon : pas de CTA) ;
- [ ] `npm run check:assets` à 0 échec sur les 4 locales ; build sans erreur, nombre de routes = nombre voulu.

Ensuite seulement, dans l'ordre : simulateur → demande pré-remplie → portail (connexion + inscription
+ second facteur) → tableau de bord client. Un écran par passe, visible, avec ce qui n'a pas été vérifié.
