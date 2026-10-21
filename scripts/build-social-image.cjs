const { chromium } = require('playwright');
const { readFile, writeFile } = require('node:fs/promises');
(async () => {
  const [logo, mark, heading, body] = await Promise.all([
    readFile('public/vimbre-lockup-compact-colour.svg','utf8'),
    readFile('public/vimbre-mark-colour.svg','utf8'),
    readFile('node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2'),
    readFile('node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2')
  ]);
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
    await page.setContent(`<!doctype html><html lang="en"><head><style>
      @font-face{font-family:Heading;src:url(data:font/woff2;base64,${heading.toString('base64')})} 
      @font-face{font-family:Body;src:url(data:font/woff2;base64,${body.toString('base64')})}
      *{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 90% 25%,#eaf2fe,#fff 70%);color:#102a43;width:1200px;height:630px;overflow:hidden;padding:60px 72px;font-family:Body}
      .logo svg{width:220px;height:auto}.label{margin-top:28px;color:#2563d9;font-size:18px}.title{font:700 60px/1.08 Heading;letter-spacing:-.025em;max-width:1020px;margin:18px 0 22px;position:relative;z-index:1}.title span{color:#2f80ed}.subtitle{font:400 25px/1.5 Body;max-width:1000px}.motif{position:absolute;right:-190px;bottom:-320px;opacity:.06;transform:rotate(-20deg)}.motif svg{width:850px;height:auto}
      </style></head><body><div class="motif">${mark}</div><div class="logo">${logo}</div><div class="title">Someone leaving or away? The next person <span>already knows where to start.</span></div><div class="subtitle">Capture decisions, finish tasks, and keep the context. Vimbre builds the handover as your team works.</div></body></html>`);
    await page.evaluate(()=>document.fonts.ready);
    const png = await page.screenshot({type:'png',animations:'disabled'});
    await writeFile('public/vimbre-og-image-1200.png',png);
    await writeFile('dist/vimbre-og-image-1200.png',png);
    console.log('VIMBRE_SOCIAL_PNG_BASE64='+png.toString('base64'));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});

