(function () {
  'use strict';
  window.BFF = window.BFF || {};
  BFF.views = BFF.views || {};

  var VIEWS = ['directory', 'info', 'tracker', 'guided', 'safety'];
  var THEMES = ['system', 'light', 'dark'];
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
  function applyTheme(t) {
    var root = document.documentElement;
    if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = 'Theme: ' + THEME_LABELS[t];
      var next = THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
      btn.setAttribute('aria-label', 'Theme: ' + THEME_LABELS[t] + '. Tap to switch to ' + THEME_LABELS[next] + '.');
    }
  }

  function currentView() {
    var name = (location.hash || '').replace(/^#/, '');
    return VIEWS.indexOf(name) === -1 ? 'directory' : name;
  }

  function guarded(fn, name) {
    try { fn(); } catch (e) { if (window.console) console.error('Bad view "' + name + '":', e); }
  }

  function route(moveFocus) {
    var name = currentView();
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
      document.title = (h2 ? h2.textContent + ' · ' : '') + 'Baby Freebies Finder';
      if (moveFocus && h2) h2.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }

  function lastChecked() {
    var newest = '';
    (BFF.programs || []).forEach(function (p) { if (p.verifiedOn && p.verifiedOn > newest) newest = p.verifiedOn; });
    var span = document.getElementById('last-checked');
    if (span && newest) span.textContent = newest;
  }

  function boot() {
    applyTheme(getTheme());
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

    VIEWS.forEach(function (v) {
      var el = document.getElementById('view-' + v);
      var view = BFF.views[v];
      if (el && view && typeof view.init === 'function' && !inited[v]) {
        inited[v] = true;
        guarded(function () { view.init(el); }, v);
      }
    });

    window.addEventListener('hashchange', function () { route(true); });
    route(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
