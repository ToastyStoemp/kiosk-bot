const store = require("../../lib/mythic/store");
const { norm } = require("../../lib/mythic/util");

// /unalert <skin> — remove one of the caller's subscriptions.
module.exports = async function handleUnalert(interaction) {
    const query = interaction.options.getString("skin", true);
    const removed = store.unsubscribe(interaction.user.id, query);

    if (removed) {
        await interaction.reply({ content: `🗑️ Removed your alert for **${query}**.`, ephemeral: true });
    } else {
        await interaction.reply({
            content: `You weren't subscribed to **${query}**. Use \`/myalerts\` to see your list.`,
            ephemeral: true,
        });
    }
};

// Autocomplete from the caller's own subscriptions only.
module.exports.autocomplete = async function unalertAutocomplete(interaction) {
    const focused = norm(interaction.options.getFocused());
    const mine = store.listForUser(interaction.user.id);
    const matches = (focused ? mine.filter((n) => norm(n).includes(focused)) : mine).slice(0, 25);
    await interaction.respond(
        matches.map((n) => ({ name: n.slice(0, 100), value: n.slice(0, 100) }))
    );
};
