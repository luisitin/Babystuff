(function () {
  'use strict';
  window.BFF = window.BFF || {};
  BFF.views = BFF.views || {};

  var VIEWS = ['directory', 'info', 'tracker', 'guided', 'safety'];
  var THEMES = ['system', 'light', 'dark'];
  var THEME_ICONS = { system: '\u25D0', light: '\u2600', dark: '\u263E' };
  var THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' };
  var inited = {};

  function getPrefs() {
    var p = BFF.store ? BFF.store.get('prefs.v1', {}) : {};
    return p && typeof p === 'object' ? p : {};
  }
  var memTheme = 'system';
  function getTheme() {
    var t = BFF.store ? getPrefs().theme : memTheme;
    return THEMES.indexOf(t) === -1 ? 'system' : t;
  }
  function setTheme(t) {
    memTheme = t;
    if (BFF.store) { var p = getPrefs(); p.theme = t; BFF.store.set('prefs.v1', p); }
  }
  // `touch` is false at boot while on System, so a theme the host page already chose is left alone.
  function applyTheme(t, touch) {
    var root = document.documentElement;
    if (touch !== false) { if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t); }
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      var icon = btn.querySelector('.theme-icon'), txt = btn.querySelector('.theme-text');
      if (icon) icon.textContent = THEME_ICONS[t];
      if (txt) txt.textContent = 'Theme: ' + THEME_LABELS[t];
      var next = THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
      btn.setAttribute('aria-label', 'Theme: ' + THEME_LABELS[t] + '. Tap to switch to ' + THEME_LABELS[next] + '.');
    }
  }

  // Only plain #name hashes are routes. Anything else (an empty hash, #main, a typo) shows the directory.
  function viewFromHash() {
    var name = (location.hash || '').replace(/^#/, '');
    return VIEWS.indexOf(name) !== -1 ? name : 'directory';
  }

  function guarded(fn, name) {
    try { fn(); } catch (e) { if (window.console) console.error('Bad view "' + name + '":', e); }
  }

  var shown = '';
  function route(moveFocus) {
    var name = viewFromHash();
    shown = name;
    VIEWS.forEach(function (v) {
      var el = document.getElementById('view-' + v);
      if (el) el.hidden = v !== name;
    });
    var links = document.querySelectorAll('.app-nav a');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('data-view') === name) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
    var el = document.getElementById('view-' + name);
    var view = BFF.views[name];
    if (el && view && typeof view.show === 'function') guarded(function () { view.show(el); }, name);
    if (el) {
      var h2 = el.querySelector('h2');
      document.title = (h2 ? h2.textContent + ' \u00B7 ' : '') + 'Baby Freebies Finder';
      if (moveFocus && h2) h2.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }

  // go(name): the one way the app changes views. Setting location.hash fires hashchange, which routes.
  // If the frame never delivers that event (or the hash is already set), route directly after a beat.
  var navTimer = null;
  function go(name) {
    if (VIEWS.indexOf(name) === -1) name = 'directory';
    if (navTimer) clearTimeout(navTimer);
    if (location.hash === '#' + name && shown === name) { route(true); return; }
    try { location.hash = '#' + name; } catch (e) {}
    navTimer = setTimeout(function () { navTimer = null; if (shown !== name) route(true); }, 60);
  }
  BFF.nav = { go: go, views: VIEWS.slice() };

  // Route links (#info and so on) go through go(), so they work even where plain anchor navigation does not.
  function onDocClick(e) {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var name = a.getAttribute('href').slice(1);
    if (VIEWS.indexOf(name) === -1) return;
    e.preventDefault();
    go(name);
  }

  function lastChecked() {
    var newest = '';
    (BFF.programs || []).forEach(function (p) { if (p.verifiedOn && p.verifiedOn > newest) newest = p.verifiedOn; });
    var span = document.getElementById('last-checked');
    if (span && newest) span.textContent = newest;
  }

  function boot() {
    applyTheme(getTheme(), getTheme() !== 'system');
    var btn = document.getElementById('theme-toggle');
    btn.addEventListener('click', function () {
      var next = THEMES[(THEMES.indexOf(getTheme()) + 1) % THEMES.length];
      setTheme(next);
      applyTheme(next);
    });

    if (BFF.store && BFF.store.persistent === false) {
      var n = document.getElementById('storage-notice');
      n.textContent = "This browser isn't saving data, so your info and tracker will be gone after a reload.";
      n.hidden = false;
    }

    lastChecked();

    var skip = document.querySelector('.skip-link');
    var main = document.getElementById('main');
    if (skip && main) skip.addEventListener('click', function (e) {
      e.preventDefault();
      main.focus();
    });

    VIEWS.forEach(function (v) {
      var el = document.getElementById('view-' + v);
      var view = BFF.views[v];
      if (el && view && typeof view.init === 'function' && !inited[v]) {
        inited[v] = true;
        guarded(function () { view.init(el); }, v);
      }
    });

    VIEWS.forEach(function (v) {
      var sec = document.getElementById('view-' + v);
      var ref = sec && sec.getAttribute('aria-labelledby');
      if (ref && !document.getElementById(ref) && window.console) console.warn('view-' + v + ': missing heading #' + ref);
    });

    document.addEventListener('click', onDocClick);
    window.addEventListener('hashchange', function () { if (navTimer) { clearTimeout(navTimer); navTimer = null; } route(true); });
    route(false);
    // Ask the host about file saving after first paint, so the answer is ready before anyone taps Save.
    if (BFF.host && BFF.host.warm) setTimeout(function () { try { BFF.host.warm(); } catch (e) {} }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
