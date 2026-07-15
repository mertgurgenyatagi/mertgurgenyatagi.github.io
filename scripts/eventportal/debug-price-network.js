// Temporary diagnostic, round 3. Round 2 proved single, isolated calls to
// biletinial.priceForLink()/biletix.priceForEventCode() succeed 100% of the
// time from GitHub Actions. But making sources run sequentially (not
// concurrently with each other) did NOT fix production -- Biletinial and
// Biletix both still resolved 0/many. The one thing round 2 didn't test:
// each source's OWN internal concurrency (Biletinial fires up to 20
// simultaneous detail-page requests; Biletix up to 30 simultaneous price
// requests) even when nothing else is running at the same time. This fires
// the exact same real links/codes from today's actual failed production
// run at increasing concurrency (1, then all-at-once) to see whether a
// burst specifically is what triggers the failure. Not part of the
// pipeline -- delete once the cause is confirmed.
const { mapLimit } = require('./lib/util');
const biletinial = require('./lib/biletinial');
const biletix = require('./lib/biletix');

const BILETINIAL_LINKS = require('fs')
  .readFileSync(__dirname + '/debug-biletinial-links.txt', 'utf8')
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean);

const BILETIX_CODES = require('fs')
  .readFileSync(__dirname + '/debug-biletix-codes.txt', 'utf8')
  .trim()
  .split(',')
  .filter(Boolean);

async function runBatch(label, items, concurrency, fn) {
  console.log(`\n=== ${label} (concurrency=${concurrency}, n=${items.length}) ===`);
  const t0 = Date.now();
  const results = await mapLimit(items, concurrency, async item => {
    try {
      const price = await fn(item);
      return { item, price, error: null };
    } catch (e) {
      return { item, price: null, error: e.message };
    }
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const ok = results.filter(r => r && r.price != null).length;
  console.log(`result: ${ok}/${items.length} resolved in ${elapsed}s`);
  for (const r of results) {
    console.log(' ', r.item, '->', r.price, r.error ? `(err: ${r.error})` : '');
  }
}

(async () => {
  console.log('Node version:', process.version);
  console.log('Biletinial links:', BILETINIAL_LINKS.length, ' Biletix codes:', BILETIX_CODES.length);

  // Sequential, one at a time -- the control.
  await runBatch('Biletinial sequential', BILETINIAL_LINKS.slice(0, 8), 1, l => biletinial.priceForLink(l));

  // Full burst, matching production's DESCRIPTION_CONCURRENCY.
  await runBatch('Biletinial burst', BILETINIAL_LINKS, 20, l => biletinial.priceForLink(l));

  await runBatch('Biletix sequential', BILETIX_CODES.slice(0, 8), 1, c => biletix.priceForEventCode(c, null, null));

  await runBatch('Biletix burst', BILETIX_CODES, 15, c => biletix.priceForEventCode(c, null, null));

  console.log('\n--- done ---');
})();
