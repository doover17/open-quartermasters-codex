// Spiral Forge: the entry point. Wires every page up, restores the saved work,
// opens the last tab, and connects to Claude when the page runs on claude.ai.
import { store, state, lstate } from "./app/state.js";
import { claude, connectClaude } from "./shared/claude.js";
import { initShell, onView, showView } from "./app/shell.js";
import { initWireframe } from "./map/wireframe.js";
import { initCampaign, refreshAll, showOutputTools, setStatus, btnWeave } from "./features/campaign.js";
import { initLocation, buildLocSheet, refreshLoc, lshowTools, lsetStatus, btnLBuild } from "./features/location.js";
import { initLayout, refreshLayout, drawLayout } from "./features/layout.js";
import { initImageExports } from "./features/export/images.js";
import { initVtt } from "./features/export/vtt.js";
import { initGmSheet } from "./features/export/gm-sheet.js";
import { initNotion, updateNotionButtons } from "./features/notion.js";
import { initLibrary, cleanStoreInPlace, updateLibButtons, renderLib, resetLibraryUi } from "./features/library.js";
import { initBestiary, openBestiary } from "./features/catalogs/bestiary.js";
import { initItems, openItems } from "./features/catalogs/items.js";
import { initSpells, openSpells } from "./features/catalogs/spells.js";
import { initLoot, openLoot } from "./features/loot.js";
import { initEncounters, openEncounters } from "./features/encounters.js";
import { initCombat, openCombat } from "./features/combat.js";

// What each tab does when it opens.
onView("layout", drawLayout);
onView("library", () => { resetLibraryUi(); renderLib(); });
onView("bestiary", openBestiary);
onView("items", openItems);
onView("loot", openLoot);
onView("spells", openSpells);
onView("encounters", openEncounters);
onView("combat", openCombat);

// Wire the pages. Each init builds its markup and listens to its own controls;
// nothing here reads saved work yet.
initShell();
initWireframe();
initCampaign();
initLocation();
initLayout();
initImageExports();
initVtt();
initGmSheet();
initNotion();
initLibrary();
initBestiary();
initItems();
initSpells();
initLoot();
initEncounters();
initCombat();

// Startup. If anything in the saved state still trips a renderer, fall back to the
// Campaign tab rather than leaving the page half-built; Claude is connected either way.
try { cleanStoreInPlace(); } catch (e) { console.error(e); }
try {
  buildLocSheet(); refreshAll(); refreshLoc(); refreshLayout(); showView(store.view); updateLibButtons();
} catch (e) {
  console.error(e);
  try { store.view = "campaign"; showView("campaign"); updateLibButtons(); } catch (e2) { console.error(e2); }
  setStatus("Something in your saved work couldn't be shown. Your library is intact; export a backup from the Library tab to be safe.", true);
}

(async () => {
  if (!await connectClaude()) { btnWeave.disabled = btnLBuild.disabled = true; lsetStatus("Open this page on claude.ai to have Claude build the location.", true); setStatus("Open this page on claude.ai to have Claude weave the campaign.", true); return; }
  updateNotionButtons();
  if (!claude.sample) { btnWeave.disabled = btnLBuild.disabled = true; lsetStatus("Claude isn't available in this view. The roll sheet still works.", true); setStatus("Claude isn't available in this view. The roll sheet still works.", true); }
  if (state.output) showOutputTools(true);
  if (lstate.output) lshowTools(true);
  if (store.view === "layout") drawLayout();
  if (store.view === "library") renderLib();
})();
