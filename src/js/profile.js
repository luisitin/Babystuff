(function () {
  'use strict';
  var BFF = (window.BFF = window.BFF || {});
  BFF.views = BFF.views || {};
  var store = BFF.store;
  var KEY = 'profile.v1';

  var STATES = [['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],['AS','American Samoa'],['GU','Guam'],['MP','Northern Mariana Islands'],['PR','Puerto Rico'],['VI','U.S. Virgin Islands']];

  // key, label, autocomplete, input type, optional
  var FIELDS = [
    { key: 'firstName', label: 'First name', ac: 'given-name' },
    { key: 'lastName', label: 'Last name', ac: 'family-name' },
    { key: 'email', label: 'Email', ac: 'email', type: 'email', check: 'email' },
    { key: 'phone', label: 'Phone (optional)', ac: 'tel', type: 'tel' },
    { key: 'address1', label: 'Address line 1', ac: 'address-line1' },
    { key: 'address2', label: 'Address line 2 (optional)', ac: 'address-line2' },
    { key: 'city', label: 'City', ac: 'address-level2' },
    { key: 'state', label: 'State', ac: 'address-level1', select: true },
    { key: 'zip', label: 'ZIP code', ac: 'postal-code', inputmode: 'numeric', check: 'zip' },
    { key: 'dueDate', label: 'Due date or baby’s birthday', ac: 'off', type: 'date' }
  ];

  // Optional answers that decide which programs are hidden. Never used to fill any form.
  var SITUATION = [
    { key: 'cover', label: 'Health cover', options: [['private', 'Employer or private plan'], ['marketplace', 'Marketplace plan'], ['medicaid', 'Medicaid or CHIP'], ['tricare', 'TRICARE'], ['none', 'No cover now']] },
    { key: 'insurer', label: 'Insurer or health plan', options: null },
    { key: 'lowIncome', label: 'Does your household get WIC, SNAP or similar help, or expect to qualify?', options: [['yes', 'Yes'], ['no', 'No']] },
    { key: 'job', label: 'Do you or your partner have a paid job?', options: [['yes', 'Yes'], ['no', 'No']] }
  ];
  var sitSel = {}, sitField = {};
  var phoneFold = null;

  // bff.prefs.v1.infoFillOpen: whether the phone fold is open. Read the object, change the key, write it back.
  function readFillOpen() {
    var p = store.get('prefs.v1', {});
    return !!(p && typeof p === 'object' && p.infoFillOpen === true);
  }
  function writeFillOpen(open) {
    var p = store.get('prefs.v1', {});
    if (!p || typeof p !== 'object') p = {};
    if (!!p.infoFillOpen === !!open) return;
    p.infoFillOpen = !!open;
    store.set('prefs.v1', p);
  }

  var CHECKS = {
    email: { re: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg: 'This does not look like an email address. You can still save it.' },
    zip: { re: /^\d{5}(-\d{4})?$/, msg: 'ZIP codes are usually 5 digits. You can still save it.' }
  };

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  var inputs = {}, hints = {}, statusEl = null, timer = null, keptDue = '', dueHint = null;
  var plusBox = null, plusPreview = null, plusNote = null;

  function read() {
    var p = store.get(KEY, {});
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  }
  function insurers() {
    var seen = {}, out = [];
    (BFF.programs || []).forEach(function (p) {
      var v = p && typeof p.insurer === 'string' ? p.insurer.trim() : '';
      if (v && !seen[v]) { seen[v] = true; out.push(v); }
    });
    return out.sort(function (a, b) { return a.localeCompare(b, 'en', { sensitivity: 'base' }); });
  }
  function sitValue(p, k) {
    var v = typeof p[k] === 'string' ? p[k] : '';
    var opts = k === 'insurer' ? insurers().concat(['other']) : SITUATION.filter(function (d) { return d.key === k; })[0].options.map(function (o) { return o[0]; });
    return opts.indexOf(v) === -1 ? '' : v;
  }
  // Show the insurer question only when the data names insurers and cover is not "none".
  function syncSituation(p) {
    var hasIns = insurers().length > 0;
    sitField.insurer.hidden = !hasIns || sitSel.cover.value === 'none';
  }
  function validate(f) {
    var c = CHECKS[f.check], v = inputs[f.key].value.trim();
    var bad = !!(c && v && !c.re.test(v));
    hints[f.key].textContent = bad ? 'Check this: ' + c.msg : '';
    if (bad) inputs[f.key].setAttribute('aria-invalid', 'true'); else inputs[f.key].removeAttribute('aria-invalid');
  }
  function fill() {
    var p = read();
    FIELDS.forEach(function (f) {
      var v = typeof p[f.key] === 'string' ? p[f.key] : '';
      if (f.key === 'dueDate') {
        // Date inputs only hold YYYY-MM-DD. Convert other formats; keep anything unreadable untouched.
        var n = BFF.util.normalizeDate(v);
        keptDue = v && !n ? v : '';
        v = n;
        hints.dueDate.textContent = keptDue ? 'The saved date \u201c' + keptDue + '\u201d could not be read. It is kept until you pick a new date.' : '';
      }
      inputs[f.key].value = v;
      if (f.check) validate(f);
    });
    SITUATION.forEach(function (d) { sitSel[d.key].value = sitValue(p, d.key); });
    syncSituation(p);
    if (plusBox) { plusBox.checked = !!p.usePlusTags; if (p.usePlusTags) tagMapNow(false); updatePlus(); }
  }
  // Live preview of the tagged address plus a note about the person's email provider.
  // Stable tags live in profile.v1 as plusTagMap. Assigned when plus tags are first turned on, and
  // for new programs later; a tag that is already stored is never changed or reused.
  function cleanMap(m) {
    var out = {};
    if (m && typeof m === 'object' && !Array.isArray(m)) Object.keys(m).forEach(function (id) {
      if (typeof m[id] === 'string' && /^[a-z0-9-]{1,24}$/.test(m[id])) out[id] = m[id];
    });
    return out;
  }
  function tagMapNow(force) {
    var pr = read(), cur = cleanMap(pr.plusTagMap);
    if (!force && !pr.usePlusTags) return cur;
    var next = BFF.email.tagMap(BFF.programs || [], cur), changed = false;
    Object.keys(next).forEach(function (id) { if (cur[id] !== next[id]) { cur[id] = next[id]; changed = true; } });
    if (changed) { pr.plusTagMap = cur; store.set(KEY, pr); }
    return cur;
  }
  BFF.plusTags = {
    map: function () { return tagMapNow(false); },
    forProgram: function (prog) { return tagMapNow(false)[prog.id] || BFF.email.tagFor(prog, BFF.programs || [], cleanMap(read().plusTagMap)); }
  };
  function updatePlus() {
    if (!plusPreview) return;
    var E = BFF.email, email = inputs.email.value.trim();
    var progs = BFF.programs || [], ex = null;
    progs.forEach(function (p) { if (!ex && /similac/.test(p.id)) ex = p; });
    ex = ex || progs[0];
    var tag = ex && E ? BFF.plusTags.forProgram(ex) : 'similac';
    var addr = E ? E.plusAddress(email, tag) : '';
    var sup = E ? E.supportsPlus(email) : null;
    if (!addr) {
      plusPreview.textContent = 'Add your email above to see a preview.';
      plusNote.textContent = '';
      return;
    }
    plusPreview.textContent = '';
    plusPreview.appendChild(document.createTextNode('Preview: '));
    plusPreview.appendChild(h('span', { class: 'fx-plus-addr', text: addr }));
    if (ex) plusPreview.appendChild(document.createTextNode(' (for ' + ex.name + ')'));
    if (sup === true) plusNote.textContent = 'Your email provider supports plus addresses. Mail to the tagged address still arrives in your normal inbox.';
    else if (sup === false) plusNote.textContent = 'Yahoo uses a hyphen instead of a plus sign (a different kind of address), so this app will not tag Yahoo addresses. Your plain email is used.';
    else plusNote.textContent = 'Check your provider: not every email service delivers plus addresses. Send yourself a test message before relying on this.';
  }
  function saveNow() {
    timer = null;
    var p = {};
    FIELDS.forEach(function (f) { p[f.key] = inputs[f.key].value.trim(); });
    if (!p.dueDate && keptDue) p.dueDate = keptDue;
    p.usePlusTags = !!(plusBox && plusBox.checked);
    SITUATION.forEach(function (d) {
      var v = sitSel[d.key].value;
      if (d.key === 'insurer' && sitField.insurer.hidden) v = '';
      if (v) p[d.key] = v;
    });
    var keepMap = cleanMap(read().plusTagMap);
    if (Object.keys(keepMap).length) p.plusTagMap = keepMap;
    var ok = store.set(KEY, p);
    statusEl.className = 'fx-saved fx-saved--block' + (ok ? '' : ' fx-hint');
    statusEl.textContent = ok ? 'Saved on this device' : 'Could not save on this device (storage is full or blocked). Your info is kept only until you close this page.';
    try { document.dispatchEvent(new CustomEvent('bff:profile-changed')); } catch (e) {}
  }

  BFF.views.info = {
    init: function (el) {
      el.classList.add('fx-view');
      if (!el.querySelector('h2')) el.appendChild(h('h2', { tabindex: '-1', text: 'My info' }));
      el.appendChild(h('p', { class: 'fx-note', text: 'Stored only in this browser on this device. This app has no server and makes no network requests, so your details never leave your device. Clearing your browser data deletes them.' }));
      el.appendChild(h('p', { class: 'fx-tip', text: 'Tip: Use a dedicated inbox or a plus address like yourname+baby@gmail.com. Sign-up mail is easy to filter, and you can see who shares your address.' }));

      var form = h('form', { class: 'fx-card fx-form', novalidate: '', autocomplete: 'on', 'aria-label': 'My info' });
      form.addEventListener('submit', function (e) { e.preventDefault(); });
      FIELDS.forEach(function (f) {
        var id = 'info-' + f.key, hid = id + '-hint', input;
        if (f.select) {
          input = h('select', { id: id, name: f.key, autocomplete: f.ac, class: 'fx-select' });
          input.appendChild(h('option', { value: '', text: 'Select a state' }));
          STATES.forEach(function (s) { input.appendChild(h('option', { value: s[0], text: s[1] + ' (' + s[0] + ')' })); });
        } else {
          input = h('input', { id: id, name: f.key, type: f.type || 'text', autocomplete: f.ac, class: 'fx-input' });
          if (f.inputmode) input.setAttribute('inputmode', f.inputmode);
          if (f.key === 'zip') input.setAttribute('maxlength', '10');
          if (f.type === 'email') input.setAttribute('autocapitalize', 'off');
        }
        var hint = h('span', { id: hid, class: 'fx-hint' });
        input.setAttribute('aria-describedby', hid);
        inputs[f.key] = input;
        hints[f.key] = hint;
        var evt = f.select || f.type === 'date' ? 'change' : 'input';
        input.addEventListener(evt, function () {
          if (f.check) validate(f);
          if (f.key === 'dueDate' && input.value) { keptDue = ''; hint.textContent = ''; }
          statusEl.className = 'fx-saved fx-saved--block';
          statusEl.textContent = 'Saving…';
          if (timer) clearTimeout(timer);
          timer = setTimeout(saveNow, 400);
        });
        if (f.check) input.addEventListener('blur', function () { validate(f); });
        if (f.key === 'email') { input.addEventListener('change', updatePlus); input.addEventListener('blur', updatePlus); }
        form.appendChild(h('div', { class: 'fx-field' }, [h('label', { 'for': id, text: f.label }), input, hint]));
      });
      el.appendChild(form);

      var sit = h('section', { class: 'fx-card fx-form fx-situation', 'aria-labelledby': 'info-sit-h' }, [
        h('h3', { id: 'info-sit-h', text: 'Your situation (optional)' }),
        h('p', { class: 'fx-muted', text: 'Used only to hide programs that cannot apply to you. Stays on this device.' })
      ]);
      SITUATION.forEach(function (d) {
        var id = 'info-' + d.key;
        var sel = h('select', { id: id, name: d.key, class: 'fx-select', autocomplete: 'off' });
        sel.appendChild(h('option', { value: '', text: 'Not answered' }));
        (d.options || insurers().map(function (v) { return [v, v]; }).concat([['other', 'Another one']])).forEach(function (o) {
          sel.appendChild(h('option', { value: o[0], text: o[1] }));
        });
        sel.addEventListener('change', function () {
          if (d.key === 'cover') syncSituation(read());
          statusEl.className = 'fx-saved fx-saved--block';
          statusEl.textContent = 'Saving…';
          if (timer) clearTimeout(timer);
          timer = setTimeout(saveNow, 400);
        });
        sitSel[d.key] = sel;
        var fld = h('div', { class: 'fx-field', 'data-situation': d.key }, [h('label', { 'for': id, text: d.label }), sel]);
        sitField[d.key] = fld;
        sit.appendChild(fld);
      });
      el.appendChild(sit);

      plusBox = h('input', { type: 'checkbox', id: 'info-plus' });
      plusPreview = h('p', { class: 'fx-plus-preview' });
      plusNote = h('p', { class: 'fx-muted' });
      plusBox.addEventListener('change', function () {
        if (plusBox.checked) tagMapNow(true);
        updatePlus();
        statusEl.className = 'fx-saved fx-saved--block';
        statusEl.textContent = 'Saving…';
        if (timer) clearTimeout(timer);
        timer = setTimeout(saveNow, 400);
      });
      el.appendChild(h('section', { class: 'fx-card', 'aria-labelledby': 'info-plus-h' }, [
        h('h3', { id: 'info-plus-h', text: 'Plus addresses' }),
        h('div', { class: 'fx-check' }, [plusBox, h('label', { 'for': 'info-plus', text: 'Give each program its own plus address' })]),
        h('p', { class: 'fx-muted', text: 'Adds a short tag to your email, like yourname+similac@gmail.com. The guided run copies the tagged address, and you can filter or search your inbox by program.' }),
        plusPreview,
        plusNote,
        h('p', { class: 'fx-muted', text: 'Some sign-up forms refuse an address with a plus sign. If one does, use your plain email address there.' })
      ]));

      statusEl = h('p', { class: 'fx-saved fx-saved--block', role: 'status', 'aria-live': 'polite' });
      var clear = h('button', { type: 'button', class: 'fx-btn fx-btn--danger', text: 'Clear my info' });
      var clearRow = h('div', { class: 'fx-actions' }, [clear]);
      clear.addEventListener('click', function () {
        BFF.ui.confirm({
          after: clearRow, confirmLabel: 'Clear my info', returnTo: clear,
          message: 'Clear all of My info from this device? This cannot be undone.',
          onConfirm: function () {
            if (timer) { clearTimeout(timer); timer = null; }
            var ok = store.remove(KEY);
            fill();
            statusEl.className = 'fx-saved fx-saved--block' + (ok ? '' : ' fx-hint');
            statusEl.textContent = ok ? 'Your info was cleared from this device.' : 'Cleared for this visit, but the change could not be saved on this device.';
            try { document.dispatchEvent(new CustomEvent('bff:profile-changed')); } catch (e) {}
          },
          onCancel: function () { statusEl.textContent = 'Clear cancelled. Nothing changed.'; }
        });
      });
      el.appendChild(clearRow);
      el.appendChild(statusEl);
      var phoneNode = h('div', { id: 'info-fill' });
      // The phone section is long and most people open it once, so it sits in a fold that remembers its state.
      // phone.js redraws only the inside of #info-fill, so a redraw never closes the fold.
      phoneFold = h('details', { class: 'fx-card ph-fold', id: 'info-fill-fold' }, [
        h('summary', { class: 'ph-fold-sum', id: 'info-fill-sum', text: 'Fill forms on your phone (iPhone shortcut or bookmark)' }),
        phoneNode
      ]);
      phoneFold.open = readFillOpen();
      phoneFold.addEventListener('toggle', function () { writeFillOpen(phoneFold.open); });
      el.appendChild(phoneFold);
      if (BFF.phoneView && BFF.phoneView.mount) BFF.phoneView.mount(phoneNode);
      fill();
      function flush() { if (timer) { clearTimeout(timer); saveNow(); } }
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
    },
    show: function () {
      if (!timer) fill();
      // Arrived through the guided page's "Set up the fill script" link: open the fold, scroll to it, focus its summary.
      // Done after the router has moved focus and scrolled to the top.
      if (BFF.openInfoFill) {
        BFF.openInfoFill = false;
        setTimeout(function () {
          if (!phoneFold) return;
          phoneFold.open = true;
          var reduce = false;
          try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
          var sum = phoneFold.querySelector('summary');
          try { phoneFold.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { phoneFold.scrollIntoView(); }
          if (sum) sum.focus({ preventScroll: true });
        }, 0);
      }
    }
  };
})();
