const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require('playwright');
(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { host: '127.0.0.1', port: 5174, strictPort: true } });
  const browser = await chromium.launch({ headless: true });
  try {
    const source = await readFile('dist/index.html', 'utf8');
    assert(source.includes('Turn conversations into'));
    assert(source.includes('Paste a conversation or connect your tools.'));
    assert(source.includes('What happens when I hit my AI limit?'));
    assert(!source.includes('Direct connections to Teams, email and task tools are planned'));
    assert(!source.includes('12/10/2026'));
    assert.equal(source.split('<h1').length - 1, 1);
    const schemaOpen = source.indexOf('<script type="application/ld+json">');
    assert(schemaOpen >= 0, 'Prerendered structured data exists');
    const schemaStart = schemaOpen + '<script type="application/ld+json">'.length;
    const schemaEnd = source.indexOf('</script>', schemaStart);
    const structured = JSON.parse(source.slice(schemaStart, schemaEnd));
    const questions = structured['@graph'].find(item => item['@type'] === 'FAQPage').mainEntity;
    assert.equal(questions.length, 9);

    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.locator('#vimbre-boot').waitFor({ state: 'detached' });
    assert.equal(await page.title(), 'Vimbre | Turn Conversations into Actions and Handovers');
    assert.equal(await page.locator('h1').count(), 1);
    assert((await page.getByRole('heading', { level: 1 }).innerText()).includes('Turn conversations into'));
    assert(await page.getByText(/Paste a conversation or connect your tools/).isVisible());
    assert.equal(await page.locator('.rs-hero .rs-button').count(), 1, 'One primary hero action');
    assert.equal(await page.locator('.rs-hero .rs-text-link').count(), 1, 'One quiet hero link');
    assert(await page.getByText('No checkout at signup.', { exact: false }).isVisible());
    assert.equal(await page.locator('.rs-story-shell .rs-example').count(), 1);
    assert.equal(await page.locator('.rs-demo-window').count(), 1);
    assert.equal(await page.locator('[data-demo-click]').count(), 6);
    assert.equal(await page.locator('.rs-demo-scene[data-scene=email]').evaluate(el => getComputedStyle(el).opacity), '1', 'Reduced-motion hero shows the source message');
    assert.equal(await page.locator('.rf-scroll-step').count(), 4);
    assert.deepEqual(await page.locator('.rf-scroll-step h3').allInnerTexts(), ['Bring it in', 'Vimbre AI drafts', 'You check', 'Handover']);
    assert.equal(await page.locator('.rf-scroll-screen .rs-example').count(), 1);
    assert.equal(await page.locator('.rf-history').count(), 0, 'Week-by-week filler removed');
    assert.equal(await page.locator('#problem').count(), 0, 'Repeated context section removed');
    assert.equal(await page.locator('.rf-tool-status').count(), 7);
    assert(await page.getByText('Paste email or notes', { exact: true }).isVisible());
    assert.equal(await page.getByText('Setup required', { exact: true }).count(), 6);
    assert.equal(await page.locator('.rs-plan').count(), 4);
    assert.equal(await page.locator('.rf-popular-label').count(), 1);
    assert.deepEqual(await page.locator('.rf-per-person').allInnerTexts(), [
      '£2.90 per person / month at full team size',
      '£1.98 per person / month at full team size',
      '£1.00 per person / month at full team size',
    ]);
    assert.equal(await page.locator('.rs-pricing .rs-plan li').filter({ hasText: /Team chat/ }).count(), 0);
    assert(await page.getByText(/monthly per-plan caps will be published only after costs are verified/i).isVisible());

    const accordion = page.getByRole('button', { name: 'What happens when I hit my AI limit?' });
    await accordion.focus();
    await page.keyboard.press('Enter');
    assert.equal(await accordion.getAttribute('aria-expanded'), 'true');
    assert((await page.locator('#faq-panel-4').innerText()).includes('AI drafting pauses'));

    await page.getByLabel('Start date', { exact: true }).fill('9 Nov 2026');
    await page.getByLabel('End date', { exact: true }).fill('27 Nov 2026');
    assert.equal(await page.locator('.rf-report section').count(), 4);
    await page.getByLabel('End date', { exact: true }).fill('12 Nov 2026');
    assert.equal(await page.locator('.rf-report section').count(), 2);
    assert.equal(await page.locator('.rf-report time').first().innerText(), '9 Nov 2026');

    await page.getByLabel('Handovers per year').fill('20');
    await page.getByLabel('Hours lost per handover').fill('1.5');
    await page.getByLabel('Hourly cost in pounds').fill('40');
    assert((await page.locator('.rf-calculator-result').innerText()).includes('£1,200.00'));
    assert((await page.locator('.rf-calculator-result').innerText()).includes('£348.00'));
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    assert((await page.locator('.rs-pricing-section').innerText()).includes('subscriptions are not active yet'));

    for (const width of [320, 360, 390, 430, 640, 768, 820, 834, 1024, 1180, 1280, 1366, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'Horizontal overflow at ' + width);
      for (const selector of ['.rf-scroll-screen', '.rf-tools-status', '.rf-calculator']) {
        const box = await page.locator(selector).first().boundingBox();
        assert(box && box.x >= -1 && box.x + box.width <= width + 1, selector + ' fits at ' + width);
      }
      assert((await page.locator('.rs-example').count()) > 0, 'Example labels exist at ' + width);
    }
    assert.deepEqual(errors, []);
    await context.close();

    const normal = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const storyPage = await normal.newPage();
    storyPage.on('pageerror', error => errors.push(error.message));
    await storyPage.goto('http://127.0.0.1:5174/');
    const pause = storyPage.getByRole('button', { name: 'Pause hero story' });
    await pause.waitFor({ timeout: 12000 });
    await pause.click();
    await storyPage.getByRole('button', { name: 'Play hero story' }).waitFor();
    const before = await storyPage.locator('.rs-story-stage').evaluate(el => el.getAnimations({ subtree: true }).map(animation => animation.currentTime));
    await storyPage.waitForTimeout(220);
    const after = await storyPage.locator('.rs-story-stage').evaluate(el => el.getAnimations({ subtree: true }).map(animation => animation.currentTime));
    assert.deepEqual(after, before, 'Pause freezes the signature story');
    await storyPage.getByRole('button', { name: 'Play hero story' }).click();
    await storyPage.getByRole('button', { name: 'Pause hero story' }).waitFor();
    const loopCount = await storyPage.locator('.rs-story-stage').evaluate(el => el.getAnimations({ subtree: true }).some(animation => animation.effect.getTiming().iterations === Infinity));
    assert(loopCount, 'Hero story loops continuously');
    for (const name of ['email', 'capture', 'draft', 'confirmed', 'saved', 'away', 'cover']) {
      await storyPage.waitForFunction(scene => Number(getComputedStyle(document.querySelector('[data-scene="' + scene + '"]')).opacity) > .9, name, { timeout: 8000 });
    }
    assert.deepEqual(errors, []);
    await normal.close();

    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
    const staticPage = await noJs.newPage();
    await staticPage.goto('http://127.0.0.1:5174/');
    assert(await staticPage.getByRole('heading', { name: /Turn conversations into/ }).isVisible());
    assert.equal(await staticPage.locator('.rs-demo-scene[data-scene=email]').evaluate(el => getComputedStyle(el).opacity), '1');
    await noJs.close();
    console.log('Landing copy, four-step story, dates, pricing math, calculator, responsive layout, reduced motion and no-JS fallback passed.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.httpServer.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
