export const adminStats = {
  clients: 8400, demandes: 12700, enAttente: 42, aExaminer: 12, approuvees: 7100, refusees: 3200, actifs: 6800, remboursements: 2100000, investissements: 1200, alertes: 3
};
export const mockAdminApps = [
  { id:'KRD-2026-0842', customer:'Alex Martin • 32a • CDI • 3200€', amount:15000, term:48, product:'Personnel', country:'BE', status:'UNDER_ADMIN_REVIEW', score:62, grade:'C', debt:'38.4%', reco:'REVIEW', kyc:'VERIFIED', docs:'2/3', created:'2026-09-08' },
  { id:'KRD-2026-0843', customer:'Nadia El Amrani • 41a • CDD • 2800€', amount:48000, term:72, product:'Personnel', country:'BE', status:'UNDER_ADMIN_REVIEW', score:41, grade:'D', debt:'41%', reco:'REVIEW', kyc:'VERIFIED', docs:'3/3', created:'2026-09-07' },
  { id:'KRD-2026-0845', customer:'Luc Peeters • 28a • Indépendant • 4200€', amount:125000, term:180, product:'Hypothécaire', country:'BE', status:'UNDER_ADMIN_REVIEW', score:58, grade:'C', debt:'35%', reco:'REVIEW', kyc:'VERIFIED', docs:'4/5', created:'2026-09-06' },
];
export const mockCustomers = [
  { id:'CUST-101', name:'Alex Martin', email:'alex@kredit.be', kyc:'VERIFIED', risk:'Faible', country:'BE', dossiers:3, created:'2024-03-12' },
  { id:'CUST-102', name:'Nadia El Amrani', email:'nadia@kredit.be', kyc:'VERIFIED', risk:'Moyen', country:'BE', dossiers:1, created:'2025-01-20' },
  { id:'CUST-103', name:'Tom Vandevelde', email:'tom@kredit.be', kyc:'PENDING', risk:'Élevé', country:'BE', dossiers:2, created:'2026-09-01' },
];
export const mockAudit = [
  { id:'AUD-001', actor:'admin@kredit.be (ADMIN)', action:'admin.decide_exception', entity:'KRD-0842', before:'UNDER_ADMIN_REVIEW', after:'APPROVED_WITH_EXCEPTION', reason:'Client historique 10 ans, garanties', hash:'a3f9…', prev:'9c1e…', at:'2026-09-09 09:15', ip:'185.12.34.56' },
  { id:'AUD-002', actor:'system', action:'automated_review.complete', entity:'KRD-0842', before:'UNDER_AUTOMATED_REVIEW', after:'UNDER_ADMIN_REVIEW', reason:'REVIEW 62/C', hash:'7b2c…', prev:'a3f9…', at:'2026-09-09 08:07', ip:'-' },
];
