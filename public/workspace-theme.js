/* Apply a saved workspace preference before styles paint. Public pages keep their own theme. */
(function () {
  if (!/^\/app(?:\/|$)/.test(location.pathname)) return;
  try {
    var saved = localStorage.getItem('vimbre:workspace-theme:v1');
    var dark = saved === 'dark' || (saved !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.workspaceTheme = dark ? 'dark' : 'light';
    if (dark) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0b1624');
  } catch (_) { /* Light mode remains available without browser storage. */ }
})();
