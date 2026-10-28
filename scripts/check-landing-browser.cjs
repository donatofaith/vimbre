const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require('playwright');
(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { host: '127.0.0.1', port: 5174, strictPort: true } });
  let browser;try{browser=await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}) });}catch(error){await server.httpServer.close();throw error;}
  try {
    const source = await readFile('dist/index.html', 'utf8');
    assert(source.includes('Turn conversations into'));
    assert(source.includes('Vimbre AI prepares a draft.'));
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
    assert.equal(questions.length, 6);

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
    assert(await page.locator('.rs-hero-subhead').isVisible());
    assert.equal(await page.locator('.rs-hero .rs-button').count(), 1, 'One primary hero action');
    assert.equal(await page.locator('.rs-hero .rs-text-link').count(), 1, 'One quiet hero link');
    assert(await page.locator('.rf-hero-microcopy').isVisible());
    assert.equal(await page.locator('.rs-story-shell .rs-example').count(), 1);
    assert.equal(await page.locator('[data-draft-row] .md-slim-row').count(),3,'Hero uses actual My Day task rows');
    const heroCTA=page.locator('.rs-hero .rs-button');assert.equal(await heroCTA.getAttribute('href'),'/signup');assert.equal(await heroCTA.innerText(),'Start free trial');
    assert.equal(await page.locator('.rs-demo-window').count(), 1);
    assert.equal(await page.locator('.rs-check-stamp').innerText(),'Check before saving');
    assert.equal(await page.locator('[data-draft-row]').count(), 3, 'Hero draft shows three extracted actions');
    assert(await page.getByText('Check before saving', { exact: true }).count() >= 1);
    assert.equal(await page.locator('.rs-demo-scene[data-scene=email]').evaluate(el => getComputedStyle(el).opacity), '1', 'Reduced-motion hero shows the source message');
    for (const selector of ['#features','#tools','.rf-ai-trust','.rs-final']) assert.equal(await page.locator(selector).count(),0,'Repeated section removed: '+selector);
    assert.equal(await page.locator('#how-it-works').count(),1);
    assert.deepEqual(await page.locator('[data-scroll-step] h3').allInnerTexts(),['Bring it in','Vimbre AI drafts','You check','Handover']);
    assert.equal(await page.locator('.rf-tools-row small').filter({hasText:'Live'}).count(),6);
    assert.equal(await page.locator('.rf-ai-note').count(),1);
    assert.equal(await page.locator('.rf-final-cta a').getAttribute('href'),'/signup');
    for (const phrase of ['Source availability','Cover with context','In the workspace','You stay in control']) assert(!(await page.locator('.rs-site').innerText()).includes(phrase));
    for (const anchor of await page.locator('a[href*="#"]').evaluateAll(links=>links.map(link=>link.hash))) assert.equal(await page.locator(anchor).count(),1,'Navigation target exists: '+anchor);
    assert.equal(await page.locator('.rs-plan').count(), 4);
    assert.equal(await page.locator('.rf-popular-label').count(), 1);
    const perPerson = await page.locator('.rf-per-person').allInnerTexts();
    assert.equal(perPerson.length, 3);
    for (const [index, amount] of ['£2.90', '£1.98', '£1.00'].entries()) {
      assert(perPerson[index].includes(amount));
      assert(perPerson[index].includes('per person / month at full team size'));
    }
    assert.equal(await page.locator('.rs-pricing .rs-plan li').filter({ hasText: /Team chat/ }).count(), 0);
    assert(await page.getByText(/AI figures are configured request ceilings/i).isVisible());

    const accordion = page.getByRole('button', { name: 'What happens when I hit my AI limit?' });
    await accordion.focus();
    await page.keyboard.press('Enter');
    assert.equal(await accordion.getAttribute('aria-expanded'), 'true');
    assert((await page.locator('#'+await accordion.getAttribute('aria-controls')).innerText()).includes('AI drafting pauses'));

    let screenHeight=null;
    for(let step=0;step<4;step++){
      await page.locator('[data-scroll-step="'+step+'"]').evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-innerHeight*.5));
      await page.waitForFunction(index=>document.querySelector('.rf-scroll-story').dataset.activeStep===String(index),step);
      assert.equal(await page.locator('.rf-scroll-screen').evaluate(el=>getComputedStyle(el).position),'sticky');
      const currentHeight=await page.locator('.rf-scroll-screen').evaluate(el=>el.getBoundingClientRect().height);if(screenHeight!==null)assert(Math.abs(currentHeight-screenHeight)<2,'Pinned screen reserves a stable size');screenHeight=currentHeight;
      const picture=page.locator('.rf-live-screen img');await picture.scrollIntoViewIfNeeded();
      await picture.evaluate(el=>el.decode());assert(await picture.evaluate(el=>el.naturalWidth>0),'Real product screen loads for step '+step);
    }

    await page.getByLabel('Handovers per year').fill('20');
    await page.getByLabel('Hours lost per handover').fill('1.5');
    await page.getByLabel('Hourly cost in pounds').fill('40');
    assert((await page.locator('.rf-calculator-result').innerText()).includes('£1,200.00'));
    assert((await page.locator('.rf-calculator-result').innerText()).includes('£348.00'));
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    assert((await page.locator('.rs-pricing-section').innerText()).includes('subscriptions and checkout are not active yet'));

    for (const width of [320, 360, 390, 430, 640, 768, 820, 834, 1024, 1180, 1280, 1366, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      if(width>=1024){const copy=await page.locator('.rs-hero-copy').boundingBox(),demo=await page.locator('.rf-wide-demo').boundingBox();assert(demo.y>=copy.y+copy.height+24,'Information comes before the demo');assert(Math.abs(demo.x+demo.width/2-width/2)<2,'Demo is centered');assert.equal(await page.locator('.rs-hero-copy').evaluate(el=>getComputedStyle(el).textAlign),'center');assert(demo.width>=Math.min(1120,width-48)-2,'Demo uses the available width');}
      const planOrder=await page.locator('.rs-plan').evaluateAll(cards=>cards.map(card=>({name:card.querySelector('h3').textContent,box:card.getBoundingClientRect().toJSON()})).sort((a,b)=>Math.abs(a.box.y-b.box.y)>2?a.box.y-b.box.y:a.box.x-b.box.x).map(card=>card.name));
      assert.deepEqual(planOrder,['Starter','Growth','Business','Enterprise'],'Visual pricing order at '+width);
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'Horizontal overflow at ' + width);
      for (const selector of ['.rf-scroll-screen', '.rf-calculator']) {
        const box = await page.locator(selector).first().boundingBox();
        assert(box && box.x >= -1 && box.x + box.width <= width + 1, selector + ' fits at ' + width);
      }
      for (const section of ['#product-demo','#how-it-works','#pricing','#questions','#contact']) {
        await page.locator(section).scrollIntoViewIfNeeded();
        assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'No overflow after scrolling to '+section+' at '+width);
      }
      assert((await page.locator('.rs-example').count()) > 0, 'Example labels exist at ' + width);
    }
    const visibleCopy=await page.locator('.rs-site').innerText();
    assert(!/[—–-]/.test(visibleCopy),'Visible copy has no dashes or hyphens');
    assert(!/\b(seamless|powerful|streamline|empower|unlock|leverage|robust|cutting edge|revolutionise|journey|ecosystem|synergy|continuity|effortless)\b/i.test(visibleCopy),'Plain copy avoids banned marketing terms');
    assert.deepEqual(errors, []);
    await context.close();

    const normal = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const storyPage = await normal.newPage();
    storyPage.on('pageerror', error => errors.push(error.message));
    await storyPage.goto('http://127.0.0.1:5174/');
    const pause = storyPage.getByRole('button', { name: 'Pause hero story' });
    await storyPage.locator('.rs-story-shell').scrollIntoViewIfNeeded();
    await pause.waitFor({ timeout: 12000 });
    await pause.click();
    await storyPage.getByRole('button', { name: 'Play hero story' }).waitFor();
    const before = await storyPage.locator('.rs-story-stage').evaluate(el => el.getAnimations({ subtree: true }).map(animation => animation.currentTime));
    await storyPage.waitForTimeout(220);
    const after = await storyPage.locator('.rs-story-stage').evaluate(el => el.getAnimations({ subtree: true }).map(animation => animation.currentTime));
    assert.deepEqual(after, before, 'Pause freezes the signature story');
    await storyPage.getByRole('button', { name: 'Play hero story' }).click();
    await storyPage.locator('.rs-story-shell').scrollIntoViewIfNeeded();
    await storyPage.getByRole('button', { name: 'Pause hero story' }).waitFor();
    const loopCount = await storyPage.locator('.rs-story-stage').evaluate(el => el.getAnimations({ subtree: true }).some(animation => animation.effect.getTiming().iterations === Infinity));
    assert(loopCount, 'Hero story loops continuously');
    for (const name of ['email','draft','confirmed','cover']) {
      await storyPage.waitForFunction(scene => Number(getComputedStyle(document.querySelector('[data-scene="' + scene + '"]')).opacity) > .9, name, { timeout: 12000 }).catch(error => { throw new Error('Hero scene did not appear: ' + name, { cause: error }); });
    }
    await storyPage.locator('#contact').scrollIntoViewIfNeeded();
    await storyPage.waitForTimeout(150);
    const offscreenBefore=await storyPage.locator('[data-scene=draft]').evaluate(el=>el.getAnimations().map(a=>a.currentTime));
    await storyPage.waitForTimeout(220);
    assert.deepEqual(await storyPage.locator('[data-scene=draft]').evaluate(el=>el.getAnimations().map(a=>a.currentTime)),offscreenBefore,'Offscreen hero pauses');
    assert.equal(await storyPage.locator('[data-draft-row]').count(),3,'The same three task rows survive into the handover');
    assert.deepEqual(errors, []);
    await normal.close();

    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
    const staticPage = await noJs.newPage();
    await staticPage.goto('http://127.0.0.1:5174/');
    assert(await staticPage.getByRole('heading', { name: /Turn conversations into/ }).isVisible());
    assert.equal(await staticPage.locator('.rs-demo-scene[data-scene=email]').evaluate(el => getComputedStyle(el).opacity), '1');
    await noJs.close();
    const phone=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const phonePage=await phone.newPage();await phonePage.goto('http://127.0.0.1:5174/');
    const menu=phonePage.locator('.rs-menu');await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'),'true');
    await phonePage.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');
    await phone.close();
    console.log('Landing acceptance passed: copy, pricing visual order, navigation, scroll, story, product screens, calculator, responsive layout, reduced motion and no-JS fallback.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.httpServer.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
