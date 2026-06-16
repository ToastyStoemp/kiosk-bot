const { loadData } = require("../../lib/data");
const { formatMoney, getMostPopularItem, formatReceipt } = require("../../lib/utils");

module.exports = async function handleKiosk(interaction) {
    const data = loadData();
    const global = data.global;
    const mostPopular = getMostPopularItem(global.items);
    const recentReceipts = [...(global.receipts || [])].slice(-5).reverse();

    await interaction.reply({
        content: `🏪 **Server-Wide Cash Register**

Total Orders: **${global.orders}**
Total Revenue: **${formatMoney(global.revenueCents)}**
Most Popular Item: **${mostPopular ? `${mostPopular[0]} (${mostPopular[1]})` : "Nothing yet"}**

Recent Receipts:
${recentReceipts.length ? recentReceipts.map(formatReceipt).join("\n") : "None yet"}`,
        ephemeral: true
    });
};
