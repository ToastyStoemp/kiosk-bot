// The mythic-shop alert engine: periodically fetch the shop, match it against
// user subscriptions, and @mention subscribers when their skin shows up.
//
// De-dupe is per (skin + rotation + user): each user is pinged once while a
// skin is live, but a user who subscribes after it's already in the shop still
// gets pinged on the next poll, and a skin that leaves and returns re-alerts.

const shop = require("./shop");
const store = require("./store");
const { norm } = require("./util");

const MYTHIC_PURPLE = 0x9b59d0;

let _client = null;
let _lastShop = null;
let _lastFetchAt = 0;

function init(client) {
    _client = client;
}

// Prefer the base skin over its chroma/emote/icon when several shop items share
// a name.
function rank(item) {
    if (item.type === "skin") return 3;
    if (item.type === "chroma") return 2;
    return 1;
}

function discordTimestamp(iso) {
    if (!iso) return null;
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return null;
    return `<t:${Math.floor(ms / 1000)}:R>`;
}

function prettyCategory(c) {
    const map = { FEATURED: "Featured", BIWEEKLY: "Bi-weekly", WEEKLY: "Weekly", DAILY: "Daily" };
    return map[c] || c || null;
}

// A rich embed describing one shop item. Reused by /mythicshop and /alert.
function buildItemEmbed(item, { title } = {}) {
    const fields = [];
    if (item.cost != null) {
        fields.push({
            name: "Cost",
            value: `${item.cost}${item.currency ? " " + item.currency : ""}`,
            inline: true,
        });
    }
    const cat = prettyCategory(item.category);
    if (cat) fields.push({ name: "Section", value: cat, inline: true });
    if (item.type) fields.push({ name: "Type", value: item.type, inline: true });
    const leaves = discordTimestamp(item.endTime);
    if (leaves) fields.push({ name: "Leaves", value: leaves, inline: true });

    const embed = {
        title: title || `🛒 ${item.name}`,
        color: MYTHIC_PURPLE,
        fields,
    };
    if (item.imageUrl) embed.thumbnail = { url: item.imageUrl };
    return embed;
}

// Return the current shop, using a short in-memory cache so slash commands
// don't each trigger a fetch.
async function getCurrentShop({ maxAgeMs = 5 * 60 * 1000 } = {}) {
    if (_lastShop && Date.now() - _lastFetchAt < maxAgeMs) return _lastShop;
    const items = await shop.fetchShop();
    _lastShop = items;
    _lastFetchAt = Date.now();
    return items;
}

// Best matching shop item for a canonical skin name, or null.
function matchInShop(items, canonicalName) {
    const key = norm(canonicalName);
    let best = null;
    for (const it of items) {
        if (norm(it.name) === key && (!best || rank(it) > rank(best))) best = it;
    }
    return best;
}

async function notify(item, userIds) {
    const embed = buildItemEmbed(item, { title: `🛒 ${item.name} is in the Mythic Shop!` });
    const channelId = process.env.MYTHIC_ALERT_CHANNEL_ID;

    if (channelId && _client) {
        try {
            const channel = await _client.channels.fetch(channelId);
            const mentions = userIds.map((u) => `<@${u}>`).join(" ");
            await channel.send({
                content: `${mentions} a skin you're watching is available!`,
                embeds: [embed],
                allowedMentions: { users: userIds },
            });
            return;
        } catch (err) {
            console.error("Mythic alert: channel send failed, falling back to DM:", err.message);
        }
    }

    // Fallback: DM each subscriber.
    for (const userId of userIds) {
        try {
            const user = await _client.users.fetch(userId);
            await user.send({ embeds: [embed] });
        } catch {
            // User has DMs closed / not reachable — skip.
        }
    }
}

// One check cycle.
async function checkNow() {
    let items;
    try {
        items = await getCurrentShop({ maxAgeMs: 0 }); // always fresh on a scheduled check
    } catch (err) {
        console.error("Mythic alert: shop fetch failed:", err.message);
        return;
    }

    // Best item per normalized name.
    const present = new Map();
    for (const it of items) {
        const key = norm(it.name);
        const cur = present.get(key);
        if (!cur || rank(it) > rank(cur)) present.set(key, it);
    }

    const data = store.load();
    const presentKeys = new Set();

    for (const sub of store.allSubscriptions()) {
        const item = present.get(sub.norm);
        if (!item) continue;
        const rotationKey = `${sub.norm}::${item.endTime || "x"}`;
        presentKeys.add(rotationKey);
        const st = (data.alertState[rotationKey] ||= { notified: [] });
        const toNotify = sub.users.filter((u) => !st.notified.includes(u));
        if (toNotify.length) {
            console.log(`Mythic alert: notifying ${toNotify.length} user(s) for "${item.name}".`);
            await notify(item, toNotify);
            st.notified.push(...toNotify);
        }
    }

    // Forget state for rotations no longer live so a return re-alerts.
    for (const k of Object.keys(data.alertState)) {
        if (!presentKeys.has(k)) delete data.alertState[k];
    }
    store.save();
}

function scheduleLoop() {
    const minutes = Number(process.env.MYTHIC_POLL_MINUTES) || 30;
    const run = () => {
        checkNow().catch((err) => console.error("Mythic alert loop error:", err));
    };
    run();
    setInterval(run, minutes * 60 * 1000);
    console.log(`Mythic shop alerts: polling every ${minutes} min.`);
}

module.exports = {
    init,
    scheduleLoop,
    checkNow,
    getCurrentShop,
    matchInShop,
    buildItemEmbed,
};
