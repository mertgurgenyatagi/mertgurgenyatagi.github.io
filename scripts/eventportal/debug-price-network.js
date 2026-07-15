// Temporary, one-off diagnostic: local testing (from a residential/dev IP)
// resolves price successfully on every source, but the same code run from
// GitHub Actions resolved price on 0% of Biletinial/Biletix sessions and a
// minority of Bubilet ones in production, despite hitting real, currently
// on-sale events. This script re-runs a handful of those exact real
// requests directly from wherever it's invoked, dumping status/headers/body
// so the two environments can be compared directly. Not part of the
// pipeline -- delete once the cause is confirmed.
const { fetchWithRetry, curlFetchJson } = require('./lib/util');

async function tryFetch(label, url, opts) {
  console.log(`\n=== ${label} (native fetch) ===`);
  console.log('GET', url);
  try {
    const res = await fetchWithRetry(url, opts || {}, 1);
    const text = await res.text();
    console.log('status:', res.status, ' content-type:', res.headers.get('content-type'));
    console.log('cf-ray:', res.headers.get('cf-ray'), ' server:', res.headers.get('server'));
    console.log('body snippet:', text.slice(0, 300).replace(/\s+/g, ' '));
    console.log('contains itemprop="price":', text.includes('itemprop="price"'));
  } catch (e) {
    console.log('THREW:', e.message);
  }
}

async function tryCurlJson(label, url, headers) {
  console.log(`\n=== ${label} (curl) ===`);
  console.log('GET', url);
  try {
    const json = await curlFetchJson(url, headers || {}, 1);
    console.log('parsed OK, top-level keys:', Object.keys(json));
    console.log(JSON.stringify(json).slice(0, 400));
  } catch (e) {
    console.log('THREW:', e.message);
  }
}

const PASSO_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  Referer: 'https://www.passo.com.tr/',
};

(async () => {
  console.log('Node version:', process.version);
  console.log('Public IP check:');
  try {
    const res = await fetchWithRetry('https://api.ipify.org?format=json', {}, 1);
    console.log(await res.text());
  } catch (e) { console.log('ipify failed:', e.message); }

  await tryFetch(
    'Biletinial detail page',
    'https://biletinial.com/tr-tr/muzik/su-altindaki-dunya-temali-sulu-boya-atolyesi-akm'
  );

  await tryFetch(
    'Biletix getPerformanceList',
    'https://www.biletix.com/wbtxapi/api/v1/bxcached/event/getPerformanceList/5JBBU/INTERNET/tr'
  );
  await tryFetch(
    'Biletix getPriceByProfiles',
    'https://www.biletix.com/wbtxapi/api/v1/bxcached/event/getPriceByProfiles/5JBBU/001/INTERNET/tr'
  );

  await tryCurlJson(
    'Passo geteventdetails',
    'https://ticketingweb.passo.com.tr/api/passoweb/geteventdetails/iksv-caz-festivali-ayhan-sicimoglu-harikalar-bandosu-konser-bileti/10933321/118',
    PASSO_HEADERS
  );

  console.log('\n--- done ---');
})();
