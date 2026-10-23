// Send to Notion through the viewer's own Notion connector (the artifact
// runtime's MCP bridge). A campaign becomes a page; a location brings its map.
import { $, esc as xesc } from "../shared/dom.js";
import { docTitle } from "../shared/format.js";
import { httpsUrl } from "../shared/sanitize.js";
import { NDEST_KEY } from "../shared/storage.js";
import { state, lstate, ystate, save, lsave } from "../app/state.js";
import { claude } from "../shared/claude.js";
import { splitMap, lmap } from "../map/wireframe.js";
import { ysource } from "../map/geometry.js";
import { renderLayout } from "../map/render.js";

const NOTION = "Notion";
export const nOpen = { campaign: false, location: false };
const nState = { campaign: { results: [], busy: false }, location: { results: [], busy: false } };
function loadDest() { try { return JSON.parse(localStorage.getItem(NDEST_KEY)) || { mode: "draft" }; } catch { return { mode: "draft" }; } }
function saveDest(d) { try { localStorage.setItem(NDEST_KEY, JSON.stringify(d)); } catch {} }

// Our Markdown → Notion-flavored Markdown: title moves to the page property,
// sections with ### entries become toggle headings, secrets become checkboxes.
function toNotionMd(md, kind) {
  const lines = md.replace(/\r/g, "").split("\n");
  if (/^#\s/.test(lines[0] || "")) lines.shift();
  const out = []; let section = "", toggle = null;
  const esc = t => t.replace(/</g, "&lt;");
  const closeToggle = () => {
    if (!toggle) return;
    const body = toggle.body.join("\n").trim();
    out.push(`<toggle heading="h3">${esc(toggle.title)}${body ? "\n\n" + body : ""}\n</toggle>`, "");
    toggle = null;
  };
  for (const raw of lines) {
    const line = raw;
    if (/^##\s/.test(line)) { closeToggle(); section = line.replace(/^##\s*/, "").toLowerCase(); out.push(esc(line)); continue; }
    if (/^###\s/.test(line)) { closeToggle(); toggle = { title: line.replace(/^###\s*/, "").trim(), body: [] }; continue; }
    let l = esc(line);
    if (/secret/.test(section)) l = l.replace(/^\s*(\d+[.)]|[-*])\s+/, "- [ ] ");
    if (/^>\s?/.test(line) && !toggle) { out.push(`<callout icon="${kind === "campaign" ? "🌀" : "🗺️"}" color="gray_bg">${esc(line.replace(/^>\s?/, ""))}</callout>`); continue; }
    (toggle ? toggle.body : out).push(l);
  }
  closeToggle();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function notionError(e) {
  return ({
    server_not_connected: "Notion isn't connected. Add it in claude.ai Settings → Connectors, then try again.",
    needs_reauth: "Your Notion connection needs refreshing. Reconnect Notion in claude.ai Settings → Connectors.",
    selection_required: "You have more than one Notion connection. Choose one when claude.ai asks, then try again.",
    not_in_manifest: "Notion isn't allowed for this page. Allow it from the artifact's Permissions menu, then try again.",
    approval_required: "Sending to Notion needs your approval. claude.ai asks when this page is open there.",
    blocked_by_policy: "Your organization's settings block this Notion action.",
    not_granted: "Connectors aren't available in this view.",
    capability_disabled: "Connectors aren't available in this view.",
  })[e?.code];
}

export function renderNotionPanel(kind) {
  const el = document.getElementById(kind === "campaign" ? "cnotion-panel" : "lnotion-panel");
  el.hidden = !nOpen[kind];
  if (!nOpen[kind]) return;
  const w = kind === "campaign" ? state : lstate, ns = nState[kind], dest = loadDest();
  const campPage = kind === "location" && lstate.fromCampaign && state.notion?.id && docTitle(state.output, "") === lstate.fromCampaign.campaign ? state.notion : null;
  const mode = ns.mode || (campPage ? "campaign" : dest.mode);
  const picked = ns.picked || (dest.mode === "page" ? dest.page : null);
  el.innerHTML = `
    <strong>Send "${xesc(docTitle(w.output, kind === "campaign" ? "this campaign" : "this location"))}" to Notion</strong>
    ${httpsUrl(w.notion?.url) ? `<div class="notion-done">Already sent <a href="${xesc(httpsUrl(w.notion.url))}" target="_blank" rel="noopener">open it in Notion</a>. Sending again makes a new page.</div>` : ""}
    ${campPage ? `<label class="opt"><input type="radio" name="nd-${kind}" value="campaign" ${mode === "campaign" ? "checked" : ""}><span>Inside its campaign page<small>${xesc(lstate.fromCampaign.campaign)}</small></span></label>` : ""}
    <label class="opt"><input type="radio" name="nd-${kind}" value="draft" ${mode === "draft" ? "checked" : ""}><span>A private page<small>Lands in your Private section; move it anywhere later.</small></span></label>
    <label class="opt"><input type="radio" name="nd-${kind}" value="page" ${mode === "page" ? "checked" : ""}><span>Inside one of your pages${picked ? `<small>${xesc(picked.title)}${picked.path ? " · " + xesc(picked.path) : ""}</small>` : ""}</span></label>
    ${mode === "page" ? `<input type="search" data-nsearch placeholder="Search your Notion pages, e.g. campaigns" value="${xesc(ns.q || "")}" aria-label="Search Notion pages">
      <div class="notion-results">${ns.searching ? `<span class="note">Searching…</span>` : ns.results.map(r => `<button type="button" class="small" data-npick="${xesc(r.id)}" aria-pressed="${picked?.id === r.id}">${xesc(r.title || "Untitled")}${r.path ? `<small>${xesc(r.path)}</small>` : ""}</button>`).join("") || (ns.q ? `<span class="note">No pages found.</span>` : "")}</div>` : ""}
    <div class="actions">
      <button type="button" class="primary" data-nsend ${ns.busy || (mode === "page" && !picked) ? "disabled" : ""}>${ns.busy ? "Sending…" : "Send"}</button>
      <button type="button" class="ghost" data-nclose>Close</button>
      <span class="status" data-nstatus>${xesc(ns.msg || "")}</span>
    </div>`;
  el.querySelector("[data-nstatus]").classList.toggle("err", !!ns.err);
  const box = el.querySelector("[data-nsearch]");
  if (box && ns.focusSearch) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); ns.focusSearch = false; }
}

let nSearchTimer = null;
function wireNotionPanel(kind) {
  const el = document.getElementById(kind === "campaign" ? "cnotion-panel" : "lnotion-panel"), ns = nState[kind];
  el.addEventListener("change", e => {
    if (e.target.name === `nd-${kind}`) { ns.mode = e.target.value; ns.msg = ""; if (ns.mode !== "campaign") saveDest({ ...loadDest(), mode: ns.mode }); renderNotionPanel(kind); }
  });
  el.addEventListener("input", e => {
    if (!e.target.matches("[data-nsearch]")) return;
    ns.q = e.target.value;
    clearTimeout(nSearchTimer);
    nSearchTimer = setTimeout(async () => {
      if (!ns.q.trim() || !claude.mcp) { ns.results = []; ns.focusSearch = true; renderNotionPanel(kind); return; }
      ns.searching = true; ns.focusSearch = true; renderNotionPanel(kind);
      try {
        const r = await claude.mcp.callTool(NOTION, "notion-search", { query: ns.q.trim(), page_size: 8, max_highlight_length: 0 });
        ns.results = (r.payload?.results || []).filter(x => x.type === "page" && x.id).map(x => ({ id: x.id, title: x.title, url: x.url, path: x.path || "" }));
        ns.msg = ""; ns.err = false;
      } catch (err) { ns.results = []; ns.msg = notionError(err) || "Notion search didn't work just now. Try again."; ns.err = true; }
      ns.searching = false; ns.focusSearch = true; renderNotionPanel(kind);
    }, 450);
  });
  el.addEventListener("click", async e => {
    if (e.target.closest("[data-nclose]")) { nOpen[kind] = false; renderNotionPanel(kind); return; }
    const pick = e.target.closest("[data-npick]")?.dataset.npick;
    if (pick) { const r = ns.results.find(x => x.id === pick); ns.picked = r; saveDest({ mode: "page", page: r }); renderNotionPanel(kind); return; }
    if (e.target.closest("[data-nsend]")) sendToNotion(kind);
  });
}

async function sendToNotion(kind) {
  const ns = nState[kind]; if (ns.busy || !claude.mcp) return;
  const camp = kind === "campaign", w = camp ? state : lstate;
  if (!w.output) return;
  const dest = loadDest();
  const campPage = !camp && lstate.fromCampaign && state.notion?.id && docTitle(state.output, "") === lstate.fromCampaign.campaign ? state.notion : null;
  const mode = ns.mode || (campPage ? "campaign" : dest.mode);
  const picked = ns.picked || (dest.mode === "page" ? dest.page : null);
  const title = docTitle(w.output, camp ? "Campaign" : "Location");
  ns.busy = true; ns.err = false; ns.msg = "Sending…"; renderNotionPanel(kind);
  try {
    let content = toNotionMd(camp ? w.output : splitMap(w.output).body, kind);
    let mapNote = "";
    // locations bring their map: the layout draft if there is one, else the wireframe
    if (!camp) {
      try {
        const src = ysource();
        let svg = "";
        if (src && ystate.spec) {
          const keep = { ...ystate.opts }; Object.assign(ystate.opts, { player: false, level: null });
          svg = renderLayout(true, "full"); ystate.opts = keep;
        } else svg = lmap.outerHTML;
        if (svg && svg.length < 190000) {
          const fname = (title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "location") + "-map.svg";
          const a = await claude.mcp.callTool(NOTION, "notion-create-attachment", { content: svg, filename: fname });
          const srcRef = a.payload?.markdown_source;
          if (srcRef) content = `<image source="${srcRef}">Draft map · 1 square = 5 ft</image>\n\n` + content;
        } else mapNote = " The map was too large to attach.";
      } catch (err) {
        if (["server_not_connected", "needs_reauth", "not_in_manifest", "approval_required", "selection_required"].includes(err.code)) throw err;
        mapNote = " The map couldn't be attached.";
      }
    }
    const input = { pages: [{ properties: { title }, content, icon: camp ? "🌀" : "🗺️" }], allow_async: false };
    if (mode === "campaign" && campPage) input.parent = { type: "page_id", page_id: campPage.id };
    else if (mode === "page" && picked) input.parent = { type: "page_id", page_id: picked.id };
    else input.creation_mode = "draft";
    const r = await claude.mcp.callTool(NOTION, "notion-create-pages", input);
    const text = JSON.stringify(r.payload ?? r.content ?? "");
    const url = httpsUrl((text.match(/https:\/\/[^"\s\\]*notion[^"\s\\]*/) || [])[0] || "");
    const id = ((r.payload?.pages?.[0]?.id) || (text.match(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i) || [])[0] || "");
    w.notion = { url, id, at: Date.now() };
    (camp ? save : lsave)();
    ns.msg = (mode === "draft" ? "Sent as a private page." : "Sent.") + mapNote; ns.err = !!mapNote;
  } catch (err) {
    const known = notionError(err);
    ns.err = true;
    ns.msg = known || (err.code === "tool_error" ? `Notion reported a problem: ${String(err.message || "").slice(0, 160)}`
      : ["server_unavailable", "upstream_error", "cancelled"].includes(err.code) ? "Notion didn't answer in time. The page may still have been created, so check Notion before sending again."
      : "Something went wrong sending to Notion. Check Notion before trying again.");
  } finally { ns.busy = false; renderNotionPanel(kind); }
}

export function updateNotionButtons() {
  const on = !!claude.mcp;
  document.getElementById("btn-cnotion").hidden = !on || !state.output;
  document.getElementById("btn-lnotion").hidden = !on || !lstate.output;
}

export function initNotion() {
  document.getElementById("btn-cnotion").addEventListener("click", () => { nOpen.campaign = !nOpen.campaign; nState.campaign.msg = ""; renderNotionPanel("campaign"); });
  document.getElementById("btn-lnotion").addEventListener("click", () => { nOpen.location = !nOpen.location; nState.location.msg = ""; renderNotionPanel("location"); });
  wireNotionPanel("campaign"); wireNotionPanel("location");
}
