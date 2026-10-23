// Claude access through the claude.ai artifact runtime (window.claude). The page
// still works as a plain roll sheet when the runtime isn't there.
export const claude = { sample: null, downloads: null, mcp: null };

// Connect to the runtime. Returns false when this page isn't running on claude.ai.
export async function connectClaude() {
  const c = window.claude;
  if (!c?.use) return false;
  [claude.sample, claude.downloads, claude.mcp] = await Promise.all([c.use("sample"), c.use("downloads"), c.use("mcp")]);
  return true;
}

// Ask for JSON: sample.json when the runtime has it, else parse the first {...} in the text.
export async function claudeJson(prompt, opts) {
  const sample = claude.sample;
  if (typeof sample.json === "function") {
    try { return await sample.json(prompt, opts); }
    catch (e) { if (e.code === "invalid_json" && e.text) return parseJsonIn(e.text); throw e; }
  }
  const { text } = await sample(prompt, opts);
  return parseJsonIn(text);
}
const parseJsonIn = text => JSON.parse((text.match(/\{[\s\S]*\}/) || ["null"])[0]);

// Plain-language messages for the runtime's error codes. Features add their own "bad reply" code.
const ERRORS = {
  cancelled: "Stopped.",
  not_granted: "Claude isn't allowed for this page.",
  sampling_disabled: "Claude isn't available on this account.",
  rate_limited: "Too many requests right now. Wait a minute and try again.",
  session_expired: "Your session expired. Sign in again, then retry.",
  refused: "Claude declined that request. Try different wording.",
};
export function claudeErrorMessage(e, extra = {}, syntaxMsg) {
  const { syntax = syntaxMsg, generic = "Something went wrong reaching Claude. Try again.", ...codes } = extra;
  const map = { ...ERRORS, ...codes };
  return map[e?.code] || (e instanceof SyntaxError && syntax ? syntax : generic);
}

// Load a library from a CDN once (JSZip for VTT files, jsPDF for the GM sheet).
const loads = {};
export function loadScript(url, ready, missing = "load failed") {
  const have = ready(); if (have) return Promise.resolve(have);
  return loads[url] ||= new Promise((res, rej) => {
    const sc = document.createElement("script");
    sc.src = url;
    sc.onload = () => { const v = ready(); v ? res(v) : rej(new Error(missing)); };
    sc.onerror = () => { loads[url] = null; rej(new Error("load failed")); };
    document.head.appendChild(sc);
  });
}
