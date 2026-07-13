// The League skin + champion catalogs, used to (a) validate names people pass
// to /alert and /chroma and (b) power slash-command autocomplete.
//
// Sources (CommunityDragon):
//   skins.json           — every skin (~2000; we keep non-base ones)
//   champion-summary.json — every champion (id -> name)
// Both are cached on disk together and re-downloaded at most once a day.

const fs = require("fs");
const path = require("path");
const { norm } = require("./util");

const CATALOG_URL =
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/skins.json";
const CHAMPION_URL =
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json";
const CACHE_FILE =
    process.env.MYTHIC_SKINS_CACHE ||
    path.join(__dirname, "../../mythic-skins-cache.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// In-memory indexes.
let _skinIndex = [];              // [{ name, norm }]
let _skinByNorm = new Map();      // norm -> canonical name
let _champIndex = [];             // [{ id, name, norm }]
let _champByNorm = new Map();     // norm -> { id, name }

function buildSkinIndex(names) {
    const seen = new Set();
    const list = [];
    for (const name of names) {
        const n = norm(name);
        if (!n || seen.has(n)) continue;
        seen.add(n);
        list.push({ name, norm: n });
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    _skinIndex = list;
    _skinByNorm = new Map(list.map((e) => [e.norm, e.name]));
}

function buildChampionIndex(champions) {
    const list = champions
        .filter((c) => c && c.id > 0 && c.name)
        .map((c) => ({ id: c.id, name: c.name, norm: norm(c.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    _champIndex = list;
    _champByNorm = new Map(list.map((e) => [e.norm, { id: e.id, name: e.name }]));
}

function namesFromCatalog(catalog) {
    return Object.values(catalog)
        .filter((s) => s && s.name && s.isBase === false)
        .map((s) => s.name);
}

async function fetchJson(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
    return res.json();
}

async function downloadCatalog() {
    const [catalog, summary] = await Promise.all([
        fetchJson(CATALOG_URL),
        fetchJson(CHAMPION_URL),
    ]);
    const names = namesFromCatalog(catalog);
    const champions = summary
        .filter((c) => c && c.id > 0 && c.name)
        .map((c) => ({ id: c.id, name: c.name }));
    try {
        fs.writeFileSync(
            CACHE_FILE,
            JSON.stringify({ fetchedAt: Date.now(), names, champions }, null, 0)
        );
    } catch {
        // Non-fatal: we can run from memory without a disk cache.
    }
    return { names, champions };
}

function readFreshCache() {
    try {
        const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
        if (
            raw &&
            Array.isArray(raw.names) &&
            Array.isArray(raw.champions) &&
            Date.now() - raw.fetchedAt < CACHE_TTL_MS
        ) {
            return raw;
        }
    } catch {
        // no/expired/corrupt cache
    }
    return null;
}

// Load both catalogs into memory. Prefers a fresh disk cache, else downloads.
// Safe to call repeatedly; only refreshes when needed.
async function ensureLoaded() {
    if (_skinIndex.length && _champIndex.length) return;
    const cached = readFreshCache();
    const data = cached || (await downloadCatalog());
    buildSkinIndex(data.names);
    buildChampionIndex(data.champions);
}

// --- generic search / resolve over a { name, norm } index ---

function searchIndex(index, query, limit) {
    const n = norm(query);
    if (!n) return index.slice(0, limit);
    const prefix = [];
    const contains = [];
    for (const e of index) {
        if (e.norm.startsWith(n)) prefix.push(e);
        else if (e.norm.includes(n)) contains.push(e);
        if (prefix.length >= limit) break;
    }
    return prefix.concat(contains).slice(0, limit);
}

// Bounded Levenshtein distance; returns Infinity once it exceeds `max`.
function levenshtein(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return Infinity;
    let prev = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
            if (cur[j] < best) best = cur[j];
        }
        if (best > max) return Infinity;
        prev = cur;
    }
    return prev[b.length];
}

function fuzzySuggest(index, normQuery, limit) {
    if (!normQuery) return [];
    const max = Math.max(2, Math.ceil(normQuery.length * 0.4));
    const scored = [];
    for (const e of index) {
        const d = levenshtein(normQuery, e.norm, max);
        if (d !== Infinity) scored.push({ name: e.name, d });
    }
    scored.sort((a, b) => a.d - b.d);
    return scored.slice(0, limit).map((s) => s.name);
}

// --- skins ---

// Resolve free text to a canonical skin name.
//   -> { ok: true, name } | { ok: false, suggestions: [names] }
function resolve(query) {
    const n = norm(query);
    if (_skinByNorm.has(n)) return { ok: true, name: _skinByNorm.get(n) };
    let suggestions = searchIndex(_skinIndex, query, 5).map((e) => e.name);
    if (suggestions.length === 0) suggestions = fuzzySuggest(_skinIndex, n, 5);
    return { ok: false, suggestions };
}

function search(query, limit = 25) {
    return searchIndex(_skinIndex, query, limit);
}

// --- champions ---

// Resolve free text to a champion.
//   -> { ok: true, id, name } | { ok: false, suggestions: [names] }
function resolveChampion(query) {
    const n = norm(query);
    if (_champByNorm.has(n)) {
        const c = _champByNorm.get(n);
        return { ok: true, id: c.id, name: c.name };
    }
    let suggestions = searchIndex(_champIndex, query, 5).map((e) => e.name);
    if (suggestions.length === 0) suggestions = fuzzySuggest(_champIndex, n, 5);
    return { ok: false, suggestions };
}

function searchChampions(query, limit = 25) {
    return searchIndex(_champIndex, query, limit).map((e) => ({ id: e.id, name: e.name }));
}

function championName(id) {
    const c = _champIndex.find((e) => e.id === Number(id));
    return c ? c.name : null;
}

function isLoaded() {
    return _skinIndex.length > 0 && _champIndex.length > 0;
}

module.exports = {
    ensureLoaded,
    resolve,
    search,
    resolveChampion,
    searchChampions,
    championName,
    isLoaded,
};
