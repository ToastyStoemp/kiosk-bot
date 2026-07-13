// Persistent storage for mythic-shop alert subscriptions and de-dupe state.
// Separate file from the McDonald's data.json so the two features stay
// decoupled. Mirrors the load/save-with-cache pattern used in lib/data.js.
//
// Shape:
// {
//   subscriptions: {
//     "<normalized name>": { name: "<canonical>", users: ["<userId>", ...] }
//   },
//   alertState: {
//     "<normName>::<endTime>": { notified: ["<userId>", ...] }
//   }
// }

const fs = require("fs");
const path = require("path");
const { norm } = require("./util");

const FILE =
    process.env.MYTHIC_DATA_PATH || path.join(__dirname, "../../mythic-data.json");

let _cache = null;

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

// Subscribe a user to a canonical skin name. Returns true if newly added.
function subscribe(userId, canonicalName) {
    const data = load();
    const key = norm(canonicalName);
    const entry = (data.subscriptions[key] ||= { name: canonicalName, users: [] });
    entry.name = canonicalName; // keep canonical spelling fresh
    if (entry.users.includes(userId)) return false;
    entry.users.push(userId);
    save();
    return true;
}

// Unsubscribe a user. Returns true if a subscription was removed.
function unsubscribe(userId, canonicalName) {
    const data = load();
    const key = norm(canonicalName);
    const entry = data.subscriptions[key];
    if (!entry) return false;
    const i = entry.users.indexOf(userId);
    if (i === -1) return false;
    entry.users.splice(i, 1);
    if (entry.users.length === 0) delete data.subscriptions[key];
    save();
    return true;
}

// Canonical names a given user is subscribed to.
function listForUser(userId) {
    const data = load();
    return Object.values(data.subscriptions)
        .filter((e) => e.users.includes(userId))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));
}

// All subscription entries: [{ norm, name, users }]
function allSubscriptions() {
    const data = load();
    return Object.entries(data.subscriptions).map(([k, v]) => ({
        norm: k,
        name: v.name,
        users: v.users,
    }));
}

module.exports = {
    load,
    save,
    subscribe,
    unsubscribe,
    listForUser,
    allSubscriptions,
};
