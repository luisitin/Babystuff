// BFF.host: where the page runs (standalone or Claude artifact) and how files, copying and links behave there.
// UMD so Node tests can load it; everything environment-specific is looked up at call time.
(function (root) {
  'use strict';

  // Extensions the artifact's downloads capability accepts. Anything else is wrapped in a zip.
  var ALLOWED = ('gif png jpg jpeg webp mp4 webm mov txt json md docx pptx epub csv ttf html svg pdf xlsx zip fig').split(' ');
  var MIME_FALLBACK = 'text/plain';
  var cache = {};
  var panelSeq = 0;

  function runtime() {
    try {
      var c = root.claude;
      return c && typeof c.use === 'function' ? c : null;
    } catch (e) { return null; }
  }
  function inArtifact() { return !!runtime(); }

  // Promise of a capability namespace or null. Memoized per name. Never throws and never rejects.
  function use(name) {
    name = String(name);
    if (Object.prototype.hasOwnProperty.call(cache, name)) return cache[name];
    var p;
    try {
      var c = runtime();
      p = c ? Promise.resolve(c.use(name)).then(function (ns) { return ns || null; }, function () { return null; }) : Promise.resolve(null);
    } catch (e) { p = Promise.resolve(null); }
    cache[name] = p;
    return p;
  }

  function zipApi() {
    if (root.BFF && root.BFF.zip) return root.BFF.zip;
    if (typeof module === 'object' && typeof require === 'function') { try { return require('./zip.js'); } catch (e) {} }
    return null;
  }
  function extOf(name) {
    var m = /\.([A-Za-z0-9]+)$/.exec(String(name));
    return m ? m[1].toLowerCase() : '';
  }
  function allowedExt(name) { return ALLOWED.indexOf(extOf(name)) >= 0; }
  function baseOf(name) { return String(name).replace(/\.[A-Za-z0-9]+$/, '') || String(name); }

  function standaloneSave(name, text, mime) {
    var D = root.document, U = root.URL;
    if (!D || typeof Blob === 'undefined' || !U || !U.createObjectURL) return { status: 'shown', name: name, reason: 'unavailable' };
    try {
      var url = U.createObjectURL(new Blob([text], { type: mime || MIME_FALLBACK }));
      var a = D.createElement('a');
      a.href = url;
      a.download = name;
      a.hidden = true;
      D.body.appendChild(a);
      a.click();
      setTimeout(function () { try { U.revokeObjectURL(url); a.remove(); } catch (e) {} }, 1000);
      return { status: 'saved', name: name, zipped: false };
    } catch (e) {
      return { status: 'shown', name: name, reason: 'unavailable' };
    }
  }

  // saveFile({name, text, mime}) -> Promise<{status, name, zipped?, inner?, reason?, message?}>
  //   saved: the file went to the person's device (zipped: it is inside <name>.zip, `inner` is the original name)
  //   declined: the person said no in the save prompt (never retried here)
  //   shown: nothing could be saved, so the caller should show the text (see showText)
  //   failed: plain `message` for the person (rate limit, empty file)
  function saveFile(opts) {
    opts = opts || {};
    var name = String(opts.name || 'file.txt');
    var text = opts.text == null ? '' : String(opts.text);
    if (!text) return Promise.resolve({ status: 'failed', name: name, reason: 'empty', message: 'There is nothing to save yet.' });
    if (!inArtifact()) return Promise.resolve(standaloneSave(name, text, opts.mime));
    return use('downloads').then(function (dl) {
      if (!dl || typeof dl.save !== 'function') return { status: 'shown', name: name, reason: 'unavailable' };
      var filename = name, data = text, zipped = false;
      if (!allowedExt(name)) {
        var Z = zipApi();
        if (!Z) return { status: 'shown', name: name, reason: 'unavailable' };
        try {
          data = Z.store([{ name: name, text: text }]);
          filename = baseOf(name) + '.zip';
          zipped = true;
        } catch (e) { return { status: 'shown', name: name, reason: 'unavailable' }; }
      }
      var call;
      try { call = Promise.resolve(dl.save({ filename: filename, data: data })); } catch (e) { call = Promise.reject(e); }
      return call.then(function () {
        return { status: 'saved', name: filename, zipped: zipped, inner: name };
      }, function (err) {
        var code = err && typeof err === 'object' ? err.code : '';
        if (code === 'declined') return { status: 'declined', name: filename, reason: code };
        if (code === 'rate_limited') {
          return { status: 'failed', name: filename, reason: code, message: 'Another save is waiting for you or you tried too many times. Wait a moment, then try again.' };
        }
        return { status: 'shown', name: name, reason: code || 'unavailable' };
      });
    }, function () { return { status: 'shown', name: name, reason: 'unavailable' }; });
  }

  // copyText(text) -> Promise<boolean>. Call it inside the click handler.
  function copyText(text) {
    text = String(text);
    function fallback() {
      var D = root.document;
      if (!D || !D.body || typeof D.execCommand !== 'function') return false;
      var ta = D.createElement('textarea');
      ta.setAttribute('aria-hidden', 'true');
      ta.setAttribute('tabindex', '-1');
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
      ta.value = text;
      D.body.appendChild(ta);
      var ok = false;
      try { ta.select(); ta.setSelectionRange(0, text.length); ok = !!D.execCommand('copy'); } catch (e) { ok = false; }
      try { ta.remove(); } catch (e) {}
      return ok;
    }
    try {
      var nav = root.navigator;
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
        return Promise.resolve(nav.clipboard.writeText(text)).then(function () { return true; }, function () { return fallback(); });
      }
    } catch (e) { /* fall through */ }
    return Promise.resolve(fallback());
  }

  // showText({after, label, text, key}) inserts a labelled read-only text box with a Copy button after `after`.
  // A second call with the same key replaces the first. Returns the panel element.
  function showText(opts) {
    var D = root.document;
    opts = opts || {};
    var after = opts.after, key = String(opts.key || 'text');
    var parent = after && after.parentNode;
    if (!D || !parent) return null;
    var old = parent.querySelectorAll ? parent.querySelectorAll('[data-bff-shown="' + key + '"]') : [];
    for (var i = 0; i < old.length; i++) old[i].remove();
    var id = 'bff-shown-' + (++panelSeq);
    var panel = D.createElement('div');
    panel.className = 'fx-field bff-shown';
    panel.setAttribute('data-bff-shown', key);
    var label = D.createElement('label');
    label.setAttribute('for', id);
    label.textContent = opts.label || 'Text';
    var ta = D.createElement('textarea');
    ta.id = id;
    ta.className = 'fx-textarea';
    ta.readOnly = true;
    ta.rows = 8;
    ta.value = String(opts.text == null ? '' : opts.text);
    ta.addEventListener('focus', function () { try { ta.select(); } catch (e) {} });
    var row = D.createElement('div');
    row.className = 'fx-actions';
    var copy = D.createElement('button');
    copy.type = 'button';
    copy.className = 'fx-btn fx-btn--primary';
    copy.textContent = 'Copy';
    var hide = D.createElement('button');
    hide.type = 'button';
    hide.className = 'fx-btn';
    hide.textContent = 'Hide';
    var note = D.createElement('p');
    note.className = 'fx-small';
    note.setAttribute('role', 'status');
    note.setAttribute('aria-live', 'polite');
    copy.addEventListener('click', function () {
      copyText(ta.value).then(function (ok) {
        if (ok) note.textContent = 'Copied.';
        else { note.textContent = 'Could not copy automatically. Tap inside the box, select all, and copy.'; try { ta.focus(); ta.select(); } catch (e) {} }
      });
    });
    hide.addEventListener('click', function () {
      var prev = panel.previousElementSibling;
      panel.remove();
      if (opts.returnTo && opts.returnTo.focus) opts.returnTo.focus();
      else if (prev && prev.focus) prev.focus();
    });
    row.appendChild(copy);
    row.appendChild(hide);
    panel.appendChild(label);
    panel.appendChild(ta);
    panel.appendChild(row);
    panel.appendChild(note);
    parent.insertBefore(panel, after.nextSibling);
    // The copy fallback: have the text already selected so the person only has to copy it.
    try { ta.focus(); ta.select(); } catch (e) {}
    return panel;
  }

  var host = {
    use: use,
    saveFile: saveFile,
    copyText: copyText,
    showText: showText,
    allowedExtension: allowedExt,
    // Start the downloads lookup after first paint so it has answered by the time someone taps Save.
    warm: function () { use('downloads'); }
  };
  Object.defineProperty(host, 'inArtifact', { enumerable: true, get: inArtifact });
  Object.defineProperty(host, 'canPopup', { enumerable: true, get: function () { return !inArtifact(); } });
  Object.defineProperty(host, 'mailtoNote', { enumerable: true, get: function () { return inArtifact() ? 'May not open from here' : ''; } });

  if (typeof module === 'object' && module.exports) module.exports = host;
  else { root.BFF = root.BFF || {}; root.BFF.host = host; }
})(typeof window !== 'undefined' ? window : globalThis);
