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

  function sp() { return document.createTextNode(' '); }
  function addLink(many) {
    var a = el('a', 'miss-add', many ? 'Add them' : 'Add it');
    a.setAttribute('href', '#info');
    a.appendChild(srText(' in My info'));
    return a;
  }

  // One line for a program: what My info is missing, with a link to add it. null when nothing is missing.
  // It reads as one sentence: the mark, the text, then the link.
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
    n.appendChild(sp());
    n.appendChild(el('span', 'miss-text', lead + 'My info is missing ' + L.missingInfoText(keys) + '.'));
    n.appendChild(sp());
    var a = addLink(keys.length > 1);
    a.setAttribute('data-info-key', keys[0]);
    n.appendChild(a);
    return n;
  }

  // A box for a page header. Full form: one chip per missing answer. One missing answer, or opts.compact:
  // a single sentence and one link. null when nothing is missing.
  function notice(counts, opts) {
    var L = BFF.logic;
    if (!counts || !counts.total || !L) return null;
    opts = opts || {};
    var keys = L.MISSING_KEYS.filter(function (k) { return counts.keys && counts.keys[k] > 0; });
    if (!keys.length) return null;
    var one = keys.length === 1 || opts.compact === true;
    var box = el('div', 'miss-box' + (one ? ' miss-box--one' : ''));
    box.setAttribute('data-missing-total', String(counts.total));
    box.setAttribute('data-missing-keys', keys.join(' '));
    var lead = el('p', 'miss-lead');
    lead.appendChild(mark());
    var pr = el('strong', '', plural(counts.total, 'program'));
    if (keys.length === 1) {
      lead.appendChild(document.createTextNode(' My info is missing ' + L.MISSING_LABELS[keys[0]] + '. '));
      lead.appendChild(pr);
      lead.appendChild(document.createTextNode(counts.total === 1 ? ' depends on it. ' : ' depend on it. '));
    } else {
      lead.appendChild(document.createTextNode(' My info is missing details that '));
      lead.appendChild(pr);
      lead.appendChild(document.createTextNode(counts.total === 1 ? ' depends on. ' : ' depend on. '));
    }
    if (one) {
      var add = addLink(keys.length > 1);
      add.setAttribute('data-info-key', keys[0]);
      lead.appendChild(add);
      box.appendChild(lead);
      return box;
    }
    box.appendChild(lead);
    var ul = el('ul', 'miss-chips');
    keys.forEach(function (k) {
      var c = counts.keys[k];
      var a = el('a', 'miss-chip');
      a.setAttribute('href', '#info');
      a.setAttribute('data-info-key', k);
      a.appendChild(el('span', 'miss-label', L.MISSING_SHORT[k]));
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
