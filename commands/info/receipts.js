const { loadData, getUserData } = require("../../lib/data");
const { formatReceipt } = require("../../lib/utils");

module.exports = async function handleReceipts(interaction) {
    const data = loadData();
    const userData = getUserData(data, interaction.user.id);
    const recentReceipts = [...(userData.receipts || [])].slice(-10).reverse();

    await interaction.reply({
        content: recentReceipts.length === 0
            ? "🧾 You do not have any receipts yet."
            : `🧾 **Recent Receipts**\n\n${recentReceipts.map(formatReceipt).join("\n")}`,
        ephemeral: true
    });
};
