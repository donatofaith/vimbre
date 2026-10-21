const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require('playwright');
(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { host: '127.0.0.1', port: 5174, strictPort: true } });
  const browser = await chromium.launch({ headless: true });
  try {
    const source = await readFile('dist/index.html', 'utf8');
    assert(source.includes('Someone leaving or away?'));
    assert(source.includes('It is a shared decision log and role record for teams.'));
    assert(source.includes('What does Vimbre cost?'));
    assert.equal((source.match(/<h1(?:\s|>)/g) ?? []).length, 1);
    const structured = JSON.parse(source.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)[1]);
    const questions = structured['@graph'].find(item => item['@type'] === 'FAQPage').mainEntity;
    assert.equal(questions.length, 6);
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.locator('#vimbre-boot').waitFor({state:'detached'});
    assert.equal(await page.title(), 'Vimbre | Handover and Knowledge Retention for Teams');
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('.rs-story-shell .rs-example').count(), 1);
    assert.equal(await page.locator('.rs-hero .rs-eyebrow').count(), 0);
    assert.equal(await page.locator('.rs-hero-note').count(),0);
    assert.equal(await page.locator('.rs-demo-window').count(),0);
    assert.equal(await page.locator('[data-story-source]').count(),3);
    assert.equal(await page.getByRole('link', {name:'Open workspace',exact:true}).count(), 0);
    assert.equal(await page.locator('.rs-tools-lines path').count(), 1);
    const text = await page.locator('.rs-site').innerText();
    assert(!/[—–-]/.test(text), 'No dashes in visible copy');
    assert(!/\b(seamless|powerful|streamline|empower|unlock|leverage|robust|cutting edge|revolutionise|journey|ecosystem|synergy|continuity|effortless|automatically)\b/i.test(text), 'No banned copy');
    for (const width of [320,360,640,768,1024,1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'Overflow at ' + width);
      const layout = await page.locator('.rs-story-stage').evaluate(stage => {
        const record = stage.querySelector('[data-story-record]').getBoundingClientRect();
        const sources = [...stage.querySelectorAll('[data-story-source]')].filter(el=>getComputedStyle(el).display!=='none').map(el=>el.getBoundingClientRect());
        const sam = stage.querySelector('[data-story-sam]').getBoundingClientRect();
        const alex = stage.querySelector('[data-story-alex]').getBoundingClientRect();
        const intersects = (a,b) => a.left < b.right-1 && a.right > b.left+1 && a.top < b.bottom-1 && a.bottom > b.top+1;
        const nodes = [record,...sources,sam,alex];
        const overlap = nodes.some((a,i)=>nodes.slice(i+1).some(b=>intersects(a,b)));
        const gutter = stage.querySelector('.rs-story-connections').getBoundingClientRect();
        const connected = !gutter.width || (Math.abs(gutter.left-sources[0].right)<1 && Math.abs(gutter.right-record.left)<1 && Math.abs(gutter.top+gutter.height/6-(sources[0].top+sources[0].height/2))<1);
        const line = stage.querySelector('[data-story-line]').getBoundingClientRect();
        const coverConnected = !gutter.width || (Math.abs(line.top-record.bottom)<2 && Math.abs(line.bottom-alex.top)<2 && Math.abs(line.left-(record.left+record.width/2))<2);
        return {overlap, connected, coverConnected};
      });
      assert(!layout.overlap, 'No hero card overlap at '+width);
      assert(layout.connected && layout.coverConnected,'Attached connectors at '+width);
      if ([360,768,1024,1440].includes(width)) await page.screenshot({path:'/tmp/vimbre-landing-'+width+'.png',fullPage:true});
      if (width === 1440) {
        const lines = await page.locator('h1').evaluate(el => el.clientHeight / parseFloat(getComputedStyle(el).lineHeight));
        assert(Math.abs(lines - 3) < .05, 'Approved 56px headline occupies three desktop lines');
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
    assert.equal(await page.locator('[data-story-record]').evaluate(el => getComputedStyle(el).opacity), '1');
    const plain = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await plain.newPage();
    await staticPage.goto('http://127.0.0.1:5174/');
    assert(await staticPage.getByRole('heading', { name: 'Someone leaving or away? The next person already knows where to start.' }).isVisible());
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
    await storyPage.waitForTimeout(2800);
    await storyPage.locator('.rs-story-shell').screenshot({path:'/tmp/vimbre-landing-sources.png'});
    await storyPage.waitForTimeout(2300);
    await storyPage.locator('.rs-story-shell').screenshot({path:'/tmp/vimbre-landing-record.png'});
    await storyPage.waitForFunction(() => document.querySelector('.rs-story-control').disabled, null, {timeout:35000});
    for(const selector of ['.rs-story-stage','[data-story-record]','[data-story-alex]','.rs-story-resolution']){
      assert.equal(await storyPage.locator(selector).evaluate(el => getComputedStyle(el).opacity),'1','Final hero frame restores '+selector);
    }
    const mobileContext = await browser.newContext({viewport:{width:360,height:800}});
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://127.0.0.1:5174/');
    await mobilePage.locator('#vimbre-boot').waitFor({state:'detached'});
    await mobilePage.locator('.rs-story-shell').scrollIntoViewIfNeeded();
    await mobilePage.getByRole('button',{name:'Pause hero story'}).waitFor();
    await mobilePage.waitForFunction(() => document.querySelector('.rs-story-shell').hasAttribute('data-story-complete'),null,{timeout:25000});
    assert.equal(await mobilePage.locator('[data-story-record]').evaluate(el=>getComputedStyle(el).opacity),'1');
    await mobileContext.close();
    const og = await page.request.get('http://127.0.0.1:5174/vimbre-og-image-1200.png');
    assert.equal(og.status(),200);
    const image = await og.body(); assert.equal(image.readUInt32BE(16),1200); assert.equal(image.readUInt32BE(20),630);
    assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),'https://vimbre.com/vimbre-og-image-1200.png');
    assert.deepEqual(errors, []);
    await context.close(); await plain.close(); await normal.close();
    console.log('Production landing: prerender, schema, copy, responsive widths, FAQ keyboard, reduced motion, no JS and hero pause passed.');
  } finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

