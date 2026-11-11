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
        var T = BFF.tracker;
        var checked = input.checked;
        var prev = T.getStatus(p.id) || 'todo';
        var next = L.statusAfterTick(prev, key, checked);
        var ok = true;
        if (next !== prev) {
          // A save that did not reach storage still holds for this visit (the app-wide rule):
          // the change stays and onChange gets ok: false, so the caller can say it will not last.
          var save = function () { ok = T.setStatus(p.id, next) !== false; };
          if (typeof opts.around === 'function') opts.around(save); else save();
        }
        var now = T.getStatus(p.id) || 'todo';
        sync(now);
        if (typeof opts.onChange === 'function') opts.onChange({ ok: ok, status: now, prev: prev, box: key, checked: checked, input: input });
      });
    }

    add('done', 'done', 'Done');
    if (opts.received) add('received', 'rcv', 'Received');
    add('notForMe', 'nfm', 'Not for me');
    sync(opts.status || 'todo');
    return { el: wrap, sync: sync };
  }

  BFF.ticks = { build: build, keepPlace: keepPlace };
})();
