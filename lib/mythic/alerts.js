// The mythic-shop alert engine: periodically fetch the shop, match it against
// typed user subscriptions (skins, per-skin chromas, per-champion chromas), and
// privately DM subscribers when a match appears.
//
// De-dupe is per (subscription × matched item × rotation): each user is pinged
// once per item while it's live, but a user who subscribes after it's already
// in the shop still gets pinged on the next poll, and an item that leaves and
// returns re-alerts. A champion subscription can match several chromas at once;
// each is tracked (and pinged) independently.

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

// Does a shop item satisfy a subscription?
function itemMatchesSub(item, sub) {
    if (sub.type === "skin") return item.type === "skin" && norm(item.name) === sub.match;
    if (sub.type === "chroma-skin") return item.type === "chroma" && norm(item.name) === sub.match;
    if (sub.type === "chroma-champion")
        return item.type === "chroma" && item.championId != null && String(item.championId) === sub.match;
    return false;
}

// First shop item matching a subscription (for "it's in the shop right now").
function findMatch(items, sub) {
    return items.find((it) => itemMatchesSub(it, sub)) || null;
}

// What to call an item in an alert.
function displayLabel(item) {
    if (item.type === "chroma") return item.chromaName || `${item.name} (Chroma)`;
    return item.name;
}

function itemId(item) {
    return `${item.type}|${norm(item.name)}|${item.chromaName || ""}|${item.endTime || "x"}`;
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

function titleCase(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// A rich embed describing one shop item. Reused by /mythicshop, /alert, /chroma.
function buildItemEmbed(item, { title } = {}) {
    const fields = [];
    if (item.type === "chroma" && item.name) {
        fields.push({ name: "Skin", value: item.name, inline: true });
    }
    if (item.cost != null) {
        fields.push({
            name: "Cost",
            value: `${item.cost}${item.currency ? " " + item.currency : ""}`,
            inline: true,
        });
    }
    const cat = prettyCategory(item.category);
    if (cat) fields.push({ name: "Section", value: cat, inline: true });
    if (item.type) fields.push({ name: "Type", value: titleCase(item.type), inline: true });
    const leaves = discordTimestamp(item.endTime);
    if (leaves) fields.push({ name: "Leaves", value: leaves, inline: true });

    const embed = {
        title: title || `🛒 ${displayLabel(item)}`,
        color: MYTHIC_PURPLE,
        fields,
    };
    if (item.imageUrl) embed.thumbnail = { url: item.imageUrl };
    return embed;
}

// Current shop, with a short in-memory cache so slash commands don't each fetch.
async function getCurrentShop({ maxAgeMs = 5 * 60 * 1000 } = {}) {
    if (_lastShop && Date.now() - _lastFetchAt < maxAgeMs) return _lastShop;
    const items = await shop.fetchShop();
    _lastShop = items;
    _lastFetchAt = Date.now();
    return items;
}

// A one-click "stop alerting me" button. custom_id encodes the subscription so
// the button handler knows exactly what to remove for whoever clicks it. Raw
// component JSON keeps this module free of discord.js imports.
function unsubComponents(sub) {
    if (!sub) return [];
    return [
        {
            type: 1, // action row
            components: [
                {
                    type: 2, // button
                    style: 2, // secondary (grey)
                    label: "Stop alerting me",
                    emoji: { name: "🔕" },
                    custom_id: `unsub:${sub.key}`,
                },
            ],
        },
    ];
}

async function notify(item, userIds, sub) {
    const embed = buildItemEmbed(item, { title: `🛒 ${displayLabel(item)} is in the Mythic Shop!` });
    const components = unsubComponents(sub);

    // Alerts are private: DM each subscriber individually. Discord only allows
    // ephemeral (private) messages as replies to an interaction, so a
    // poll-driven alert can't be posted privately in a shared channel — a DM is
    // the only way to keep it visible to just the subscriber.
    for (const userId of userIds) {
        try {
            const user = await _client.users.fetch(userId);
            await user.send({
                content: "🛒 Something you're watching is in the Mythic Shop!",
                embeds: [embed],
                components,
            });
        } catch (err) {
            console.error(`Mythic alert: couldn't DM ${userId} (DMs closed?):`, err.message);
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

    const data = store.load();
    const presentKeys = new Set();

    for (const sub of store.all()) {
        for (const item of items) {
            if (!itemMatchesSub(item, sub)) continue;
            const stateKey = `${sub.key}::${itemId(item)}`;
            presentKeys.add(stateKey);
            const st = (data.alertState[stateKey] ||= { notified: [] });
            const toNotify = sub.users.filter((u) => !st.notified.includes(u));
            if (toNotify.length) {
                console.log(`Mythic alert: notifying ${toNotify.length} user(s) for "${displayLabel(item)}".`);
                await notify(item, toNotify, sub);
                st.notified.push(...toNotify);
            }
        }
    }

    // Forget state for items no longer live so a return re-alerts.
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
    findMatch,
    itemMatchesSub,
    buildItemEmbed,
    displayLabel,
};
