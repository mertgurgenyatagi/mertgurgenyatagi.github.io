// Temporary, one-off diagnostic, round 2. Round 1 proved the raw HTTP layer
// is fine from GitHub Actions (Biletinial/Biletix both returned real 200s
// with the right content) -- but the ACTUAL production run still resolved
// price on 0% of Biletinial/Biletix events despite descriptions (extracted
// from the exact same fetched page, in Biletinial's case) coming through
// fine. That means the bug is downstream of the fetch, inside this app's own
// extraction code, not the network/environment. This calls the real,
// unmodified exported functions directly (not hand-rolled re-implementations
// like round 1) so there's zero gap between what's tested and what runs in
// production. Not part of the pipeline -- delete once the cause is found.
const { fetchWithRetry } = require('./lib/util');
const biletinial = require('./lib/biletinial');
const biletix = require('./lib/biletix');

const BILETINIAL_LINK = 'https://biletinial.com/tr-tr/muzik/su-altindaki-dunya-temali-sulu-boya-atolyesi-akm';
const BILETIX_CODE = '5JBBU';

(async () => {
  console.log('Node version:', process.version);

  console.log('\n=== biletinial.priceForLink() -- the real exported function ===');
  try {
    const price = await biletinial.priceForLink(BILETINIAL_LINK);
    console.log('result:', price);
  } catch (e) {
    console.log('THREW:', e.stack);
  }

  console.log('\n=== raw HTML inspection: how many itemprop="price" blocks, and what does the regex actually see ===');
  const res = await fetchWithRetry(BILETINIAL_LINK);
  const html = await res.text();
  console.log('html length:', html.length);
  const allOccurrences = [...html.matchAll(/itemprop="price"/g)];
  console.log('total itemprop="price" occurrences:', allOccurrences.length);
  const m = html.match(/itemprop="price"[\s\S]*?content="([^"]*)"/);
  console.log('first-match regex result:', m ? JSON.stringify(m[1]) : 'NO MATCH');
  if (m) {
    const idx = html.indexOf(m[0]);
    console.log('matched span length:', m[0].length, ' starts at index:', idx);
    console.log('context around match:', JSON.stringify(html.slice(Math.max(0, idx - 60), idx + m[0].length + 60)));
  }

  console.log('\n=== biletix.priceForEventCode() -- the real exported function ===');
  try {
    const price = await biletix.priceForEventCode(BILETIX_CODE, null, null);
    console.log('result:', price);
  } catch (e) {
    console.log('THREW:', e.stack);
  }

  console.log('\n--- done ---');
})();
