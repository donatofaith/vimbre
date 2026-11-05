/* One consent-gated Google tag, shared by GA4 and Google Ads. */
(function (w, d) {
  if (w.vimbreAnalytics) return;
  var choice = null, loaded = false, analyticsConfigured = false, adsConfigured = false;
  var marketingKey = 'vimbre:marketing-consent:v1';
  var marketing = null;
  var storageKey = 'vimbre:analytics-consent:v1';
  var measurement = 'G-E599PM5PBE';
  var ads = 'AW-18551891096';
  w.dataLayer = w.dataLayer || [];
  function command() { try { w.dataLayer.push(arguments); } catch (_) {} }
  // Safe defaults also prevent callback URLs, tokens and document titles being measured.
  command('set', {page_location: 'https://vimbre.com/', page_title: 'Vimbre', page_referrer: '', send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false});
  command('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
  function load() {
    if (choice !== 'accepted' && marketing !== 'accepted') return;
    if (!loaded) {
      loaded = true;
      try {
        command('js', new Date());
        var script = d.createElement('script');
        script.async = true; script.referrerPolicy = 'origin';
        script.src = 'https://www.googletagmanager.com/gtag/js?id=' + (marketing === 'accepted' ? ads : measurement);
        d.head.appendChild(script);
      } catch (_) { loaded = false; return; }
    }
    if (choice === 'accepted' && !analyticsConfigured) {
      analyticsConfigured = true;
      command('config', measurement, {send_page_view: false});
    }
    if (marketing === 'accepted' && !adsConfigured) {
      adsConfigured = true;
      command('config', ads, {send_page_view: false});
    }
  }
  function updateConsent() {
    var adConsent = marketing === 'accepted' ? 'granted' : 'denied';
    command('consent', 'update', {analytics_storage: choice === 'accepted' ? 'granted' : 'denied', ad_storage: adConsent, ad_user_data: adConsent, ad_personalization: 'denied'});
    load();
  }
  function updateMarketing() {
    try { marketing = w.vimbreMeta?.consent ?? w.localStorage.getItem(marketingKey); } catch (_) {}
    updateConsent();
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
    if (marketing !== 'accepted') { callback(); return false; }
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
    updateConsent();
    if (value === 'declined') clearCookies();
    w.dispatchEvent(new Event('vimbre:analytics-consent'));
  }
  w.vimbreAnalytics = {get consent() { return choice; }, choose: function (value) { choose(value, true); }};
  updateMarketing();
  w.addEventListener('vimbre:marketing-consent', updateMarketing);
  try { var saved = w.localStorage.getItem(storageKey); if (saved) choose(saved, false); } catch (_) {}
  w.addEventListener('storage', function (event) { if (event.key === storageKey) choose(event.newValue || 'declined', false); else if (event.key === marketingKey) updateMarketing(); });
})(window, document);
