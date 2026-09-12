/**
 * Auto-réparation du service worker en développement — à exécuter AVANT les chunks de l'application.
 *
 * Contexte: un worker enregistré par une version antérieure de `public/sw.js` a pu mettre en cache
 * `/_next/static/chunks/webpack.js` (URL stable en dev, réécrite à chaque compile). Dans cet état, la
 * page charge, React échoue sur `Cannot read properties of undefined (reading 'call')`, et AUCUN
 * correctif applicatif ne peut atteindre le navigateur: la purification vit dans le worker, or le
 * worker fautif est justement ce qui empêche la nouvelle version de s'installer proprement.
 *
 * D'où ce script en ligne, rendu par `app/layout.tsx` dans le `<head>` (donc exécuté avant les
 * scripts de l'application, indépendamment de ce que React fera ensuite): s'il trouve une
 * registration, il la désenregistre, purge les caches `kredit-*`, puis recharge UNE fois — le
 * drapeau `sessionStorage` rend la boucle impossible, même si le rechargement retombe sur un cache
 * persistant. Jamais servi en production.
 *
 * Le code est volontairement en ES5, sans accents ni libellé: il est hors chaîne de localisation
 * (il s'exécute quand le reste de l'application ne tourne plus) et échappe donc aux gardes de copie.
 */
export const DEV_SW_HEAL_KEY = "kredit-dev-sw-healed";

export const DEV_SW_HEAL_SCRIPT = `(function(){
try{
if(!('serviceWorker' in navigator)||!navigator.serviceWorker.getRegistrations)return;
var k=${JSON.stringify(DEV_SW_HEAL_KEY)};
var deja=false;try{deja=!!sessionStorage.getItem(k);}catch(e){}
navigator.serviceWorker.getRegistrations().then(function(rs){
if(!rs||!rs.length)return;
if(deja)return;
try{sessionStorage.setItem(k,'1');}catch(e){}
return Promise.all(rs.map(function(r){return r.unregister();}))
.then(function(){return caches.keys();})
.then(function(ks){return Promise.all(ks.filter(function(n){return n.indexOf('kredit-')===0;}).map(function(n){return caches.delete(n);}));})
.then(function(){location.reload();});
}).catch(function(){});
}catch(e){}
})();`;
