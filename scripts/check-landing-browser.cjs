const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require('playwright');
(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { host: '127.0.0.1', port: 5174, strictPort: true } });
  const browser = await chromium.launch({ headless: true });
  try {
    const source = await readFile('dist/index.html', 'utf8');
    assert(source.includes('The missing layer'));
    assert(source.includes('Vimbre is a work intelligence layer'));
    assert(source.includes('Does Vimbre capture everything automatically?'));
    assert.equal((source.match(/<h1(?:\s|>)/g) ?? []).length, 1);
    const structured = JSON.parse(source.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)[1]);
    const questions = structured['@graph'].find(item => item['@type'] === 'FAQPage').mainEntity;
    assert.equal(questions.length, 8);
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.locator('#vimbre-boot').waitFor({state:'detached'});
    assert.equal(await page.title(), 'Vimbre | Work Intelligence and Handover Context');
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('.rs-story-shell .rs-example').count(), 1);
    assert.equal(await page.locator('.rs-hero .rs-eyebrow').count(), 0);
    assert.equal(await page.locator('.rs-hero-note').count(),0);
    assert.equal(await page.locator('.rs-demo-window').count(),1);
    assert.equal(await page.locator('[data-demo-click]').count(),6);
    assert.equal(await page.getByRole('link', {name:'Open workspace',exact:true}).count(), 0);
    assert.equal(await page.locator('.rs-tools-lines path').count(), 1);
    const text = await page.locator('.rs-site').innerText();
    assert(!/[—–-]/.test(text), 'No dashes in visible copy');
    assert(!/\b(seamless|powerful|streamline|empower|unlock|leverage|robust|cutting edge|revolutionise|journey|ecosystem|synergy|continuity)\b/i.test(text), 'No banned copy');
    for (const width of [320,360,390,640,768,1024,1280,1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'Overflow at ' + width);
      const layout = await page.locator('.rs-demo-viewport').evaluate(viewport => {
        const area = viewport.getBoundingClientRect();
        const scene = viewport.querySelector('[data-scene="cover"]').getBoundingClientRect();
        const cards = [...viewport.querySelectorAll('[data-scene="cover"] .card')].map(el => el.getBoundingClientRect());
        const intersects = (a,b) => a.left < b.right-1 && a.right > b.left+1 && a.top < b.bottom-1 && a.bottom > b.top+1;
        return { inside: cards.every(card => card.left >= area.left && card.right <= area.right + 1 && card.top >= area.top && card.bottom <= area.bottom + 1), overlap: cards.some((card,i)=>cards.slice(i+1).some(other=>intersects(card,other))), sceneFits: scene.width <= area.width + 1 };
      });
      assert(layout.inside && layout.sceneFits, 'Cover cards fit the product viewport at '+width);
      assert(!layout.overlap, 'Cover cards do not overlap at '+width);
      if ([360,768,1024,1440].includes(width)) await page.screenshot({path:'/tmp/vimbre-landing-'+width+'.png',fullPage:true});
      if (width === 1440) {
        const lines = await page.locator('h1').evaluate(el => el.clientHeight / parseFloat(getComputedStyle(el).lineHeight));
        assert(lines >= 1.9 && lines <= 2.1, 'Centered headline occupies two desktop lines');
        const alignment=await page.locator('.rs-hero-copy').evaluate(el=>getComputedStyle(el).textAlign);assert.equal(alignment,'center');
        const stageWidth=await page.locator('.rf-wide-demo').evaluate(el=>el.getBoundingClientRect().width);assert(stageWidth>=1000,'Product demo uses the wide centered layout');
      }
    }
    for (let i = 0; i < questions.length; i++) {
      const button = page.locator('#faq-button-' + i);
      await button.focus(); await page.keyboard.press('Enter');
      assert.equal(await button.getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('#faq-panel-' + i + ' p').innerText(), questions[i].acceptedAnswer.text);
      await page.keyboard.press('Space');
      assert.equal(await button.getAttribute('aria-expanded'), 'false');
    }
    await page.getByRole('button',{name:/Decision Use the updated pricing model/}).focus();await page.keyboard.press('Enter');
    assert.equal(await page.getByRole('button',{name:/Decision Use the updated pricing model/}).getAttribute('aria-pressed'),'true');
    await page.getByRole('button',{name:'Review example',exact:true}).click();await page.getByLabel('Action',{exact:true}).fill('Review the revised proposal');assert.equal(await page.getByLabel('Action',{exact:true}).inputValue(),'Review the revised proposal');
    await page.getByRole('button',{name:'Next example status',exact:true}).click();assert.equal(await page.locator('.rf-current-status').innerText(),'In progress');
    await page.getByRole('button',{name:'Show related work',exact:true}).click();await page.getByText('Outcome: Completed and shared',{exact:true}).waitFor();
    await page.getByLabel('Example end date',{exact:true}).fill('2026-10-12');assert.equal(await page.locator('.rf-report section').count(),1);
    await page.getByLabel('Example end date',{exact:true}).fill('2026-10-27');assert.equal(await page.locator('.rf-report section').count(),4);
    assert.equal(await page.locator('[data-scene=cover]').evaluate(el => getComputedStyle(el).opacity), '1');
    const plain = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await plain.newPage();
    await staticPage.goto('http://127.0.0.1:5174/');
    assert(await staticPage.getByRole('heading', { name: 'The missing layer behind your work.' }).isVisible());
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
    assert(await storyPage.locator('.rs-story-stage').evaluate(el => el.getAnimations({subtree:true}).some(a => a.effect.getTiming().iterations === 2)), 'Hero stops after two loops');
    await storyPage.evaluate(() => { window.previewClicks = 0; document.querySelectorAll('.rs-demo-window button').forEach(button => button.addEventListener('click',()=>window.previewClicks++)); });
    for (const name of ['capture','draft','confirmed','saved','away','cover']) {
      await storyPage.waitForFunction(name => Number(getComputedStyle(document.querySelector(`[data-scene="${name}"]`)).opacity) > .9, name, {timeout:6000});
      if(name==='draft' || name==='cover') await storyPage.locator('.rs-story-shell').screenshot({path:`/tmp/vimbre-landing-tour-${name}.png`});
    }
    assert.equal(await storyPage.evaluate(()=>window.previewClicks),0,'Illustrated clicks never dispatch real app actions');
    assert.equal(await storyPage.locator('[data-demo-click]').count(),6);
    await storyPage.waitForFunction(() => document.querySelector('.rs-story-control').disabled, null, {timeout:40000});
    for(const selector of ['.rs-story-stage','[data-scene="cover"]','.rs-story-resolution']){
      assert.equal(await storyPage.locator(selector).evaluate(el => getComputedStyle(el).opacity),'1','Final hero frame restores '+selector);
    }
    assert.equal(await storyPage.locator('[data-demo-cursor]').evaluate(el=>getComputedStyle(el).opacity),'0');
    const mobileContext = await browser.newContext({viewport:{width:360,height:800}});
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://127.0.0.1:5174/');
    await mobilePage.locator('#vimbre-boot').waitFor({state:'detached'});
    await mobilePage.locator('.rs-story-shell').scrollIntoViewIfNeeded();
    await mobilePage.getByRole('button',{name:'Pause hero story'}).waitFor();
    await mobilePage.waitForFunction(() => document.querySelector('.rs-story-shell').hasAttribute('data-story-complete'),null,{timeout:40000});
    assert.equal(await mobilePage.locator('[data-scene=cover]').evaluate(el=>getComputedStyle(el).opacity),'1');
    await mobileContext.close();
    const og = await page.request.get('http://127.0.0.1:5174/vimbre-work-context-og-1200.png');
    assert.equal(og.status(),200);
    const image = await og.body(); assert.equal(image.readUInt32BE(16),1200); assert.equal(image.readUInt32BE(20),630);
    assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),'https://vimbre.com/vimbre-work-context-og-1200.png');
    assert.deepEqual(errors, []);
    await context.close(); await plain.close(); await normal.close();
    console.log('Production landing: prerender, schema, copy, responsive widths, FAQ keyboard, reduced motion, no JS and hero pause passed.');
  } finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

