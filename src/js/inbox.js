// BFF.inbox: pure logic for the optional Gmail connection (searches, matching, suggestions, drafts, error copy).
// No DOM, no network. Everything that comes from a mailbox is untrusted text: it is cleaned here and the
// view shows it with textContent only. Loadable from Node tests as well as the browser.
(function (root) {
  'use strict';

  function EM() {
    if (typeof module === 'object' && module.exports && typeof require === 'function') return require('./email.js');
    return root.BFF && root.BFF.email;
  }

  var SERVER = 'Gmail';
  var TOOLS = ['search_threads', 'list_labels', 'create_label', 'label_thread', 'create_draft'];
  var FEATURE_TOOLS = {
    check: ['search_threads'],
    label: ['list_labels', 'create_label', 'label_thread'],
    draft: ['create_draft']
  };
  var DEFAULT_DAYS = 120;
  var MAX_QUERY = 1400; // Gmail accepts long searches, but short ones are safer
  var MAX_TERMS = 25;
  var ADDR_RE = /^[A-Za-z0-9._%+-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
  var DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
  var ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

  function str(v) { return typeof v === 'string' ? v : v == null ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  // Strip control, zero-width and bidi-override characters, squeeze whitespace, cap the length.
  function clean(s, max) {
    var t = str(s).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g, ' ').replace(/\s+/g, ' ').trim();
    if (max && t.length > max) {
      t = t.slice(0, max);
      var last = t.charCodeAt(t.length - 1);
      if (last >= 0xd800 && last <= 0xdbff) t = t.slice(0, -1);
    }
    return t;
  }

  // One plain address, nothing else. Returns the trimmed address or ''.
  function validAddress(s) {
    var t = str(s).trim();
    return t.length <= 254 && ADDR_RE.test(t) ? t : '';
  }
  function isId(s) { return typeof s === 'string' && ID_RE.test(s); }

  // "Name <a@b.com>", "a@b.com" or {emailAddress}: lowercase address, or ''.
  function extractAddress(v) {
    var s;
    if (isObj(v)) s = v.emailAddress || v.email || v.address;
    else s = v;
    s = str(s).trim();
    var m = /<([^<>]+)>\s*$/.exec(s);
    return validAddress(m ? m[1] : s).toLowerCase();
  }

  // ---- text ----
  var NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', trade: '™', zwnj: '', zwj: '' };
  // One pass, so "&amp;lt;" becomes "&lt;" and is never decoded twice. The result is plain text, shown with textContent.
  function decodeEntities(text) {
    return str(text).replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,8}));/g, function (all, dec, hex, name) {
      if (name) return Object.prototype.hasOwnProperty.call(NAMED, name) ? NAMED[name] : all;
      var cp = dec ? parseInt(dec, 10) : parseInt(hex, 16);
      if (!(cp > 0) || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return String.fromCharCode(0xFFFD);
      return String.fromCodePoint(cp);
    });
  }

  function safeViewUrl(url) {
    if (typeof url !== 'string' || url.length > 2000) return '';
    var u;
    try { u = new URL(url.trim()); } catch (e) { return ''; }
    if (u.protocol !== 'https:' || u.hostname !== 'mail.google.com' || u.port || u.username || u.password) return '';
    if (u.pathname.indexOf('/mail/') !== 0) return '';
    return u.href;
  }

  // The Gmail account a search result belongs to, from the authuser parameter of its viewUrl.
  function accountFromViewUrl(url) {
    var safe = safeViewUrl(url);
    if (!safe) return '';
    var a = '';
    try { a = new URL(safe).searchParams.get('authuser') || ''; } catch (e) { return ''; }
    return validAddress(a).toLowerCase();
  }

  // ---- programs ----
  function progList(programs) {
    return arr(programs).filter(function (p) { return isObj(p) && typeof p.id === 'string' && p.id; })
      .slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
  }
  // Only programs that belong in the email features are searched, matched and labelled (see BFF.email.inEmailFeatures).
  function emailList(list) { var E = EM(); return list.filter(E.inEmailFeatures); }
  function domainOfProgram(p) {
    var E = EM();
    var d = E.registrableDomain(E.domainOfUrl(p.signupUrl));
    return DOMAIN_RE.test(d) ? d : '';
  }
  // registrable domain -> ids of the programs that use it
  function domainOwners(list) {
    var owners = {};
    list.forEach(function (p) {
      var d = domainOfProgram(p);
      if (!d) return;
      var o = Object.prototype.hasOwnProperty.call(owners, d) ? owners[d] : (owners[d] = []);
      if (o.indexOf(p.id) < 0) o.push(p.id);
    });
    return owners;
  }
  function plusOn(o, email) {
    var E = EM();
    return !!o.usePlus && !!email && E.supportsPlus(email) !== false && !!E.plusAddress(email, 'x');
  }

  // ---- searches ----
  function termsFor(o) {
    var E = EM();
    o = o || {};
    var all = progList(o.programs), list = emailList(all);
    var email = validAddress(o.email);
    var plus = plusOn(o, email);
    var tags = isObj(o.tagMap) ? o.tagMap : {};
    var owners = domainOwners(all); // shared domains are judged on the whole list, so a government sender is never claimed by a brand
    var byText = {}, order = [], covered = {};
    function add(text, id) {
      if (!Object.prototype.hasOwnProperty.call(byText, text)) { byText[text] = []; order.push(text); }
      if (byText[text].indexOf(id) < 0) byText[text].push(id);
      covered[id] = true;
    }
    list.forEach(function (p) {
      if (plus && typeof tags[p.id] === 'string' && tags[p.id]) {
        var a = validAddress(E.plusAddress(email, tags[p.id])).toLowerCase();
        if (a) add('to:' + a, p.id);
      }
      var d = domainOfProgram(p);
      // A from: term is only worth running for a sender that points at exactly one program.
      if (d && !E.isBroadDomain(d) && owners[d].length === 1) add('from:' + d, p.id);
    });
    return {
      terms: order.map(function (t) { return { text: t, ids: byText[t] }; }),
      uncovered: list.filter(function (p) { return !covered[p.id]; }).map(function (p) { return p.id; })
    };
  }

  function buildQueries(o) {
    o = o || {};
    var days = parseInt(o.days, 10);
    if (!(days >= 1 && days <= 3650)) days = DEFAULT_DAYS;
    var suffix = ' newer_than:' + days + 'd';
    var terms = termsFor(o).terms;
    var out = [], cur = [], ids = [], len = 0;
    function flush() {
      if (!cur.length) return;
      var q = (cur.length === 1 ? cur[0] : '{' + cur.join(' ') + '}') + suffix;
      out.push({ query: q, programIds: ids.slice().sort() });
      cur = []; ids = []; len = 0;
    }
    terms.forEach(function (t) {
      if (cur.length && (cur.length >= MAX_TERMS || len + t.text.length + 1 > MAX_QUERY - suffix.length - 2)) flush();
      cur.push(t.text);
      len += t.text.length + 1;
      t.ids.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    });
    flush();
    return out;
  }
  // Ids of programs no search can find (a broad or shared sender and no plus address).
  function unsearchable(o) { return termsFor(o).uncovered; }

  // ---- classify ----
  function norm(s) { return str(s).toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' '); }
  // True when the first match of re is not preceded, in the same sentence, by a word that makes it hypothetical or negative.
  var HEDGE = /\b(not|never|won't|will|would|once|when|until|after|if|unless|before|can't|cannot|unable|soon|to be|should|may|might|track|tracking|get|gets|receive)\b|n't\b/;
  function affirmed(text, re) {
    var m = re.exec(text);
    if (!m) return false;
    var before = text.slice(Math.max(0, m.index - 60), m.index);
    var cut = Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? '), before.lastIndexOf(': '));
    if (cut >= 0) before = before.slice(cut + 2);
    return !HEDGE.test(before);
  }
  var CONFIRM_RES = [
    /\b(?:confirm|verify|validate|activate)\b[^.!?]{0,40}\b(?:e-?mail|address|subscription|account|sign-?\s?up|registration|membership)\b/,
    /\bone more step\b/, /\bfinish (?:signing up|your (?:sign-?\s?up|registration))\b/, /\bplease (?:confirm|verify)\b/
  ];
  // "on the way" alone is not shipping news ("your baby is on the way"): it needs a parcel word in front of it.
  var PARCEL = '(?:order|package|box|shipment|parcel|samples?|kit|delivery|items?|gift|formula|diapers?)';
  var SHIPPED_RES = [
    /\b(?:has|have|just|now|been|was)\s+shipped\b/, /^shipped\b/, /\bshipped[!:]/, new RegExp('\\b' + PARCEL + '\\s+(?:is|are|was|were)?\\s*on (?:its|their|the) way\\b'), /\bout for delivery\b/
  ];
  // Delivery wording must name the parcel. "Delivered to your door", "now delivered nationwide" and "just delivered" are advertising.
  var DELIVERED_RES = [
    new RegExp('\\b' + PARCEL + '\\s+(?:was|were|has been|have been|is)\\s+(?:successfully\\s+)?delivered\\b'),
    new RegExp('\\b' + PARCEL + '\\s+delivered\\b'),
    /^delivered\s*[:!\-\u2013\u2014]/, /\bdelivered[!:]\s/, /\b(?:was|were|has been|have been)\s+(?:successfully\s+)?delivered\b/
  ];
  var WELCOME_RES = [
    /\bwelcome (?:to|aboard)\b/, /^welcome\b/, /\bthanks?(?: you)? for (?:signing up|joining|subscribing|registering|your registration)\b/,
    /\byou(?:'re| are) (?:in|all set|signed up|registered|subscribed)\b/, /\byou(?:'ve| have) (?:successfully )?(?:signed up|joined|registered|subscribed)\b/,
    /\b(?:sign-?\s?up|registration) (?:is )?(?:complete|confirmed|successful)\b/
  ];
  function anyAffirmed(text, res) { return res.some(function (re) { return affirmed(text, re); }); }
  function textOf(m) { return norm(decodeEntities(str(m && m.subject)) + ' . ' + decodeEntities(str(m && m.snippet))); }
  function subjectNorm(m) { return norm(decodeEntities(str(m && m.subject))); }

  function isDelivered(m) {
    var t = textOf(m);
    return anyAffirmed(t, DELIVERED_RES) && !/\b(?:not|never|failed|attempt(?:ed)?|unable|couldn't|could not)\b[^.!?]{0,30}\bdelivered\b/.test(t);
  }
  function classify(m) {
    var t = textOf(m), s = subjectNorm(m);
    if (anyAffirmed(t, CONFIRM_RES) || anyAffirmed(s, CONFIRM_RES)) return 'confirm';
    if (isDelivered(m) || anyAffirmed(t, SHIPPED_RES)) return 'shipped';
    if (anyAffirmed(t, WELCOME_RES)) return 'welcome';
    return 'other';
  }

  // ---- matching ----
  function msgTime(m) {
    var n = Number(m && m.internalDate);
    if (isFinite(n) && n > 0) return n;
    var d = Date.parse(str(m && m.date));
    return isNaN(d) ? -1 : d;
  }
  function newestMessage(msgs) {
    var best = null, bt = -2;
    msgs.forEach(function (m) { var t = msgTime(m); if (t >= bt) { best = m; bt = t; } });
    return { msg: best, ts: bt };
  }
  function isoOf(m, ts) {
    var d = Date.parse(str(m && m.date));
    if (!isNaN(d)) return new Date(d).toISOString();
    return ts > 0 ? new Date(ts).toISOString() : '';
  }

  function matchThreads(threads, o) {
    var E = EM();
    o = o || {};
    var all = progList(o.programs), list = emailList(all);
    var email = validAddress(o.email);
    var tags = isObj(o.tagMap) ? o.tagMap : null;
    var plusIds = {};
    if (email && tags) list.forEach(function (p) {
      if (typeof tags[p.id] !== 'string' || !tags[p.id]) return;
      var a = validAddress(E.plusAddress(email, tags[p.id])).toLowerCase();
      if (a) (plusIds[a] = plusIds[a] || []).push(p.id);
    });
    var owners = domainOwners(all), inList = {};
    list.forEach(function (p) { inList[p.id] = true; });
    var seen = {}, out = [];
    arr(threads).forEach(function (th) {
      if (!isObj(th)) return;
      var msgs = arr(th.messages).filter(isObj);
      if (!msgs.length) return;
      var nw = newestMessage(msgs), m = nw.msg;
      var threadId = th.id || m.threadId;
      if (!isId(threadId) || seen[threadId]) return;
      // exact: some message in the thread was addressed to a program's own plus address
      var hit = {};
      msgs.forEach(function (x) {
        arr(x.toRecipients).concat(arr(x.ccRecipients)).forEach(function (r) {
          var a = extractAddress(r);
          if (a && Object.prototype.hasOwnProperty.call(plusIds, a) && plusIds[a].length === 1) hit[plusIds[a][0]] = true;
        });
      });
      var ids = Object.keys(hit), programId = '', certainty = '';
      var sender = extractAddress(m.sender);
      if (ids.length === 1) { programId = ids[0]; certainty = 'exact'; }
      else if (ids.length === 0 && sender) {
        var d = E.registrableDomain(sender.split('@')[1]);
        if (!E.isBroadDomain(d) && Object.prototype.hasOwnProperty.call(owners, d) && owners[d].length === 1 && inList[owners[d][0]]) { programId = owners[d][0]; certainty = 'likely'; }
      }
      if (!programId) return;
      seen[threadId] = true;
      var name = '';
      arr(m.addressDisplayNames).forEach(function (x) {
        if (!name && isObj(x) && extractAddress(x) === sender) name = clean(decodeEntities(x.displayName), 80);
      });
      var subject = clean(decodeEntities(m.subject), 200), snippet = clean(decodeEntities(m.snippet), 300);
      out.push({
        programId: programId, threadId: threadId, subject: subject, snippet: snippet,
        from: name || sender, fromAddress: sender, date: isoOf(m, nw.ts),
        viewUrl: safeViewUrl(th.viewUrl) || safeViewUrl(m.viewUrl), certainty: certainty,
        kind: classify({ subject: subject, snippet: snippet }), _ts: nw.ts
      });
    });
    out.sort(function (a, b) { return b._ts - a._ts || (a.threadId < b.threadId ? -1 : a.threadId > b.threadId ? 1 : 0); });
    out.forEach(function (x) { delete x._ts; });
    return out;
  }

  // ---- suggestions ----
  // One per program at most. Conservative: "received" needs an exact (plus address) match and a message that says it was
  // delivered. Never moves a status backwards and never touches skipped.
  function suggest(matches, statusOf) {
    var st = typeof statusOf === 'function' ? statusOf : function () { return 'todo'; };
    var byProg = {}, order = [];
    arr(matches).forEach(function (m) {
      if (!isObj(m) || !m.programId) return;
      if (!byProg[m.programId]) { byProg[m.programId] = []; order.push(m.programId); }
      byProg[m.programId].push(m);
    });
    var out = [];
    order.forEach(function (id) {
      var cur = str(st(id)) || 'todo';
      if (cur === 'skipped' || cur === 'received') return;
      var list = byProg[id], pick = null, s;
      for (var i = 0; i < list.length && !pick; i++) {
        if (list[i].kind === 'shipped' && list[i].certainty === 'exact' && isDelivered(list[i])) {
          pick = { to: 'received', noteOnly: false, note: 'Delivered, per Gmail', m: list[i] };
        }
      }
      for (i = 0; i < list.length && !pick; i++) {
        if (list[i].kind === 'shipped') {
          s = isDelivered(list[i]) ? 'Delivered' : 'Shipped';
          pick = cur === 'todo' ? { to: 'signed-up', noteOnly: false, note: s + ', per Gmail', m: list[i] } : { to: 'signed-up', noteOnly: true, note: s + ', per Gmail', m: list[i] };
        }
      }
      for (i = 0; i < list.length && !pick; i++) {
        if ((list[i].kind === 'welcome' || list[i].kind === 'confirm') && cur === 'todo') pick = { to: 'signed-up', noteOnly: false, note: '', m: list[i] };
      }
      if (!pick) return;
      if (pick.noteOnly && cur !== 'signed-up') return;
      out.push({
        programId: id, from: cur, to: pick.to, noteOnly: pick.noteOnly, note: pick.note,
        kind: pick.m.kind, threadId: pick.m.threadId, subject: pick.m.subject, certainty: pick.m.certainty
      });
    });
    return out;
  }

  // ---- drafts ----
  // base64 of the UTF-8 bytes of a string; same result in browsers and in Node.
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function utf8Bytes(s) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(s);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.codePointAt(i);
      if (c > 0xffff) i++;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function utf8Base64(text) {
    var b = utf8Bytes(str(text)), out = '';
    for (var i = 0; i < b.length; i += 3) {
      var n = (b[i] << 16) | ((i + 1 < b.length ? b[i + 1] : 0) << 8) | (i + 2 < b.length ? b[i + 2] : 0);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
    }
    return out;
  }

  function checklistDraft(o) {
    o = o || {};
    var to = validAddress(o.email);
    if (!to) return null;
    var st = typeof o.statusOf === 'function' ? o.statusOf : function () { return ''; };
    var lines = arr(o.programs).filter(isObj).map(function (p) {
      var s = clean(st(p), 40), u = /^https:\/\//.test(str(p.signupUrl)) ? clean(p.signupUrl, 500) : '';
      return '- ' + clean(p.name, 120) + (s ? ' [' + s + ']' : '') + (u ? '\n  ' + u : '');
    });
    var body = (lines.length ? lines.join('\n') : '(No programs in the list yet.)') +
      '\n\nThis draft was made by the Baby Freebies Finder from your own list. It is only a draft, saved in your drafts.';
    return { to: [to], subject: 'Baby freebies checklist', body: body };
  }

  var MIME = { ics: 'text/calendar', xml: 'application/xml', txt: 'text/plain' };
  function kitDraft(o) {
    o = o || {};
    var to = validAddress(o.email);
    if (!to) return null;
    var attachments = [], names = [];
    arr(o.files).forEach(function (f) {
      if (!isObj(f) || typeof f.text !== 'string' || !f.text) return;
      var name = str(f.name).replace(/[^A-Za-z0-9._-]/g, '-').replace(/\.{2,}/g, '.').replace(/^[.-]+/, '').slice(0, 80);
      if (!name) return;
      var ext = (/\.([A-Za-z0-9]+)$/.exec(name) || [])[1];
      var mime = typeof f.mimeType === 'string' && /^[a-z]+\/[a-z0-9.+-]+$/i.test(f.mimeType) ? f.mimeType : MIME[(ext || '').toLowerCase()] || 'text/plain';
      attachments.push({ content: utf8Base64(f.text), filename: name, mimeType: mime });
      names.push(name);
    });
    var body = 'Your Baby Freebies Finder setup kit.\n\n' +
      (names.length ? names.map(function (n) { return '- ' + n; }).join('\n') + '\n\n' : '') +
      'Filter file (.xml): on a computer, open Gmail > Settings > See all settings > Filters and Blocked Addresses > Import filters, then pick the file.\n' +
      'Reminders (.ics): open the file to add the reminders to your calendar.\n\n' +
      'These files were made on your device from your own list. This is only a draft, saved in your drafts.';
    return { to: [to], subject: 'Baby freebies setup kit', body: body, attachments: attachments };
  }

  // ---- errors ----
  var GROUPS = {
    consent_required: 'said-no', approval_required: 'said-no', not_granted: 'said-no', not_in_manifest: 'said-no',
    needs_reauth: 'connect', server_not_connected: 'connect', server_not_found: 'connect', selection_required: 'connect',
    rate_limited: 'later', server_unavailable: 'later', upstream_error: 'later',
    blocked_by_policy: 'unavailable', capability_disabled: 'unavailable', capability_removed: 'unavailable', self_only: 'unavailable', user_changed: 'unavailable',
    tool_error: 'failed', bad_request: 'failed', cancelled: 'failed', transform_error: 'failed'
  };
  var COPY = {
    'said-no': 'Gmail was not allowed for this page, so nothing was checked. You can allow it in this page’s permissions, then reopen the page.',
    connect: 'Gmail is not connected in Claude. Open Claude, go to Settings and then Connectors, connect Gmail, then come back and try again.',
    later: 'Gmail did not answer. Wait a moment and try again.',
    unavailable: 'This is not available here, so this page will not use it. The rest of the app works as usual.',
    failed: 'Gmail could not do that. Nothing was changed in this app.'
  };
  function errorGroup(code) {
    if (typeof code !== 'string' || !code) return 'failed';
    return Object.prototype.hasOwnProperty.call(GROUPS, code) ? GROUPS[code] : 'unavailable';
  }
  function errorCopy(code) { return COPY[errorGroup(code)]; }
  // Codes after which nothing from the mailbox may stay on screen or in memory.
  function clearsData(code) { var g = errorGroup(code); return g === 'said-no' || g === 'connect' || g === 'unavailable'; }

  var api = {
    SERVER: SERVER, TOOLS: TOOLS, FEATURE_TOOLS: FEATURE_TOOLS, DEFAULT_DAYS: DEFAULT_DAYS,
    buildQueries: buildQueries, unsearchable: unsearchable, matchThreads: matchThreads, classify: classify, isDelivered: isDelivered, suggest: suggest,
    accountFromViewUrl: accountFromViewUrl, safeViewUrl: safeViewUrl, decodeEntities: decodeEntities,
    checklistDraft: checklistDraft, kitDraft: kitDraft, utf8Base64: utf8Base64,
    errorCopy: errorCopy, errorGroup: errorGroup, clearsData: clearsData,
    validAddress: validAddress, isId: isId, clean: clean
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.BFF = root.BFF || {}; root.BFF.inbox = api; }
})(typeof window !== 'undefined' ? window : globalThis);
