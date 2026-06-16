const { trackMessageForDeletion } = require("./cleanup");

const rateLimits = new Map();

function formatMoney(cents) {
    return `$${(cents / 100).toFixed(2)}`;
}

function formatDuration(ms) {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
}

function formatReceipt(receipt) {
    const date = new Date(receipt.timestamp).toLocaleString();
    return `#${receipt.id} — ${receipt.item} — ${formatMoney(receipt.priceCents)} — ${date}`;
}

function getMostPopularItem(items) {
    return Object.entries(items || {}).sort((a, b) => b[1] - a[1])[0];
}

function isRateLimited(userId, bucket, cooldownMs) {
    const key = `${userId}:${bucket}`;
    const now = Date.now();
    const availableAt = rateLimits.get(key) || 0;

    if (availableAt > now) {
        return { limited: true, remainingMs: availableAt - now };
    }

    rateLimits.set(key, now + cooldownMs);
    return { limited: false, remainingMs: 0 };
}

async function replyWithAutoDelete(message, text, delayMs) {
    const reply = await message.reply(text);

    if (message.guild) {
        trackMessageForDeletion(message, delayMs);
        trackMessageForDeletion(reply, delayMs);
    }

    return reply;
}

function hash(seed) {
    let total = 0;
    for (const char of seed) total += char.charCodeAt(0);
    return total;
}

function getVariant(seed, options) {
    return options[hash(seed) % options.length];
}

function getLoyaltyRank(orderCount) {
    if (orderCount >= 250) return "CEO";
    if (orderCount >= 100) return "Regional Manager";
    if (orderCount >= 50) return "Franchise Owner";
    if (orderCount >= 25) return "VIP Customer";
    if (orderCount >= 10) return "Regular";
    return "Customer";
}

function getNextLoyaltyRank(orderCount) {
    const ranks = [
        { count: 10, name: "Regular" },
        { count: 25, name: "VIP Customer" },
        { count: 50, name: "Franchise Owner" },
        { count: 100, name: "Regional Manager" },
        { count: 250, name: "CEO" }
    ];
    return ranks.find((rank) => orderCount < rank.count);
}

module.exports = {
    formatMoney,
    formatDuration,
    formatReceipt,
    getMostPopularItem,
    isRateLimited,
    replyWithAutoDelete,
    hash,
    getVariant,
    getLoyaltyRank,
    getNextLoyaltyRank
};
