/* BFF.fill: builds the fill script a person runs themselves on an official sign-up page
   (Safari on iPhone through a Shortcut or a bookmarklet, or any desktop browser).
   It fills the person's own details into empty fields and stops. It never submits, never
   clicks, never ticks a box, never touches password, card, SSN or one-time-code fields, never
   overwrites typed text, and does nothing on a site that is not an official program domain.
   Pure string building: no DOM, no network, no storage at build time. UMD, Node-testable. */
(function (root) {
  'use strict';

  function dep(name, file) {
    if (typeof module === 'object' && module.exports && typeof require === 'function') {
      try { return require(file); } catch (e) { /* fall through to the browser global */ }
    }
    return root.BFF && root.BFF[name];
  }
  function FM() { return dep('fieldmatch', './fieldmatch.js'); }
  function EM() { return dep('email', './email.js'); }

  /* The runner below is embedded with Function.prototype.toString(). It must stay
     self-contained: ES5 only, no outer references, no line comments, explicit semicolons. */
  function bffRun(D, FM, win) {
    var BANNER_ID = 'bff-fill-banner';
    var doc = win.document;
    var TOUCH = { text: 1, email: 1, tel: 1, number: 1, date: 1, textarea: 1, select: 1 };
    var IGNORE = { hidden: 1, password: 1, checkbox: 1, radio: 1, file: 1, submit: 1, button: 1, reset: 1, image: 1, color: 1, range: 1, search: 1 };

    function removeBanner() {
      var old = doc.getElementById(BANNER_ID);
      if (old && old.parentNode) old.parentNode.removeChild(old);
    }
    function showBanner(text) {
      try {
        var host = doc.body || doc.documentElement;
        if (!host) return;
        var bar = doc.createElement('div');
        bar.id = BANNER_ID;
        bar.setAttribute('role', 'status');
        bar.setAttribute('aria-live', 'polite');
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top,0px));background:#1F2A2E;color:#FFFFFF;border-bottom:3px solid #8AB4F8;font:16px/1.35 system-ui,-apple-system,sans-serif;text-align:left;';
        var msg = doc.createElement('span');
        msg.style.cssText = 'flex:1 1 auto;color:#FFFFFF;';
        msg.textContent = text;
        var close = doc.createElement('button');
        close.setAttribute('type', 'button');
        close.textContent = 'Close';
        close.style.cssText = 'flex:none;min-width:44px;min-height:44px;padding:8px 14px;font:inherit;font-weight:600;color:#1F2A2E;background:#FFFFFF;border:2px solid #FFFFFF;border-radius:8px;cursor:pointer;';
        close.addEventListener('click', function () { removeBanner(); });
        bar.appendChild(msg);
        bar.appendChild(close);
        host.appendChild(bar);
      } catch (e) {}
    }
    function result(ok, filled, skipped, domain, message) {
      return { ok: ok, filled: filled, skipped: skipped, domain: domain, message: message };
    }

    removeBanner();
    var hostname = '', protocol = '';
    try { hostname = String(win.location.hostname || ''); protocol = String(win.location.protocol || ''); } catch (e) {}
    var domain = FM.registrableDomain(hostname);
    var matches = [], i;
    for (i = 0; i < D.programs.length; i++) if (D.programs[i].domain === domain) matches.push(D.programs[i]);
    if (!domain || !matches.length) {
      var m1 = 'This is not one of the official sign-up sites in your list. Nothing was filled. Page domain: ' + (domain || hostname || 'unknown') + '.';
      showBanner(m1);
      return result(false, 0, 0, domain, m1);
    }
    if (protocol !== 'https:') {
      var m2 = 'This page does not use a secure https connection, so nothing was filled. Page domain: ' + domain + '.';
      showBanner(m2);
      return result(false, 0, 0, domain, m2);
    }

    var profile = {}, keys = Object.keys(D.profile);
    for (i = 0; i < keys.length; i++) profile[keys[i]] = D.profile[keys[i]];
    var plus = matches[0].email || '', same = !!plus;
    for (i = 1; i < matches.length; i++) if ((matches[i].email || '') !== plus) same = false;
    if (same) profile.email = plus;

    function labelOf(d, el) {
      var bits = [], j;
      if (el.labels) for (j = 0; j < el.labels.length; j++) bits.push(el.labels[j].textContent);
      var lb = el.getAttribute('aria-labelledby');
      if (lb) {
        var ids = lb.split(/\s+/);
        for (j = 0; j < ids.length; j++) { var x = ids[j] ? d.getElementById(ids[j]) : null; if (x) bits.push(x.textContent); }
      }
      if (!bits.length && el.closest) { var l = el.closest('label'); if (l) bits.push(l.textContent); }
      return bits.join(' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    }

    function usable(d, w, el) {
      if (el.disabled || el.readOnly) return false;
      var cs = w.getComputedStyle(el), r = el.getBoundingClientRect();
      if (cs.visibility === 'hidden' || cs.display === 'none' || r.width < 2 || r.height < 2) return false;
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      var hidden = false;
      for (var a = el; a && a.nodeType === 1; a = a.parentElement) {
        var s = w.getComputedStyle(a);
        if (a.getAttribute('aria-hidden') === 'true' || a.hidden || parseFloat(s.opacity) === 0) hidden = true;
        if (s.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\(\s*(50|100)%/.test(s.clipPath || '')) hidden = true;
        if (s.overflow === 'hidden' && (a.offsetWidth < 2 || a.offsetHeight < 2) && a !== d.body) hidden = true;
      }
      var de = d.documentElement || {};
      var docW = Math.max(de.scrollWidth || 0, w.innerWidth || 0), docH = Math.max(de.scrollHeight || 0, w.innerHeight || 0);
      var ax = r.left + (w.scrollX || 0), ay = r.top + (w.scrollY || 0);
      if (ax + r.width <= 0 || ay + r.height <= 0 || ax >= docW || ay >= docH) hidden = true;
      if (el.getAttribute('tabindex') === '-1' && !labelOf(d, el) && !el.getAttribute('aria-label')) hidden = true;
      return !hidden;
    }

    function setValue(w, el, tag, value) {
      var C = tag === 'select' ? w.HTMLSelectElement : tag === 'textarea' ? w.HTMLTextAreaElement : w.HTMLInputElement;
      var desc = C && C.prototype ? Object.getOwnPropertyDescriptor(C.prototype, 'value') : null;
      if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    }
    function fire(d, w, el, name) {
      var ev;
      try { ev = new w.Event(name, { bubbles: true }); } catch (e) { ev = d.createEvent('Event'); ev.initEvent(name, true, false); }
      el.dispatchEvent(ev);
    }

    var filled = 0, skipped = 0, seen = 0;
    function scan(d, w, depth) {
      var els = d.querySelectorAll('input, select, textarea'), j;
      for (j = 0; j < els.length && seen < 600; j++) {
        var el = els[j], tag = String(el.tagName || '').toLowerCase();
        var type = tag === 'input' ? String(el.getAttribute('type') || 'text').toLowerCase() : tag;
        if (IGNORE[type] === 1) continue;
        if (!usable(d, w, el)) continue;
        var inSearch = false;
        try { inSearch = !!(el.closest && el.closest('[role="search"], search, [role="combobox"]')); } catch (e) { inSearch = true; }
        if (inSearch) { skipped++; continue; }
        seen++;
        if (!TOUCH[type] || (tag === 'select' && el.multiple)) { skipped++; continue; }
        var form = el.form;
        var hasBtn = !!(form && form.querySelector('button:not([type]), button[type=submit], input[type=submit], input[type=image]'));
        var chg = (el.getAttribute('onchange') || '') + ' ' + (form ? form.getAttribute('onchange') || '' : '');
        if (el.hasAttribute('data-auto-submit') || (!hasBtn && /submit/i.test(chg))) { skipped++; continue; }
        var empty, options = null;
        if (tag === 'select') {
          var o = el.options[el.selectedIndex];
          empty = !o || o.value === '' || (el.selectedIndex === 0 && o.disabled);
          options = [];
          for (var q = 0; q < el.options.length; q++) options.push({ value: el.options[q].value, label: String(el.options[q].textContent || '').replace(/^\s+|\s+$/g, '') });
        } else empty = el.value === '';
        if (!empty) { skipped++; continue; }
        var kind = FM.classifyField({
          type: type, autocomplete: el.getAttribute('autocomplete') || '', name: el.getAttribute('name') || '', id: el.id || '',
          placeholder: el.getAttribute('placeholder') || '', ariaLabel: el.getAttribute('aria-label') || '', label: labelOf(d, el)
        });
        var value = kind ? FM.valueFor(kind, profile, { inputType: type, options: options }) : null;
        if (value == null || value === '') { skipped++; continue; }
        try {
          setValue(w, el, tag, value);
          if (tag === 'select' ? el.value !== value : el.value === '') { skipped++; continue; }
          fire(d, w, el, 'input');
          fire(d, w, el, 'change');
          filled++;
        } catch (e) { skipped++; }
      }
      if (depth < 3) {
        var frames = d.querySelectorAll('iframe'), k;
        for (k = 0; k < frames.length; k++) {
          var cd = null;
          try { cd = frames[k].contentDocument; } catch (e) { cd = null; }
          if (cd && cd.defaultView && cd.querySelectorAll) scan(cd, cd.defaultView, depth + 1);
        }
      }
    }
    scan(doc, win, 0);

    var message = filled > 0
      ? 'Filled ' + filled + (filled === 1 ? ' field' : ' fields') + '. Check them, tick any boxes yourself, and submit when you are ready.'
      : 'Filled 0 fields. No empty fields on this page matched your details, so fill it in by hand.';
    showBanner(message);
    return result(true, filled, skipped, domain, message);
  }

  var PROFILE_KEYS = ['firstName', 'lastName', 'email', 'phone', 'address1', 'address2', 'city', 'state', 'zip', 'dueDate'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || y < 1900 || y > 2100) return '';
    var dim = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    return d > dim ? '' : y + '-' + pad(m) + '-' + pad(d);
  }
  function normDate(s) {
    s = String(s || '').trim();
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) return isoDate(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s);
    return m ? isoDate(+m[3], +m[1], +m[2]) : '';
  }

  /* JSON that is also safe inside HTML and any text field: < > & and the two JS line
     separators are written as unicode escapes, so no value can end a script or a string. */
  function safeJson(v) {
    return JSON.stringify(v)
      .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }

  function cleanProfile(profile) {
    var out = {}, p = profile && typeof profile === 'object' ? profile : {};
    PROFILE_KEYS.forEach(function (k) {
      var v = typeof p[k] === 'string' ? p[k].trim() : '';
      if (k === 'dueDate') v = normDate(v);
      if (v) out[k] = v.slice(0, 300);
    });
    return out;
  }

  /* Hosting platforms where anyone can get a sub-domain. A program on one of these is never a safe gate. */
  var SHARED_HOSTS = /^(?:github\.io|githubusercontent\.com|gitlab\.io|herokuapp\.com|blogspot\.com|wordpress\.com|myshopify\.com|wixsite\.com|weebly\.com|squarespace\.com|netlify\.app|vercel\.app|pages\.dev|workers\.dev|web\.app|firebaseapp\.com|azurewebsites\.net|cloudfront\.net|amazonaws\.com|appspot\.com|force\.com|salesforce\.com|typeform\.com|forms\.gle|google\.com|googleusercontent\.com|facebook\.com|instagram\.com|linkedin\.com|medium\.com|substack\.com|bit\.ly|tinyurl\.com|[a-z]{2}\.us|co\.uk|com\.au)$/;

  function programList(programs, profile, tagMap) {
    var fm = FM(), em = EM();
    var map = tagMap && typeof tagMap === 'object' ? tagMap : {};
    var usePlus = profile.email && em && profile.usePlusTags !== false && em.supportsPlus(profile.email) !== false;
    var seen = {}, out = [];
    (Array.isArray(programs) ? programs : []).forEach(function (p) {
      if (!p || typeof p.signupUrl !== 'string' || p.signupUrl.indexOf('https://') !== 0) return;
      var domain = fm.registrableDomain(p.signupUrl);
      if (!domain || !p.id || seen[p.id] || SHARED_HOSTS.test(domain)) return;
      seen[p.id] = true;
      var email = usePlus && (!em.inEmailFeatures || em.inEmailFeatures(p)) && typeof map[p.id] === 'string' && map[p.id] ? em.plusAddress(profile.email, map[p.id]) : '';
      out.push({ domain: domain, id: String(p.id), name: String(p.name || ''), email: email });
    });
    out.sort(function (a, b) { return a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    return out;
  }

  /* build({profile, programs, tagMap}) -> the script text. Deterministic. */
  function build(opts) {
    opts = opts || {};
    var raw = opts.profile && typeof opts.profile === 'object' ? opts.profile : {};
    var profile = cleanProfile(raw);
    var data = { profile: profile, programs: programList(opts.programs, { email: profile.email, usePlusTags: raw.usePlusTags }, opts.tagMap) };
    var fail = { ok: false, filled: 0, skipped: 0, domain: '', message: 'The fill script could not run on this page. Fill it in by hand.' };
    return '(function(){' +
      'var D=' + safeJson(data) + ';' +
      'var FM=(' + FM().factory.toString() + ')();' +
      'var R=' + bffRun.toString() + ';' +
      'var res;' +
      'try{res=R(D,FM,window);}catch(e){res=' + safeJson(fail) + ';}' +
      'try{if(typeof completion==="function")completion(res);}catch(e){}' +
      'return res;' +
      '})();';
  }

  /* bookmarklet(script) -> a javascript: URL that ends in void 0 so the page never navigates. */
  function bookmarklet(script) {
    return 'javascript:' + encodeURIComponent(String(script) + '\nvoid 0;');
  }

  var api = { build: build, bookmarklet: bookmarklet, safeJson: safeJson };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.BFF = root.BFF || {}; root.BFF.fill = api; }
})(typeof window !== 'undefined' ? window : globalThis);
