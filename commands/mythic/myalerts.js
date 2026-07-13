const store = require("../../lib/mythic/store");

// /myalerts — list the caller's skin subscriptions.
module.exports = async function handleMyAlerts(interaction) {
    const mine = store.listForUser(interaction.user.id);

    if (mine.length === 0) {
        await interaction.reply({
            content: "You have no skin alerts yet. Use `/alert <skin>` to add one.",
            ephemeral: true,
        });
        return;
    }

    const list = mine.map((n) => `• ${n}`).join("\n");
    await interaction.reply({
        content: `🔔 **Your Mythic Shop alerts (${mine.length}):**\n${list}`,
        ephemeral: true,
    });
};
