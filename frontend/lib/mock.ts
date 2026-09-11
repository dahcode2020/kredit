export const mockApps = [
  { id:'KRD-2026-0842', product:'Personnel • BE', amount:15000, term:48, status:'UNDER_ADMIN_REVIEW', score:'B', debt:'28%', monthly:338.62, taeg:3.99, created:'2026-09-08', updated:'2026-09-09', recommendation:'REVIEW_RECOMMENDATION' },
  { id:'KRD-2026-0831', product:'Hypothécaire • BE', amount:285000, term:240, status:'MORE_INFORMATION_REQUIRED', score:'C', debt:'41%', monthly:1612.11, taeg:3.25, created:'2026-09-05', updated:'2026-09-07', recommendation:'REVIEW_RECOMMENDATION' },
  { id:'KRD-2026-0799', product:'Professionnel • BE', amount:25000, term:60, status:'DISBURSED', score:'A', debt:'22%', monthly:463.12, taeg:4.5, created:'2026-08-20', updated:'2026-08-22', recommendation:'APPROVE_RECOMMENDATION' },
  { id:'KRD-2026-0771', product:'Personnel • BE', amount:8000, term:36, status:'DRAFT', score:'-', debt:'-', monthly:236.12, taeg:4.99, created:'2026-09-09', updated:'2026-09-09', recommendation:'-' },
];
export const mockPayments = [
  { id:'PAY-001', app:'KRD-2026-0799', amount:463.12, status:'CONFIRMED', date:'2026-09-01', method:'SEPA', psp:'mollie_9c1e' },
  { id:'PAY-002', app:'KRD-2026-0799', amount:463.12, status:'CONFIRMED', date:'2026-08-01', method:'SEPA', psp:'mollie_7b2c' },
  { id:'PAY-003', app:'KRD-2026-0799', amount:463.12, status:'PENDING', date:'2026-10-01', method:'SEPA', psp:'mollie_a3f9' },
];
export const mockInvestments = [
  { id:'INV-001', name:'BE Green Bond 2031', risk:3, amount:5000, perf:'+2.1% YTD', type:'Obligation' },
  { id:'INV-002', name:'EU Equity Core', risk:5, amount:3000, perf:'+5.4% YTD', type:'Fonds' },
];
export const mockNotifs = [
  { id:'N1', channel:'EMAIL', title:'Dossier KRD-2026-0842 en revue', body:'Votre dossier est en analyse administrative', date:'2026-09-09 14:22', read:false },
  { id:'N2', channel:'PUSH', title:'Document vérifié', body:'Votre carte identité a été vérifiée', date:'2026-09-08 09:11', read:true },
  { id:'N3', channel:'SMS', title:'Rappel échéance', body:'Échéance 463€ le 01/10', date:'2026-09-07 08:00', read:false },
];
export const mockDocs = [
  { code:'ID', label:"Carte d'identité", status:'VERIFIED', date:'2026-09-08', size:'1.2 MB' },
  { code:'INCOME_3M', label:'Fiches paie 3 mois', status:'VERIFIED', date:'2026-09-08', size:'2.4 MB' },
  { code:'PROOF_ADDRESS', label:'Justificatif domicile', status:'PENDING', date:'2026-09-08', size:'0.8 MB' },
  { code:'BANK_STATEMENTS_3M', label:'Extraits bancaires', status:'MISSING', date:'-', size:'-' },
];
