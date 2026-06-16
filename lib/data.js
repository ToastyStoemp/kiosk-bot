const fs = require("fs");
const path = require("path");

const DATA_FILE = process.env.DATA_PATH || path.join(__dirname, "../data.json");

let _cache = null;

function defaultUserData() {
    return {
        orders: 0,
        mistakes: 0,
        mcflurryFails: 0,
        totalSpentCents: 0,
        username: null,
        receipts: [],
        items: {},
        hiddenItems: {},
        rareTitles: {},
        lore: {}
    };
}

function loadData() {
    if (_cache) return _cache;

    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(
            { users: {}, cleanup: [], global: { orders: 0, revenueCents: 0, items: {}, receipts: [] } },
            null, 2
        ));
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    if (!data.users) data.users = {};
    if (!data.cleanup) data.cleanup = [];

    if (!data.global) data.global = { orders: 0, revenueCents: 0, items: {}, receipts: [] };
    if (!data.global.items) data.global.items = {};
    if (!data.global.receipts) data.global.receipts = [];
    if (!data.global.orders) data.global.orders = 0;
    if (!data.global.revenueCents) data.global.revenueCents = 0;

    _cache = data;
    return _cache;
}

function saveData(data) {
    _cache = data;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUserData(data, userId) {
    if (!data.users[userId]) {
        data.users[userId] = defaultUserData();
    }

    const defaults = defaultUserData();

    data.users[userId] = {
        ...defaults,
        ...data.users[userId],
        items: data.users[userId].items || {},
        hiddenItems: data.users[userId].hiddenItems || {},
        rareTitles: data.users[userId].rareTitles || {},
        lore: data.users[userId].lore || {},
        receipts: data.users[userId].receipts || [],
        totalSpentCents: data.users[userId].totalSpentCents || 0
    };

    return data.users[userId];
}

module.exports = { loadData, saveData, getUserData, defaultUserData };
