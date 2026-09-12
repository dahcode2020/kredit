/**
 * Le fuseau local du processus ne doit jamais entrer dans un résultat de test: les formatteurs
 * forcent Europe/Brussels, mais `new Date("2026-09-09 14:22")` (chaîne sans décalage) dépend, lui,
 * de la machine. On démarre donc les workers jest sur le fuseau des utilisateurs belges — ainsi un
 * parse local fautif produit une date différente de l'ancrage UTC et les verrous de
 * tests/unit/dates-timezone.spec.tsx mordent, même sur un CI en UTC.
 */
module.exports = async () => {
  process.env.TZ = "Europe/Brussels";
};
