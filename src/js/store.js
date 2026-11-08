(function () {
  'use strict';
  var BFF = (window.BFF = window.BFF || {});
  var PREFIX = 'bff.';
  var mem = {};
  var ls = null;

  try {
    ls = window.localStorage;
    var probe = PREFIX + '__probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
  } catch (e) {
    ls = null;
  }
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  // After any failed write, copy everything stored so far into memory and serve reads from
  // memory from then on, so the app never shows stale data or reports a false success.
  function fail() {
    var was = store.persistent;
    if (ls) {
      try {
        for (var i = 0; i < ls.length; i++) {
          var k = ls.key(i);
          if (k && k.indexOf(PREFIX) === 0 && !has(mem, k.slice(PREFIX.length))) mem[k.slice(PREFIX.length)] = ls.getItem(k);
        }
      } catch (e) {}
    }
    store.persistent = false;
    if (was) {
      try { document.dispatchEvent(new CustomEvent('bff:storage-failed')); } catch (e) {}
    }
  }

  var store = {
    persistent: !!ls,
    get: function (key, fallback) {
      var raw = null;
      if (store.persistent) {
        try { raw = ls.getItem(PREFIX + key); } catch (e) { fail(); raw = has(mem, key) ? mem[key] : null; }
      } else raw = has(mem, key) ? mem[key] : null;
      if (raw === null || raw === undefined) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    // Returns true only if the value reached localStorage.
    set: function (key, value) {
      var raw = JSON.stringify(value);
      mem[key] = raw;
      if (!store.persistent) return false;
      try {
        ls.setItem(PREFIX + key, raw);
        return true;
      } catch (e) {
        fail();
        return false;
      }
    },
    remove: function (key) {
      delete mem[key];
      if (ls && store.persistent) {
        try { ls.removeItem(PREFIX + key); } catch (e) { fail(); }
      }
      return store.persistent;
    }
  };
  BFF.store = store;

  var programs = [];
  try {
    var node = document.getElementById('programs-data');
    if (node) {
      var parsed = JSON.parse(node.textContent);
      if (Array.isArray(parsed)) programs = parsed;
    }
  } catch (e) {
    programs = [];
  }
  BFF.programs = programs;
  BFF.views = BFF.views || {};

  // ---- shared helpers for my views ----
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || y < 1900 || y > 2100) return '';
    var dim = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    return d > dim ? '' : y + '-' + pad(m) + '-' + pad(d);
  }
  // Returns YYYY-MM-DD or '' if the text is not a recognisable date. Never uses new Date(string).
  function normalizeDate(s) {
    s = String(s || '').trim();
    var m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return iso(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})$/.exec(s))) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
    if ((m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(s))) {
      var mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
      return mi < 0 ? '' : iso(+m[3], mi + 1, +m[2]);
    }
    return '';
  }
  BFF.util = { normalizeDate: normalizeDate };

  // Inline confirm panel (window.confirm can be blocked in sandboxed iframes).
  var openPanel = null;
  function closePanel(returnTo) {
    if (openPanel) { openPanel.remove(); openPanel = null; }
    if (returnTo && returnTo.isConnected && returnTo.focus) returnTo.focus();
  }
  BFF.ui = {
    // opts: {after: element to insert the panel after, message, confirmLabel, onConfirm, onCancel, returnTo}
    confirm: function (opts) {
      closePanel();
      var panel = document.createElement('div');
      panel.className = 'fx-confirm';
      panel.setAttribute('role', 'alertdialog');
      panel.setAttribute('aria-label', 'Please confirm');
      var msg = document.createElement('p');
      msg.className = 'fx-confirm-msg';
      msg.tabIndex = -1;
      msg.textContent = opts.message;
      panel.setAttribute('aria-describedby', 'fx-confirm-msg');
      msg.id = 'fx-confirm-msg';
      var row = document.createElement('div');
      row.className = 'fx-actions';
      var ok = document.createElement('button');
      ok.type = 'button'; ok.className = 'fx-btn fx-btn--primary'; ok.textContent = opts.confirmLabel || 'Confirm';
      var no = document.createElement('button');
      no.type = 'button'; no.className = 'fx-btn'; no.textContent = 'Cancel';
      row.appendChild(ok); row.appendChild(no);
      panel.appendChild(msg); panel.appendChild(row);
      ok.addEventListener('click', function () { closePanel(opts.returnTo); if (opts.onConfirm) opts.onConfirm(); });
      no.addEventListener('click', function () { closePanel(opts.returnTo); if (opts.onCancel) opts.onCancel(); });
      panel.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); no.click(); }
      });
      opts.after.parentNode.insertBefore(panel, opts.after.nextSibling);
      openPanel = panel;
      msg.focus();
    },
    closeConfirm: closePanel
  };
})();
