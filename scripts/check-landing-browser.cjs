const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require('playwright');
(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { host: '127.0.0.1', port: 5174, strictPort: true } });
  const browser = await chromium.launch({ headless: true });
  try {
    const source = await readFile('dist/index.html', 'utf8');
    assert(source.includes('Know what your team decided'));
    assert(source.includes('Vimbre is a shared decision log for teams.'));
    assert(source.includes('What does Vimbre cost?'));
    assert.equal((source.match(/<h1(?:\s|>)/g) ?? []).length, 1);
    const structured = JSON.parse(source.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)[1]);
    const questions = structured['@graph'].find(item => item['@type'] === 'FAQPage').mainEntity;
    assert.equal(questions.length, 5);
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { level: 1 }).waitFor();
    assert.equal(await page.title(), 'Vimbre | Decision Records for Teams and Handovers');
    assert.equal(await page.locator('h1').count(), 1);
    const text = await page.locator('.rs-site').innerText();
    assert(!/[—–-]/.test(text), 'No dashes in visible copy');
    assert(!/\b(seamless|powerful|streamline|empower|unlock|leverage|robust|cutting edge|revolutionise|journey|ecosystem|synergy|continuity|effortless|automatically)\b/i.test(text), 'No banned copy');
    for (const width of [320,360,640,768,1024,1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'Overflow at ' + width);
    }
    for (let i = 0; i < questions.length; i++) {
      const button = page.locator('#faq-button-' + i);
      await button.focus(); await page.keyboard.press('Enter');
      assert.equal(await button.getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('#faq-panel-' + i + ' p').innerText(), questions[i].acceptedAnswer.text);
      await page.keyboard.press('Space');
      assert.equal(await button.getAttribute('aria-expanded'), 'false');
    }
    assert.equal(await page.locator('.rs-story-record').evaluate(el => getComputedStyle(el).opacity), '1');
    const plain = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await plain.newPage();
    await staticPage.goto('http://127.0.0.1:5174/');
    assert(await staticPage.getByRole('heading', { name: 'Know what your team decided, when and why.' }).isVisible());
    assert(await staticPage.getByText('Nothing lost.', { exact: true }).isVisible());
    const normal = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const storyPage = await normal.newPage();
    await storyPage.goto('http://127.0.0.1:5174/');
    const pause = storyPage.getByRole('button', { name: 'Pause hero story' });
    await pause.waitFor(); await pause.click();
    await storyPage.getByRole('button', { name: 'Play hero story' }).waitFor();
    const before = await storyPage.locator('.rs-story-stage').evaluate(el => el.getAnimations({ subtree: true }).map(a => a.currentTime));
    await storyPage.waitForTimeout(250);
    const after = await storyPage.locator('.rs-story-stage').evaluate(el => el.getAnimations({ subtree: true }).map(a => a.currentTime));
    assert.deepEqual(after, before, 'Pause freezes the whole story');
    await storyPage.getByRole('button', { name: 'Play hero story' }).click();
    await storyPage.getByRole('button', { name: 'Pause hero story' }).waitFor();
    await storyPage.locator('#pricing').scrollIntoViewIfNeeded();
    await storyPage.waitForTimeout(200);
    assert(await storyPage.locator('.rs-story-stage').evaluate(el => el.getAnimations({ subtree: true }).every(a => a.playState !== 'running')));
    await storyPage.locator('.rs-story-shell').scrollIntoViewIfNeeded();
    await storyPage.waitForTimeout(100);
    assert(await storyPage.locator('.rs-story-stage').evaluate(el => el.getAnimations({subtree:true}).some(a => a.effect.getTiming().iterations === 3)), 'Hero stops after three loops');
    await storyPage.locator('.rs-story-stage').evaluate(el => el.getAnimations({subtree:true}).forEach(a => { a.playbackRate = 100 }));
    await storyPage.waitForFunction(() => document.querySelector('.rs-story-control').disabled, null, {timeout:10000});
    for(const selector of ['.rs-story-stage','.rs-story-record','.rs-story-alex','.rs-story-resolution']){
      assert.equal(await storyPage.locator(selector).evaluate(el => getComputedStyle(el).opacity),'1','Final hero frame restores '+selector);
    }
    const og = await page.request.get('http://127.0.0.1:5174/vimbre-og-image-1200.png');
    assert.equal(og.status(),200);
    const image = await og.body(); assert.equal(image.readUInt32BE(16),1200); assert.equal(image.readUInt32BE(20),630);
    assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),'https://vimbre.com/vimbre-og-image-1200.png');
    assert.deepEqual(errors, []);
    await context.close(); await plain.close(); await normal.close();
    console.log('Production landing: prerender, schema, copy, responsive widths, FAQ keyboard, reduced motion, no JS and hero pause passed.');
  } finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
