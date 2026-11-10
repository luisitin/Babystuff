// A stand-in for the Claude viewer's `window.claude` runtime, built from the artifact-capabilities type files:
// claude.use(name) resolves asynchronously to a namespace or null; errors are plain objects {code, message, retryable?}.
// Everything it returns is synthetic. It records what the page asks for so the run can check it.
export const ALLOWED_TOOLS = ['search_threads', 'list_labels', 'create_label', 'label_thread', 'create_draft'];

export function mockInit(cfg = {}) {
  const src = `(() => {
  const cfg = ${JSON.stringify({ nullAll: !!cfg.nullAll, gm: cfg.gm || {}, dl: cfg.dl || 'ok' })};
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__saves = []; window.__calls = []; window.__uses = []; window.__lastTap = 0; window.__pwned = undefined;
  window.__dlMode = cfg.dl;
  window.__gm = Object.assign({ mode: 'connected', fail: {}, missing: [], empty: false, hostile: true, hasLabel: false, delay: 20 }, cfg.gm);
  for (const ev of ['pointerdown', 'click', 'keydown']) addEventListener(ev, () => { window.__lastTap = Date.now(); }, true);
  const err = (o) => Object.assign({ message: o.code }, o);
  const counts = {};

  const downloads = {
    async save(req) {
      const d = req && req.data;
      const rec = { filename: req && req.filename, kind: typeof d === 'string' ? 'string' : Object.prototype.toString.call(d), text: typeof d === 'string' ? d : null, bytes: null };
      if (typeof d !== 'string' && d) { const u = d.buffer ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : new Uint8Array(d); rec.bytes = Array.from(u); }
      window.__saves.push(rec);
      await delay(20);
      const m = window.__dlMode;
      if (m === 'declined') throw err({ code: 'declined', message: 'The viewer said no.' });
      if (m === 'rate_limited') throw err({ code: 'rate_limited', message: 'A prompt is already open.', retryable: true });
      if (m === 'error') throw err({ code: 'unavailable', message: 'Saving is not available here.' });
      return { saved: true };
    }
  };

  function threads() {
    const B = window.BFF, P = B.programs, tm = B.plusTags.map();
    let email = 'e2e.sample.user@gmail.com';
    try { email = JSON.parse(localStorage.getItem('bff.profile.v1')).email || email; } catch (e) {}
    const at = email.indexOf('@');
    const to = (p) => email.slice(0, at) + '+' + tm[p.id] + email.slice(at);
    const mk = (i, subject, snippet, id, name) => ({ id, messageCount: 1, viewUrl: 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(email) + '#all/thread-f:' + id,
      messages: [{ id: 'm' + id, threadId: id, date: '2026-11-01T10:00:00Z', internalDate: String(Date.parse('2026-11-01T10:00:00Z') + i), labelIds: [], sender: 'hello@brand-' + i + '.example.com',
        addressDisplayNames: [{ displayName: name || ('Brand ' + i), emailAddress: 'hello@brand-' + i + '.example.com' }], snippet, subject, toRecipients: [to(P[i])],
        viewUrl: 'https://mail.google.com/mail/?authuser=x#all/thread-f:' + id }] });
    const list = [
      mk(0, 'Welcome to the club!', 'Thanks for joining. Your box is on its way.', 'tA1'),
      mk(1, 'Please confirm your email', 'Click to verify your email address', 'tA2'),
      mk(2, 'Your sample was delivered', 'It was delivered today', 'tA3')
    ];
    if (window.__gm.hostile) list.push(mk(3, '<img src=x onerror="window.__pwned=1"> Welcome aboard', '<script>window.__pwned=2<\\/script> &lt;b&gt;bold&lt;/b&gt; <img src=x onerror=window.__pwned=4>', 'tA4', '<svg onload=window.__pwned=3>'));
    return list;
  }

  const mcp = {
    async callTool(server, tool, input) {
      const gm = window.__gm;
      window.__calls.push({ server, tool, input: JSON.parse(JSON.stringify(input === undefined ? null : input)), gesture: Date.now() - window.__lastTap < 4000, t: Date.now() });
      counts[tool] = (counts[tool] || 0) + 1;
      await delay(gm.delay);
      if (gm.mode === 'not_connected') throw err({ code: 'server_not_connected', server, message: 'Gmail is not connected.' });
      if (gm.mode === 'consent') { gm.mode = 'connected'; await delay(300); }
      if (gm.mode === 'denied') throw err({ code: 'not_granted', server, message: 'The viewer said no.' });
      if (gm.missing.indexOf(tool) >= 0) throw err({ code: 'tool_error', server, message: 'Unknown tool ' + tool });
      const f = gm.fail[tool] || gm.fail['*'];
      if (f && (!f.times || counts[tool] <= f.times)) throw err(Object.assign({ server }, f));
      const B = window.BFF;
      if (tool === 'search_threads') {
        if (gm.empty || input.pageToken) return { payload: gm.empty ? {} : { threads: [], resultCountEstimate: '0' } };
        return { payload: { threads: threads(), resultCountEstimate: '4' } };
      }
      if (tool === 'list_labels') return { payload: { labels: gm.hasLabel ? [{ labelId: 'Label_9', name: 'Baby Freebies', labelType: 'USER' }] : [{ labelId: 'INBOX', name: 'INBOX', labelType: 'SYSTEM' }] } };
      if (tool === 'create_label') return { payload: { labelId: 'Label_77', name: input.displayName } };
      if (tool === 'label_thread') return { payload: {} };
      if (tool === 'create_draft') return { payload: { id: 'r123', viewUrl: 'https://mail.google.com/mail/?authuser=x#drafts/r123' } };
      return { payload: {} };
    },
    async listTools(server) {
      window.__calls.push({ listTools: server, gesture: Date.now() - window.__lastTap < 4000, t: Date.now() });
      const all = ${JSON.stringify(ALLOWED_TOOLS)}.filter((t) => window.__gm.missing.indexOf(t) < 0);
      return { servers: [{ server: 'Gmail', authStatus: 'connected', kind: 'connector', tools: all.map((name) => ({ name, description: '' })) }] };
    }
  };

  window.claude = {
    use(name) {
      window.__uses.push(name);
      return new Promise((res) => setTimeout(() => {
        if (cfg.nullAll) return res(null);
        if (name === 'downloads') return res(downloads);
        if (name === 'mcp') return res(mcp);
        res(null);
      }, 20));
    }
  };
})();`;
  return src;
}
