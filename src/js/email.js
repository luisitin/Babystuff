// Pure helpers for plus addresses, Gmail filters, a mailto checklist and calendar reminders.
// Nothing here touches the network or the DOM. Loadable from Node tests as well as the browser.
(function (root) {
  'use strict';

  var PLUS_OK = ['gmail.com', 'googlemail.com', 'fastmail.com', 'proton.me', 'protonmail.com'];
  var GMAIL = ['gmail.com', 'googlemail.com'];
  var MAX_TAG = 24;
  var MAX_URL = 1900;
  var SEARCH_BASE = 'https://mail.google.com/mail/u/0/#search/';
  var NS_ATOM = 'http://www.w3.org/2005/Atom';
  var NS_APPS = 'http://schemas.google.com/apps/2006';

  function str(v) { return typeof v === 'string' ? v : v == null ? '' : String(v); }

  // ---- addresses ----
  function splitEmail(email) {
    var e = str(email).trim();
    var at = e.lastIndexOf('@');
    if (at < 1 || at === e.length - 1) return null;
    var local = e.slice(0, at), domain = e.slice(at + 1).toLowerCase();
    if (/[\s@,;<>()"]/.test(local) || !/^[^\s@,;<>()"]+\.[^\s@,;<>()"]+$/.test(domain) || /^\.|\.$|\.\./.test(domain)) return null;
    var plus = local.indexOf('+');
    var base = plus >= 0 ? local.slice(0, plus) : local;
    if (!base) return null;
    return { base: base, domain: domain };
  }

  function plusAddress(email, tag) {
    var parts = splitEmail(email);
    var t = str(tag).toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!parts || !t) return '';
    return parts.base + '+' + t + '@' + parts.domain;
  }

  function supportsPlus(email) {
    var parts = splitEmail(email);
    if (!parts) return null;
    if (parts.domain === 'yahoo.com') return false; // Yahoo uses "-" instead of "+"
    return PLUS_OK.indexOf(parts.domain) >= 0 ? true : null;
  }

  function isGmail(email) {
    var parts = splitEmail(email);
    return !!parts && GMAIL.indexOf(parts.domain) >= 0;
  }

  // ---- tags ----
  var STOP = { the: 1, a: 1, an: 1, of: 1, 'for': 1, and: 1, us: 1, usa: 1 };
  // Readable words from a brand or id: lowercase [a-z0-9], no stopwords, no pure numbers.
  function words(text) {
    return str(text).toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w && !STOP[w] && !/^\d+$/.test(w); });
  }
  function baseOf(p) {
    var w = words(str(p.brand).replace(/\([^)]*\)/g, ' '));
    if (!w.length) w = words(p.id);
    if (!w.length) return 'program';
    var b = w[0].length < 4 && w.length > 1 ? w[0] + w[1] : w[0];
    return b.slice(0, MAX_TAG);
  }
  function clip(s) { return s.slice(0, MAX_TAG).replace(/-+$/, ''); }

  // Assign a tag to every program. `existing` ({id: tag}) is kept as is and its tags are never reused,
  // so tags stay stable when the data changes. New programs are handled in id order.
  function tagMap(all, existing) {
    var list = Array.isArray(all) ? all.slice() : [];
    list.sort(function (a, b) { return str(a.id) < str(b.id) ? -1 : str(a.id) > str(b.id) ? 1 : 0; });
    var used = {}, out = {}, keep = existing && typeof existing === 'object' ? existing : {};
    Object.keys(keep).forEach(function (id) { if (typeof keep[id] === 'string' && keep[id]) used[keep[id]] = true; });
    list.forEach(function (p) {
      if (Object.prototype.hasOwnProperty.call(keep, p.id) && typeof keep[p.id] === 'string' && keep[p.id]) { out[p.id] = keep[p.id]; return; }
      var b = baseOf(p), cand = b;
      if (used[cand]) {
        var seg = words(p.id).filter(function (w) { return w !== b; })[0] || '';
        cand = seg ? clip(b + '-' + seg) : '';
        var n = 2;
        while (!cand || used[cand]) { cand = clip((seg ? b + '-' + seg : b).slice(0, MAX_TAG - String(n).length - 1)) + '-' + n; n++; }
      }
      used[cand] = true;
      out[p.id] = cand;
    });
    return out;
  }

  function tagFor(program, all, existing) {
    var list = Array.isArray(all) ? all : [];
    var has = list.some(function (p) { return p.id === program.id; });
    return tagMap(has ? list : list.concat([program]), existing)[program.id];
  }

  // ---- Gmail ----
  function domainOfUrl(url) {
    var m = /^https?:\/\/([^\/?#:]+)/i.exec(str(url));
    return m ? m[1].toLowerCase().replace(/^www\./, '') : '';
  }
  // Registrable domain: register.gerber.com -> gerber.com (handles co.uk style endings).
  function registrableDomain(host) {
    var parts = str(host).toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
    if (parts.length <= 2) return parts.join('.');
    var tld = parts[parts.length - 1], sld = parts[parts.length - 2];
    var n = tld.length === 2 && ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'].indexOf(sld) >= 0 ? 3 : 2;
    return parts.slice(-n).join('.');
  }
  // Retailers, marketplaces and other big senders whose mail is not just baby freebies.
  var BROAD = ['amazon.com', 'target.com', 'walmart.com', 'walgreens.com', 'cvs.com', 'costco.com', 'samsclub.com',
    'kroger.com', 'ebay.com', 'etsy.com', 'google.com', 'facebook.com', 'instagram.com', 'apple.com', 'paypal.com'];
  // True when a from: filter on this domain would catch unrelated mail.
  function isBroadDomain(domain) {
    var d = str(domain).toLowerCase();
    return !d || /\.(gov|mil)$/.test(d) || BROAD.indexOf(d) >= 0;
  }

  function gmailSearchUrl(o) {
    o = o || {};
    var domain = registrableDomain(str(o.domain).trim());
    if (isBroadDomain(domain)) domain = '';
    var plus = o.tag ? plusAddress(o.email, o.tag) : '';
    var acct = Math.max(0, Math.min(9, parseInt(o.account, 10) || 0));
    var q;
    if (plus) q = 'to:(' + plus + ')' + (domain ? ' OR from:(' + domain + ')' : '');
    else if (domain) q = 'from:(' + domain + ')';
    else return '';
    return SEARCH_BASE.replace('/u/0/', '/u/' + acct + '/') + encodeURIComponent(q);
  }

  function xmlEscape(s) {
    return str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  // With plus addresses: one to:(plus address) filter per program (specific, so archiving is safe).
  // Without: one from:(registrable domain) filter per domain, skipping broad senders, and never archiving.
  function gmailFiltersXml(programs, opts) {
    opts = opts || {};
    var list = Array.isArray(programs) ? programs : [];
    var usePlus = !!opts.usePlus && supportsPlus(opts.email) !== false && !!plusAddress(opts.email, 'x');
    var map = opts.tagMap || tagMap(Array.isArray(opts.allPrograms) ? opts.allPrograms : list);
    var archive = usePlus && !!opts.archive;
    var out = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<feed xmlns="' + NS_ATOM + '" xmlns:apps="' + NS_APPS + '">',
      '<title>Mail Filters</title>'];
    var seen = {};
    list.forEach(function (p) {
      var key, val;
      if (usePlus) { key = 'to'; val = plusAddress(opts.email, map[p.id]); }
      else {
        key = 'from';
        val = registrableDomain(domainOfUrl(p.signupUrl));
        if (isBroadDomain(val)) return;
      }
      if (!val || seen[val]) return;
      seen[val] = true;
      var label = 'Baby Freebies/' + str(p.name).replace(/\//g, '-').trim();
      out.push('<entry>', '<category term="filter"></category>', '<title>Mail Filter</title>', '<content></content>',
        '<apps:property name="' + key + '" value="' + xmlEscape(val) + '"/>',
        '<apps:property name="label" value="' + xmlEscape(label) + '"/>');
      if (archive) out.push('<apps:property name="shouldArchive" value="true"/>');
      out.push('</entry>');
    });
    out.push('</feed>');
    return out.join('\n') + '\n';
  }

  // ---- mailto checklist ----
  function mailtoChecklist(o) {
    o = o || {};
    var list = Array.isArray(o.programs) ? o.programs : [];
    var statusOf = typeof o.statusOf === 'function' ? o.statusOf : function () { return ''; };
    var subject = 'Baby freebies checklist';
    var lines = list.map(function (p) {
      var st = str(statusOf(p));
      return '- ' + str(p.name) + (st ? ' [' + st + ']' : '') + '\r\n  ' + str(p.signupUrl);
    });
    var to = encodeURIComponent(str(o.to).trim()).replace(/%40/g, '@');
    function build(text) {
      return 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
    }
    var fullText = lines.length ? lines.join('\r\n') : '(No programs in the list yet.)';
    var url = build(fullText);
    if (url.length < MAX_URL) return { url: url, truncated: false, fullText: fullText };
    for (var k = lines.length - 1; k >= 0; k--) {
      var text = lines.slice(0, k).concat(['…and ' + (lines.length - k) + ' more (see the app)']).join('\r\n');
      url = build(text);
      if (url.length < MAX_URL) return { url: url, truncated: true, fullText: fullText };
    }
    return { url: build('…and ' + lines.length + ' more (see the app)'), truncated: true, fullText: fullText };
  }

  // ---- iCalendar ----
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()); }
  // YYYY-MM-DD plus whole days, using UTC arithmetic only (no local timezone involved).
  function addDays(date, days) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(date));
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(t);
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return new Date(t + days * 86400000);
  }
  function icsText(s) {
    return str(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  function utf8Len(ch) {
    var c = ch.codePointAt(0);
    return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  // Fold at 75 octets without splitting a character; continuation lines start with one space.
  function fold(line) {
    var out = [], cur = '', n = 0, limit = 75;
    for (var ch of line) {
      var l = utf8Len(ch);
      if (n + l > limit) { out.push(cur); cur = ' '; n = 1; limit = 75; }
      cur += ch;
      n += l;
    }
    out.push(cur);
    return out.join('\r\n');
  }

  function icsReminders(entries, opts) {
    var days = opts && typeof opts.days === 'number' ? opts.days : 28;
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Baby Freebies Finder//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Baby freebies'];
    var count = 0;
    (Array.isArray(entries) ? entries : []).forEach(function (e) {
      var start = addDays(e.date, days);
      if (!start) return;
      var end = new Date(start.getTime() + 86400000);
      count++;
      lines.push('BEGIN:VEVENT',
        'UID:' + icsText(e.id) + '@baby-freebies-finder',
        'DTSTAMP:' + ymd(start) + 'T000000Z',
        'DTSTART;VALUE=DATE:' + ymd(start),
        'DTEND;VALUE=DATE:' + ymd(end),
        'SUMMARY:' + icsText('Check for ' + str(e.name) + ' mail or box'),
        'TRANSP:TRANSPARENT',
        'END:VEVENT');
    });
    if (!count) return '';
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  var api = {
    tagFor: tagFor, tagMap: tagMap, plusAddress: plusAddress, supportsPlus: supportsPlus, isGmail: isGmail, registrableDomain: registrableDomain, isBroadDomain: isBroadDomain,
    gmailSearchUrl: gmailSearchUrl, gmailFiltersXml: gmailFiltersXml, mailtoChecklist: mailtoChecklist,
    icsReminders: icsReminders, domainOfUrl: domainOfUrl, MAX_TAG: MAX_TAG
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.BFF = root.BFF || {}; root.BFF.email = api; }
})(typeof window !== 'undefined' ? window : globalThis);
