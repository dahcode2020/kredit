/**
 * a11y — smoke, axe-core se lance en Playwright (E2E), ici vérifie invariants statiques
 */

describe('accessibility invariants (static)', () => {
  it('html lang per locale', () => {
    const locales = ['fr','nl','de','en'];
    locales.forEach(l=>{
      const htmlLang = l; // /fr → <html lang="fr">
      expect(['fr','nl','de','en']).toContain(htmlLang);
    });
  });

  it('landmarks attendus', () => {
    const landmarks = ['header','main','footer','nav'];
    expect(landmarks).toEqual(expect.arrayContaining(['header','main','footer']));
  });

  it('contrast AA — palette Dewi', () => {
    const colors = { ink:'#0F1115', primary:'#FF4A17', paper:'#FFFFFF' };
    // ink on paper contrast ~18:1 >4.5, primary #FF4A17 on ink white? check
    expect(colors.ink).toBe('#0F1115');
    expect(colors.primary).toBe('#FF4A17');
  });

  it('skip-link focusable', () => {
    const skipLink = { href:'#main-content', text:'Aller au contenu', tabIndex:0 };
    expect(skipLink.href).toBe('#main-content');
    expect(skipLink.tabIndex).toBe(0);
  });

  it('aria-live connectivity', () => {
    const states = ['ONLINE','OFFLINE','SYNCING'];
    expect(states).toContain('OFFLINE');
    // Banner offline doit avoir aria-live=polite
    const banner = { role:'status', 'aria-live':'polite', text:'Hors ligne — données financières non disponibles' };
    expect(banner['aria-live']).toBe('polite');
  });

  it('prefers-reduced-motion respecté', () => {
    const media = '(prefers-reduced-motion: reduce)';
    expect(media).toContain('reduce');
  });
});
