// Reproducible extraction from the actually rendered, immutable NEAR reference.
// Does not read a database or modify the reference checkout.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(process.env.NEAR_URL || 'http://127.0.0.1:5173/');
await page.locator('.photo-card').first().waitFor();
const css = await page.evaluate(() => {
  const roots = new Set(`chat-image-picker image-picker-heading image-picker-carousel chat-gallery-panel chat-gallery-heading chat-gallery-grid forward-friends photo-card card-open card-photo photo-shade card-distance person-details person-name person-bio card-name-row rating-line tags rate-button incoming-bell request-dot request-card request-decisions people-grid rules subtitle panel review empty empty-symbol empty-actions profile-form blocked-users full-profile-image full-profile-shade full-profile-info full-name-row full-bio profile-facts profile-interests full-profile-actions profile-back profile-page-brand profile-gallery-top profile-gallery-button profile-rate people-actions gallery-header gallery-back gallery-summary gallery-avatar gallery-facts gallery-interests gallery-demo ig-grid ig-tile tile-likes gallery-post-page post-layout post-owner post-avatar lightbox-image post-social post-like post-comment post-comments lightbox-nav gallery-atlas profile-photo portrait-viewport`.split(' '));
  const mappings = {
    '.person-details': '.person-info', '.person-name': '.person-name',
    '.person-bio': '.person-bio', '.full-profile-image': '.member-profile-image',
    '.full-profile-shade': '.member-profile-shade', '.full-profile-info': '.member-profile-info',
    '.full-bio': '.member-profile-bio', '.profile-facts': '.member-profile-facts',
    '.profile-interests': '.member-profile-interests', '.full-profile-actions': '.profile-primary-actions',
    '.profile-back': '.profile-back', '.profile-page-brand': '.member-profile-brand',
    '.profile-gallery-top': '.member-profile-gallery-top',
  };
  function visit(rules) {
    return [...rules].map(rule => {
      if (rule.type === CSSRule.STYLE_RULE) {
        const selectors = rule.selectorText.split(',').filter(s => {
          const classes = [...s.matchAll(/\.([\w-]+)/g)].map(m => m[1]);
          return classes.some(c => roots.has(c)) && !classes.some(c => /game|estate|pet-|pig-|verify|active-thread|chat-app/.test(c));
        }).map(s => ':is(#app,#profile-dialog,#asset-dialog) ' + s.trim().replace(/\.[\w-]+/g, token => mappings[token] || token));
        return selectors.length ? `${selectors.join(',')} { ${rule.style.cssText} }\n` : '';
      }
      if (rule.type === CSSRule.MEDIA_RULE) {
        const child = visit(rule.cssRules);
        return child ? `@media ${rule.conditionText} {\n${child}}\n` : '';
      }
      return '';
    }).join('');
  }
  return [...document.styleSheets].map(s => { try { return visit(s.cssRules); } catch { return ''; } }).join('');
});
await writeFile('app/near-v91.css', `/* Generated from NEAR 98bb83e44bf88eddb9822d7875f18cd4fe833ee2 app/globals.css.\n   Original rule order and breakpoints retained; only non-game visual selectors,\n   scoped to ChatGun. Run scripts/extract-near-v91.mjs against the isolated source. */\n${css}`);
await browser.close();
