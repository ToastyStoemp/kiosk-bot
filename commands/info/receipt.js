const { loadData, getUserData } = require("../../lib/data");
const { formatMoney } = require("../../lib/utils");

module.exports = async function handleReceipt(interaction) {
    const data = loadData();
    const userData = getUserData(data, interaction.user.id);

    const mostOrdered = Object.entries(userData.items).sort((a, b) => b[1] - a[1])[0];
    const hiddenFound = Object.keys(userData.hiddenItems || {}).length;
    const rareTitles = Object.keys(userData.rareTitles || {});

    await interaction.reply({
        content: `🧾 **Receipt**

Orders: **${userData.orders}**
Total Spent: **${formatMoney(userData.totalSpentCents)}**
Most Ordered: **${mostOrdered ? mostOrdered[0] : "Nothing yet"}**
Kitchen Mistakes: **${userData.mistakes}**
Broken McFlurries: **${userData.mcflurryFails}**
Hidden Menu Items Found: **${hiddenFound}**
Rare Titles Found: **${rareTitles.length ? rareTitles.join(", ") : "None"}**`,
        ephemeral: true
    });
};
