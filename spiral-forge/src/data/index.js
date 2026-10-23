// Static datasets. Each JSON file under data/ is fetched once when the app
// starts; top-level await means every importer sees the finished objects.
const here = import.meta.url;
async function load(name) {
  const r = await fetch(new URL(`../../data/${name}`, here));
  if (!r.ok) throw new Error(`Couldn't load data/${name} (${r.status})`);
  return r.json();
}
const [TABLES, settingsRaw, LOC, BOOKS, LAYOUT, RULES] = await Promise.all([
  load("tables.json"), load("settings.json"), load("locations.json"), load("books.json"), load("layout.json"), load("rules.json"),
]);

// Each setting brings its own tables, wording, prompt, and example rolls. Slot ids are shared,
// so the roll sheet is rebuilt in place; rolls, notes, and output are saved per setting.
const SETTINGS = Object.fromEntries(Object.entries(settingsRaw).map(([id, s]) => [id, { ...s, tables: TABLES[s.tables] }]));
const SETTING_IDS = Object.keys(SETTINGS);

// Monster books in the Bestiary: short tag, full name, publisher, license.
const bookOf = m => BOOKS[m?.src || "srd-2024"] || BOOKS["srd-2024"];

export { TABLES, SETTINGS, SETTING_IDS, LOC, BOOKS, bookOf, LAYOUT, RULES };
