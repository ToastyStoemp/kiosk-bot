const { loadData, getUserData } = require("../../lib/data");

module.exports = async function handleLore(interaction) {
    const data = loadData();
    const userData = getUserData(data, interaction.user.id);
    const foundLore = Object.keys(userData.lore || {});

    await interaction.reply({
        content: foundLore.length === 0
            ? "📼 You have not discovered any lore yet."
            : `📼 **Recovered Lore**\n\n${foundLore.map((fragment) => `- ${fragment}`).join("\n")}`,
        ephemeral: true
    });
};
