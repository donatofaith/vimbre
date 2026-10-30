/* One consent-gated GTM container. Configure GA4 G-E599PM5PBE inside this container. */
(function (w, d) {
  if (w.vimbreAnalytics) return;
  var choice = null, loaded = false;
  var storageKey = 'vimbre:analytics-consent:v1';
  var measurement = 'G-E599PM5PBE';
  var container = 'GTM-KTXM87CG';
  w.dataLayer = w.dataLayer || [];
  function command() { try { w.dataLayer.push(arguments); } catch (_) {} }
  // Safe defaults also prevent callback URLs, tokens and document titles being measured.
  command('set', {page_location: 'https://vimbre.com/', page_title: 'Vimbre', page_referrer: '', send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false});
  command('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
  function load() {
    if (loaded || choice !== 'accepted') return;
    loaded = true;
    if (d.querySelector('script[src*="googletagmanager.com/gtm.js?id=' + container + '"]')) return;
    // Google's standard GTM initialization; no parallel gtag.js installation.
    try {
      w.dataLayer.push({'gtm.start': Date.now(), event: 'gtm.js'});
      var script = d.createElement('script');
      script.async = true; script.referrerPolicy = 'origin';
      script.src = 'https://www.googletagmanager.com/gtm.js?id=' + container;
      d.head.appendChild(script);
    } catch (_) { loaded = false; }
  }
  function clearCookies() {
    try {
      var domains = ['', w.location.hostname, '.' + w.location.hostname, '.vimbre.com'];
      d.cookie.split(';').forEach(function (part) {
        var name = part.split('=')[0].trim();
        if (!/^(_ga($|_)|_gid$|_gat($|_))/.test(name)) return;
        domains.forEach(function (domain) { d.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax' + (domain ? '; domain=' + domain : ''); });
      });
    } catch (_) {}
  }
  function choose(value, persist) {
    if (value !== 'accepted' && value !== 'declined') return;
    choice = value;
    if (persist) { try { w.localStorage.setItem(storageKey, value); } catch (_) {} }
    w['ga-disable-' + measurement] = value !== 'accepted';
    command('consent', 'update', {analytics_storage: value === 'accepted' ? 'granted' : 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
    if (value === 'accepted') load(); else clearCookies();
    w.dispatchEvent(new Event('vimbre:analytics-consent'));
  }
  w.vimbreAnalytics = {get consent() { return choice; }, choose: function (value) { choose(value, true); }};
  try { var saved = w.localStorage.getItem(storageKey); if (saved) choose(saved, false); } catch (_) {}
  w.addEventListener('storage', function (event) { if (event.key === storageKey) choose(event.newValue || 'declined', false); });
})(window, document);
