(function () {
  'use strict';
  var BFF = (window.BFF = window.BFF || {});

  var pending = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function mark() {
    var m = el('span', 'miss-mark', '!');
    m.setAttribute('aria-hidden', 'true');
    return m;
  }
  function srText(t) {
    var s = el('span', 'fx-sr', t);
    return s;
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  // One line for a program: what My info is missing, with a link to add it. null when nothing is missing.
  function line(p, profile, opts) {
    var L = BFF.logic;
    opts = opts || {};
    var keys = L && L.missingInfo ? L.missingInfo(p, profile) : [];
    if (!keys.length) return null;
    var lead = '';
    if (opts.states !== false && keys.indexOf('state') !== -1) {
      lead = L.onlyInText(p);
      if (lead) lead += '. ';
    }
    var n = el(opts.tag || 'p', 'miss-line');
    n.setAttribute('data-missing', keys.join(' '));
    n.appendChild(mark());
    n.appendChild(el('span', 'miss-text', lead + 'My info is missing ' + L.missingInfoText(keys) + '.'));
    var a = el('a', 'miss-add', keys.length === 1 ? 'Add it' : 'Add them');
    a.setAttribute('href', '#info');
    a.setAttribute('data-info-key', keys[0]);
    a.appendChild(srText(' in My info'));
    n.appendChild(a);
    return n;
  }

  // A box for a page header: how many programs depend on what, one chip per missing answer.
  function notice(counts, opts) {
    var L = BFF.logic;
    if (!counts || !counts.total || !L) return null;
    var box = el('div', 'miss-box');
    box.setAttribute('data-missing-total', String(counts.total));
    var lead = el('p', 'miss-lead');
    lead.appendChild(mark());
    lead.appendChild(document.createTextNode(' My info is missing details that '));
    lead.appendChild(el('strong', '', plural(counts.total, 'program')));
    lead.appendChild(document.createTextNode(counts.total === 1 ? ' depends on.' : ' depend on.'));
    box.appendChild(lead);
    var ul = el('ul', 'miss-chips');
    L.MISSING_KEYS.forEach(function (k) {
      var c = counts.keys && counts.keys[k];
      if (!(c > 0)) return;
      var a = el('a', 'miss-chip');
      a.setAttribute('href', '#info');
      a.setAttribute('data-info-key', k);
      a.appendChild(document.createTextNode(L.MISSING_SHORT[k] + ' '));
      var n = el('span', 'miss-n', String(c));
      n.appendChild(srText(c === 1 ? ' program' : ' programs'));
      a.appendChild(n);
      var li = el('li');
      li.appendChild(a);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    return box;
  }

  function currentView() {
    var name = String(location.hash || '').replace(/^#/, '');
    var views = BFF.nav && BFF.nav.views;
    if (!name) return 'directory';
    if (views && views.indexOf(name) === -1) return 'directory';
    return name;
  }
  function want(key, from) {
    pending = key ? { key: String(key), from: from || currentView() } : null;
  }
  function take() {
    var p = pending;
    pending = null;
    return p;
  }

  // Runs before the router's own click handler (capture phase) and changes nothing about the click.
  document.addEventListener('click', function (e) {
    var t = e && e.target;
    if (t && t.nodeType === 3) t = t.parentNode;
    if (!t || !t.closest) return;
    var a = t.closest('a[data-info-key]');
    if (a) want(a.getAttribute('data-info-key'), currentView());
  }, true);

  BFF.missing = { line: line, notice: notice, take: take, want: want };
})();
