(function () {
  'use strict';
  window.BFF = window.BFF || {};

  // Done / Received / Not for me tick boxes over the stored status. Phase J contract in ARCHITECTURE.md.
  // Loads before tracker.js, so BFF.tracker is only touched inside handlers.
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  // Runs fn and scrolls the window by however far the anchor moved, at once (never animated),
  // so the thing under the finger stays where it was.
  function keepPlace(anchor, fn) {
    var before = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect().top : null;
    fn();
    if (before === null || !anchor.isConnected) return;
    var d = anchor.getBoundingClientRect().top - before;
    if (Math.abs(d) < 0.5) return;
    try { window.scrollBy({ top: d, left: 0, behavior: 'instant' }); }
    catch (e) { window.scrollBy(0, d); }
  }

  // What the last tick on each program did in this visit, so the opposite tick takes it back truly
  // (also from another page). Nothing is stored; a bulk change (import, clear) forgets it all.
  var lastTick = {};
  if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
    document.addEventListener('bff:tracker-changed', function (e) {
      if (e && e.detail && e.detail.id === null) lastTick = {};
    });
  }
  // The tick without any DOM: saves the status and remembers it. around(save) is optional.
  // A save that did not reach storage still holds for this visit: ok is false and the change stays.
  function apply(id, box, checked, around) {
    var T = BFF.tracker, L = BFF.logic;
    var prev = T.getStatus(id) || 'todo';
    var entry = T.getEntry ? T.getEntry(id) : null;
    var ch = L.tickChange(prev, box, checked, lastTick[id] || null);
    var ok = true, now = prev;
    if (ch.status !== prev) {
      var save = function () { ok = T.setStatus(id, ch.status, ch.signedUpAt ? { signedUpAt: ch.signedUpAt } : undefined) !== false; };
      if (typeof around === 'function') around(save); else save();
      now = T.getStatus(id) || 'todo';
      if (now !== prev) {
        var was = prev === 'signed-up' || prev === 'received';
        lastTick[id] = { box: box, checked: !!checked, from: prev, to: now, signedUpAt: was && entry && typeof entry.signedUpAt === 'string' ? entry.signedUpAt : '' };
      }
    }
    return { ok: ok, status: now, prev: prev, undo: ch.undo };
  }

  // opts: prefix, status, received (add the Received box, shown only while done), around(run) (the save runs inside it), onChange({ ok, status, prev, box, checked, input }).
  function build(p, opts) {
    opts = opts || {};
    var prefix = opts.prefix || 'tick';
    var L = BFF.logic;
    var inputs = {};
    var labels = {};
    var wrap = h('div', { class: 'ticks', role: 'group', 'aria-label': 'Mark ' + p.name, 'data-program-id': p.id });

    function add(key, part, label) {
      var input = h('input', { type: 'checkbox', id: prefix + '-' + part + '-' + p.id, 'data-tick': key });
      inputs[key] = input;
      var lab = h('label', { class: 'tick' }, [
        input,
        h('span', { class: 'tick-text', text: label }),
        h('span', { class: 'visually-hidden', text: ': ' + p.name })
      ]);
      labels[key] = lab;
      wrap.appendChild(lab);
      input.addEventListener('change', function () { changed(key, input); });
    }

    function sync(status) {
      var t = L.tickState(status);
      Object.keys(inputs).forEach(function (k) { inputs[k].checked = !!t[k]; });
      // The Received box is only offered once the program is marked done.
      if (labels.received) labels.received.hidden = !(status === 'signed-up' || status === 'received');
    }

    function changed(key, input) {
      keepPlace(input, function () {
        var checked = input.checked;
        var res = apply(p.id, key, checked, opts.around);
        sync(res.status);
        if (typeof opts.onChange === 'function') opts.onChange({ ok: res.ok, status: res.status, prev: res.prev, box: key, checked: checked, undo: res.undo, input: input });
      });
    }

    add('done', 'done', 'Done');
    if (opts.received) add('received', 'rcv', 'Received');
    add('notForMe', 'nfm', 'Not for me');
    sync(opts.status || 'todo');
    return { el: wrap, sync: sync };
  }

  BFF.ticks = { build: build, apply: apply, keepPlace: keepPlace };
})();
