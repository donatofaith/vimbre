/* Microsoft Clarity: optional analytics on public editorial pages only. */
(function (w, d) {
  var loaded = false, active = false, stopped = false;
  function publicPage(path) { return path === '/' || path === '/blog' || /^\/blog\/[a-z0-9-]+\/?$/.test(path); }
  function sync(path) {
    var allowed = publicPage(path) && w.vimbreAnalytics && w.vimbreAnalytics.consent === 'accepted';
    if (!allowed) {
      if (loaded && active) {
        w.clarity('consentv2', {analytics_Storage: 'denied', ad_Storage: 'denied'});
        w.clarity('stop');
        stopped = true;
      }
      active = false;
      return;
    }
    if (stopped) return; // Restart only on a fresh public document, never over a private DOM.
    if (!loaded) {
      w.clarity = w.clarity || function () { (w.clarity.q = w.clarity.q || []).push(arguments); };
      w.clarity('consentv2', {analytics_Storage: 'granted', ad_Storage: 'denied'});
      var script = d.createElement('script');
      script.async = true; script.referrerPolicy = 'origin';
      script.src = 'https://www.clarity.ms/tag/z5t36wwl41?ref=bwt';
      d.head.appendChild(script);
      loaded = true;
    }
    active = true;
  }
  // Stop before a client-side transition can render private workspace content.
  ['pushState', 'replaceState'].forEach(function (method) {
    var original = w.history[method];
    w.history[method] = function () {
      if (arguments[2] != null) { try { sync(new URL(arguments[2], w.location.href).pathname); } catch {} }
      return original.apply(this, arguments);
    };
  });
  w.addEventListener('popstate', function () { sync(w.location.pathname); });
  w.addEventListener('vimbre:analytics-consent', function () { sync(w.location.pathname); });
  sync(w.location.pathname);
})(window, document);
