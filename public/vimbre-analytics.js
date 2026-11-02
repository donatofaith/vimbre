/* One consent-gated Google tag, shared by GA4 and Google Ads. */
(function (w, d) {
  if (w.vimbreAnalytics) return;
  var choice = null, loaded = false;
  var storageKey = 'vimbre:analytics-consent:v1';
  var measurement = 'G-E599PM5PBE';
  var ads = 'AW-18551891096';
  w.dataLayer = w.dataLayer || [];
  function command() { try { w.dataLayer.push(arguments); } catch (_) {} }
  // Safe defaults also prevent callback URLs, tokens and document titles being measured.
  command('set', {page_location: 'https://vimbre.com/', page_title: 'Vimbre', page_referrer: '', send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false});
  command('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
  function load() {
    if (loaded || choice !== 'accepted') return;
    loaded = true;
    try {
      command('js', new Date());
      command('config', measurement, {send_page_view: false});
      command('config', ads, {send_page_view: false});
      var script = d.createElement('script');
      script.async = true; script.referrerPolicy = 'origin';
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurement;
      d.head.appendChild(script);
    } catch (_) { loaded = false; }
  }
  w.gtag = command;
  w.gtag_report_conversion = function (url) {
    var finished = false;
    var callback = function () {
      if (finished) return; finished = true;
      // Only same-origin destinations are allowed for optional click redirects.
      if (typeof url === 'string') {
        try { var target = new URL(url, w.location.href); if (target.origin === w.location.origin) w.location.assign(target.href); } catch (_) {}
      }
    };
    if (choice !== 'accepted') { callback(); return false; }
    command('event', 'conversion', {
      send_to: 'AW-18551891096/l-20CPe7zLAdEJjJnY5F', value: 1.0, currency: 'GBP',
      event_callback: callback, event_timeout: 1500
    });
    if (typeof url === 'string') w.setTimeout(callback, 1600);
    return false;
  };

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
