import puppeteer from 'puppeteer';

const views = ['translator', 'dictionary', 'quiz', 'midi-lab', 'reference'];
const base = 'http://localhost:4173';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const view of views) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/#${view}`, { waitUntil: 'networkidle0', timeout: 10000 });
  await page.waitForSelector('.view', { timeout: 5000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500)); // let animations finish
  await page.screenshot({ path: `/tmp/solresol-${view}.png`, fullPage: true });
  console.log(`Captured: ${view}`);
  await page.close();
}

// Also capture mobile
for (const view of ['translator', 'dictionary']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(`${base}/#${view}`, { waitUntil: 'networkidle0', timeout: 10000 });
  await page.waitForSelector('.view', { timeout: 5000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `/tmp/solresol-${view}-mobile.png`, fullPage: true });
  console.log(`Captured mobile: ${view}`);
  await page.close();
}

await browser.close();
console.log('Done!');
