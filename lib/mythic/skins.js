// The full League skin catalog, used to (a) validate names people pass to
// /alert and (b) power slash-command autocomplete.
//
// Source: CommunityDragon's skins.json (~2000 skins). It's a few MB, so we
// cache it on disk and only re-download when the cache is older than a day.

const fs = require("fs");
const path = require("path");
const { norm } = require("./util");

const CATALOG_URL =
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/skins.json";
const CACHE_FILE =
    process.env.MYTHIC_SKINS_CACHE ||
    path.join(__dirname, "../../mythic-skins-cache.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// In-memory index: [{ name, norm }], sorted, deduped, non-base skins only.
let _index = [];
let _byNorm = new Map();

function buildIndex(names) {
    const seen = new Set();
    const list = [];
    for (const name of names) {
        const n = norm(name);
        if (!n || seen.has(n)) continue;
        seen.add(n);
        list.push({ name, norm: n });
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    _index = list;
    _byNorm = new Map(list.map((e) => [e.norm, e.name]));
}

function namesFromCatalog(catalog) {
    return Object.values(catalog)
        .filter((s) => s && s.name && s.isBase === false)
        .map((s) => s.name);
}

async function downloadCatalog() {
    const res = await fetch(CATALOG_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`skins.json HTTP ${res.status}`);
    const catalog = await res.json();
    const names = namesFromCatalog(catalog);
    try {
        fs.writeFileSync(
            CACHE_FILE,
            JSON.stringify({ fetchedAt: Date.now(), names }, null, 0)
        );
    } catch {
        // Non-fatal: we can run from memory without a disk cache.
    }
    return names;
}

function readFreshCache() {
    try {
        const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
        if (raw && Array.isArray(raw.names) && Date.now() - raw.fetchedAt < CACHE_TTL_MS) {
            return raw.names;
        }
    } catch {
        // no/expired/corrupt cache
    }
    return null;
}

// Load the catalog into memory. Prefers a fresh disk cache, otherwise downloads.
// Safe to call more than once; only refreshes when needed.
async function ensureLoaded() {
    if (_index.length) return;
    const cached = readFreshCache();
    if (cached) {
        buildIndex(cached);
        return;
    }
    const names = await downloadCatalog();
    buildIndex(names);
}

// Resolve free-text input to a canonical skin name.
//   -> { ok: true, name } on an exact (normalized) match
//   -> { ok: false, suggestions: [names] } otherwise
function resolve(query) {
    const n = norm(query);
    if (_byNorm.has(n)) return { ok: true, name: _byNorm.get(n) };

    // Prefix/substring matches first; if none (e.g. a misspelling), fall back to
    // closest by edit distance so we can still say "did you mean…".
    let suggestions = search(query, 5).map((e) => e.name);
    if (suggestions.length === 0) suggestions = fuzzySuggest(n, 5);
    return { ok: false, suggestions };
}

// Bounded Levenshtein distance; returns Infinity once it exceeds `max`.
function levenshtein(a, b, max) {
    const al = a.length, bl = b.length;
    if (Math.abs(al - bl) > max) return Infinity;
    let prev = new Array(bl + 1);
    for (let j = 0; j <= bl; j++) prev[j] = j;
    for (let i = 1; i <= al; i++) {
        let cur = [i];
        let best = i;
        for (let j = 1; j <= bl; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
            if (cur[j] < best) best = cur[j];
        }
        if (best > max) return Infinity;
        prev = cur;
    }
    return prev[bl];
}

function fuzzySuggest(normQuery, limit) {
    if (!normQuery) return [];
    const max = Math.max(2, Math.ceil(normQuery.length * 0.4));
    const scored = [];
    for (const e of _index) {
        const d = levenshtein(normQuery, e.norm, max);
        if (d !== Infinity) scored.push({ name: e.name, d });
    }
    scored.sort((a, b) => a.d - b.d);
    return scored.slice(0, limit).map((s) => s.name);
}

// Autocomplete search: prefix matches first, then substring matches.
function search(query, limit = 25) {
    const n = norm(query);
    if (!n) return _index.slice(0, limit);
    const prefix = [];
    const contains = [];
    for (const e of _index) {
        if (e.norm.startsWith(n)) prefix.push(e);
        else if (e.norm.includes(n)) contains.push(e);
        if (prefix.length >= limit) break;
    }
    return prefix.concat(contains).slice(0, limit);
}

function isLoaded() {
    return _index.length > 0;
}

module.exports = { ensureLoaded, resolve, search, isLoaded };
