const store = require("../../lib/mythic/store");

// /myalerts — list all of the caller's Mythic Shop subscriptions.
module.exports = async function handleMyAlerts(interaction) {
    const mine = store.listForUser(interaction.user.id);

    if (mine.length === 0) {
        await interaction.reply({
            content:
                "You have no Mythic Shop alerts yet.\n" +
                "• `/alert <skin>` — a skin\n" +
                "• `/chroma skin <skin>` — a skin's chroma\n" +
                "• `/chroma champion <champion>` — any chroma of a champion",
            ephemeral: true,
        });
        return;
    }

    const skinsList = mine.filter((s) => s.type === "skin");
    const chromaSkin = mine.filter((s) => s.type === "chroma-skin");
    const chromaChamp = mine.filter((s) => s.type === "chroma-champion");

    const sections = [];
    if (skinsList.length) sections.push("**Skins**\n" + skinsList.map((s) => `• ${s.label}`).join("\n"));
    if (chromaSkin.length) sections.push("**Chromas (specific skin)**\n" + chromaSkin.map((s) => `• ${s.label}`).join("\n"));
    if (chromaChamp.length) sections.push("**Chromas (any of champion)**\n" + chromaChamp.map((s) => `• ${s.label}`).join("\n"));

    await interaction.reply({
        content: `🔔 **Your Mythic Shop alerts (${mine.length}):**\n\n` + sections.join("\n\n"),
        ephemeral: true,
    });
};
