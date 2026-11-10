/* Field matcher: decides what a form field is for and how to format the value.
   One source of truth for the app, the fill script (which embeds the factory through
   Function.prototype.toString) and tools/autofill. Pure: no DOM, no network, no storage.
   Keep the factory self-contained, ES5 only, with no line comments (the script may be
   pasted into places that strip newlines). */
(function (root) {
  'use strict';

  function factory() {
    var STATES = {
      AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
      CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
      FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
      IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
      ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
      MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
      NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
      NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
      OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
      RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
      TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
      WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
    };
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];

    var SKIP_TYPES = {
      hidden: 1, password: 1, search: 1, checkbox: 1, radio: 1, file: 1, submit: 1,
      button: 1, reset: 1, image: 1, color: 1, range: 1
    };

    var SKIP_WORDS = /\b(password|passwd|pwd|passcode|pin|card|credit|debit|cc|ccnum|cvv|cvc|cvn|csc|security code|expir\w*|ssn|social security|insurance|insurer|member id|member number|policy|subscriber|medicaid|medicare|wic|case number|bank|routing|account number|search|query|keyword|keywords|locator|find a store|store finder|captcha|promo|coupon|voucher|offer code|discount|referral|cardholder|iban|passport|license|licence|driver s|dob|birth ?date|date of birth|birthday|age|gender|sex|race|ethnicity|income|salary|tax|ein|vin)\b/;
    var OTHER_NAME = /\b(baby|child|children|infant|newborn|spouse|partner|friend|referr\w*|recipient|company|business|organization|employer|username|user name|nickname|pet|hospital|doctor|physician|provider|middle|maiden|preferred|display|screen|account|holder|file|product|school|store|team|group|facility|event|list|login|gift)\b/;
    var OTHER_PERSON = /\b(spouse|partner|husband|wife|fianc\w*|doctor|dr|physician|ob|obgyn|midwife|doula|provider|hospital|clinic|pediatrician|gift|recipient|friend|referr\w*|referral|emergency|contact person|guardian|grandparent\w*|grandmother|grandfather|sibling|sister|brother|relative|caregiver|nanny|sponsor|witness|manager|supervisor|teacher|employer|company|business|organization|work|other parent|second parent|mother s|father s|mom s|dad s)\b/;
    var OTHER_THING = /\b(last menstrual\w*|menstrual|lmp|first time|phone type|mobile type|cell type|phone carrier|carrier|contact preference|preferred contact|best time|email type|address type|how did you hear)\b/;
    var HONEYPOT = /\b(honeypot|honey pot|hp|hpot|leave blank|leave empty|do not fill|dont fill|bot trap|trap|url2|website2|fax)\b/;

    var AUTOCOMPLETE = {
      'given-name': 'firstName',
      'family-name': 'lastName',
      name: 'fullName',
      email: 'email',
      tel: 'phone',
      'tel-national': 'phone',
      'address-line1': 'address1',
      'street-address': 'address1',
      'address-line2': 'address2',
      'address-level2': 'city',
      'address-level1': 'state',
      'postal-code': 'zip'
    };

    var SECOND_LEVEL = { co: 1, com: 1, org: 1, net: 1, gov: 1, edu: 1, ac: 1, ne: 1, or: 1, go: 1, gob: 1, gouv: 1, mil: 1, sch: 1, nom: 1, ltd: 1, plc: 1, nhs: 1 };

    function norm(s) {
      return String(s == null ? '' : s)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^A-Za-z0-9]+/g, ' ')
        .toLowerCase()
        .replace(/^\s+|\s+$/g, '');
    }

    function fromText(t, type) {
      if (!t) return null;
      var has = function (re) { return re.test(t); };
      var dueCtx = has(/\b(due|expected|edd)\b/);
      if (dueCtx) {
        if (type === 'date') return 'dueDate';
        if (has(/\bmonth\b|\bmm\b/)) return 'dueMonth';
        if (has(/\bday\b|\bdd\b/)) return 'dueDay';
        if (has(/\byear\b|\byyyy\b/)) return 'dueYear';
        if (has(/\bdate\b|\bedd\b|\bdue\b|\bexpected\b/)) return 'dueDate';
      }
      if (has(/\be mail\b|\bemail\b/)) return 'email';
      if (has(/\b(phone|mobile|cell|telephone|tel)\b/)) return 'phone';
      if (has(/\b(zip|zipcode|postal|postcode)\b/)) return 'zip';
      if (has(/\bcity\b|\btown\b/)) return 'city';
      if (has(/\b(state|province)\b/) && !has(/\bstatement\b/)) return 'state';
      if (has(/\b(address|addr|street)\b.*\b(2|two|line 2)\b|\baddress2\b|\baddr2\b|\b(apt|apartment|suite|unit)\b|\bline 2\b|\bline2\b/)) return 'address2';
      if (has(/\b(address|addr|street)\b/)) return 'address1';
      if (OTHER_NAME.test(t)) return null;
      if (has(/\b(first name|firstname|fname|given name|forename)\b|^first$/)) return 'firstName';
      if (has(/\b(last name|lastname|lname|surname|family name)\b|^last$/)) return 'lastName';
      if (has(/\b(full name|your name|name)\b/)) return 'fullName';
      return null;
    }

    function cleanText(s, max) {
      if (max == null) max = 80;
      var t = String(s == null ? '' : s)
        .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/g, '')
        .replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g, '')
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^\s+|\s+$/g, '');
      if (t.length > max) t = t.slice(0, max - 3) + '...';
      return t;
    }

    function registrableDomain(urlOrHost) {
      var host = String(urlOrHost || '');
      var m = /^[a-z][a-z0-9+.-]*:[\/\\]{2}(?:[^\/\\?#@]*@)?(\[[^\]]*\]|[^\/\\?#:]*)/i.exec(host);
      if (m) host = m[1];
      var labels = host.toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);
      if (labels.length <= 2) return labels.join('.');
      if (/^[0-9]+$/.test(labels[labels.length - 1])) return labels.join('.');
      var tld = labels[labels.length - 1];
      var take = tld.length === 2 && SECOND_LEVEL[labels[labels.length - 2]] === 1 ? 3 : 2;
      return labels.slice(-take).join('.');
    }
    function sameSite(a, b) {
      var x = registrableDomain(a);
      return x !== '' && x === registrableDomain(b);
    }

    function isGuidedDefault(p) {
      if (!p || p.costToClaim !== 'free') return false;
      var r = Array.isArray(p.requirements) ? p.requirements : [];
      if (r.indexOf('purchase') >= 0 || r.indexOf('membership') >= 0) return false;
      if (p.category === 'health-benefits' || p.category === 'assistance') return false;
      return !(r.indexOf('eligibility') >= 0 || r.indexOf('insurance') >= 0);
    }

    function classifyField(f) {
      f = f || {};
      var type = String(f.type || 'text').toLowerCase();
      if (SKIP_TYPES[type] === 1) return null;

      var ac = String(f.autocomplete || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (ac.some(function (t) { return t.indexOf('cc-') === 0 || t.indexOf('password') >= 0 || t === 'one-time-code' || t === 'username'; })) return null;
      var acToken = ac.filter(function (t) { return !/^(section-|shipping|billing|home|work|mobile|fax|pager)/.test(t); }).pop();
      var acKind = acToken ? AUTOCOMPLETE[acToken] : undefined;
      var parts = [f.label, f.ariaLabel, f.name, f.id, f.placeholder].map(norm).filter(Boolean);
      var all = parts.join(' ');
      if (SKIP_WORDS.test(all) || OTHER_PERSON.test(all) || OTHER_THING.test(all) || HONEYPOT.test(all)) return null;

      if (acKind) {
        if ((acKind === 'firstName' || acKind === 'lastName' || acKind === 'fullName') && OTHER_NAME.test(all)) return null;
        return acKind;
      }
      if (acToken === 'bday' || (acToken && acToken.indexOf('bday-') === 0)) return null;

      if (type === 'email') return 'email';
      if (type === 'tel') return 'phone';
      if (type === 'date') {
        return /\b(due|expected|edd)\b/.test(all) ? 'dueDate' : null;
      }
      if (type === 'number' && !/\b(zip|postal|due|month|day|year|phone)\b/.test(all)) return null;

      var order = [f.label, f.ariaLabel, f.name, f.id, f.placeholder];
      for (var i = 0; i < order.length; i++) {
        var k = fromText(norm(order[i]), type);
        if (k) return k;
      }
      return fromText(all, type);
    }

    function parseDate(s) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').replace(/^\s+|\s+$/g, ''));
      if (!m) return null;
      return { y: m[1], m: m[2], d: m[3] };
    }

    function optList(options) {
      return (options || []).map(function (o) {
        if (typeof o === 'string') return { value: o, label: o };
        var v = o.value == null ? '' : o.value;
        var l = o.label != null ? o.label : (o.text != null ? o.text : (o.value != null ? o.value : ''));
        return { value: String(v), label: String(l) };
      });
    }

    function pickOption(options, predicate) {
      var list = optList(options);
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        if (o.value !== '' && (predicate(norm(o.value), o.value) || predicate(norm(o.label), o.label))) return o.value;
      }
      return null;
    }

    function valueFor(kind, profile, opts) {
      opts = opts || {};
      var inputType = opts.inputType || 'text';
      var options = opts.options || null;
      var isSelect = Array.isArray(options);
      var p = profile || {};
      var str = function (v) { return v == null ? '' : String(v).replace(/^\s+|\s+$/g, ''); };
      var out = function (v) { return str(v) === '' ? null : str(v); };
      var d;

      switch (kind) {
        case 'firstName': case 'lastName': case 'email': case 'phone':
        case 'address1': case 'address2': case 'city': case 'zip':
          return out(p[kind]);
        case 'fullName':
          return out([p.firstName, p.lastName].map(str).filter(Boolean).join(' '));
        case 'state': {
          var raw = str(p.state);
          if (!raw) return null;
          var upper = raw.toUpperCase();
          var code = STATES[upper] ? upper : null;
          if (!code) {
            var keys = Object.keys(STATES);
            for (var i = 0; i < keys.length; i++) {
              if (STATES[keys[i]].toLowerCase() === raw.toLowerCase()) { code = keys[i]; break; }
            }
          }
          if (!code) return isSelect ? null : raw;
          if (!isSelect) return code;
          var full = STATES[code].toLowerCase();
          return pickOption(options, function (n, orig) { return n === code.toLowerCase() || n === full || norm(orig) === full; });
        }
        case 'dueDate':
          d = parseDate(p.dueDate);
          if (!d || isSelect) return null;
          return inputType === 'date' ? d.y + '-' + d.m + '-' + d.d : d.m + '/' + d.d + '/' + d.y;
        case 'dueMonth': {
          d = parseDate(p.dueDate);
          if (!d) return null;
          var n = Number(d.m);
          if (!isSelect) return d.m;
          var name = MONTHS[n - 1].toLowerCase();
          return pickOption(options, function (x) { return x === name || x === name.slice(0, 3) || x.indexOf(name + ' ') === 0 || (/^\d+$/.test(x) && Number(x) === n); });
        }
        case 'dueDay':
          d = parseDate(p.dueDate);
          if (!d) return null;
          if (!isSelect) return d.d;
          return pickOption(options, function (x) { return /^\d+$/.test(x) && Number(x) === Number(d.d); });
        case 'dueYear':
          d = parseDate(p.dueDate);
          if (!d) return null;
          if (!isSelect) return d.y;
          return pickOption(options, function (x) { return x === d.y; });
        default:
          return null;
      }
    }

    return {
      cleanText: cleanText, registrableDomain: registrableDomain, sameSite: sameSite,
      isGuidedDefault: isGuidedDefault, classifyField: classifyField, valueFor: valueFor
    };
  }

  var api = factory();
  api.factory = factory;
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.BFF = root.BFF || {}; root.BFF.fieldmatch = api; }
})(typeof window !== 'undefined' ? window : globalThis);
