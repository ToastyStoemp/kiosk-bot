// Persistent storage for mythic-shop alert subscriptions and de-dupe state.
// Separate file from the McDonald's data.json so the two features stay
// decoupled. Mirrors the load/save-with-cache pattern used in lib/data.js.
//
// Subscriptions are typed:
//   type "skin"            match = normalized skin name     (the skin itself)
//   type "chroma-skin"     match = normalized skin name     (that skin's chroma)
//   type "chroma-champion" match = champion id (as string)  (any chroma of champ)
//
// Shape:
// {
//   subscriptions: {
//     "<type>|<match>": { type, match, label, users: ["<userId>", ...] }
//   },
//   alertState: { "<stateKey>": { notified: ["<userId>", ...] } }
// }

const fs = require("fs");
const path = require("path");

const FILE =
    process.env.MYTHIC_DATA_PATH || path.join(__dirname, "../../mythic-data.json");

let _cache = null;

function keyOf(sub) {
    return `${sub.type}|${sub.match}`;
}

// Human-readable label for a subscription.
function describe(sub) {
    if (sub.type === "chroma-champion") return `${sub.label} — any chroma`;
    if (sub.type === "chroma-skin") return `${sub.label} — chroma`;
    return sub.label;
}

function load() {
    if (_cache) return _cache;
    try {
        const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
        _cache = {
            subscriptions: data.subscriptions || {},
            alertState: data.alertState || {},
        };
    } catch {
        _cache = { subscriptions: {}, alertState: {} };
    }
    return _cache;
}

function save() {
    if (!_cache) return;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(_cache, null, 2));
}

// Add a subscription for a user. sub = { type, match, label }.
// Returns true if newly added, false if already subscribed.
function add(userId, sub) {
    const data = load();
    const key = keyOf(sub);
    const entry = (data.subscriptions[key] ||= { type: sub.type, match: sub.match, label: sub.label, users: [] });
    entry.label = sub.label; // keep display label fresh
    if (entry.users.includes(userId)) return false;
    entry.users.push(userId);
    save();
    return true;
}

// Remove by composite key. Returns true if a subscription was removed.
function removeByKey(userId, key) {
    const data = load();
    const entry = data.subscriptions[key];
    if (!entry) return false;
    const i = entry.users.indexOf(userId);
    if (i === -1) return false;
    entry.users.splice(i, 1);
    if (entry.users.length === 0) delete data.subscriptions[key];
    save();
    return true;
}

function remove(userId, sub) {
    return removeByKey(userId, keyOf(sub));
}

// Subscriptions a user has: [{ type, match, label, key }]
function listForUser(userId) {
    const data = load();
    return Object.entries(data.subscriptions)
        .filter(([, v]) => v.users.includes(userId))
        .map(([key, v]) => ({ key, type: v.type, match: v.match, label: v.label }))
        .sort((a, b) => describe(a).localeCompare(describe(b)));
}

// All subscription entries: [{ key, type, match, label, users }]
function all() {
    const data = load();
    return Object.entries(data.subscriptions).map(([key, v]) => ({
        key,
        type: v.type,
        match: v.match,
        label: v.label,
        users: v.users,
    }));
}

module.exports = {
    load,
    save,
    add,
    remove,
    removeByKey,
    listForUser,
    all,
    keyOf,
    describe,
};
