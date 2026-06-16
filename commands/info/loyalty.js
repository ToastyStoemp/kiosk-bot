const { loadData, getUserData } = require("../../lib/data");
const { formatMoney, getLoyaltyRank, getNextLoyaltyRank } = require("../../lib/utils");

module.exports = async function handleLoyalty(interaction) {
    const data = loadData();
    const userData = getUserData(data, interaction.user.id);

    const rank = getLoyaltyRank(userData.orders);
    const nextRank = getNextLoyaltyRank(userData.orders);

    let content = `🍟 **Loyalty Account**

Orders: **${userData.orders}**
Total Spent: **${formatMoney(userData.totalSpentCents)}**
Status: **${rank}**`;

    if (nextRank) {
        content += `\n\n${nextRank.count - userData.orders} orders until **${nextRank.name}**.`;
    } else {
        content += `\n\nYou have reached the highest loyalty tier.`;
    }

    await interaction.reply({ content, ephemeral: true });
};
