const store = require("../../lib/mythic/store");
const { norm } = require("../../lib/mythic/util");

// /unchroma <chroma> — remove one of the caller's chroma subscriptions.
// The autocomplete value is the subscription's composite key.
module.exports = async function handleUnchroma(interaction) {
    const key = interaction.options.getString("chroma", true);
    const removed = store.removeByKey(interaction.user.id, key);

    if (removed) {
        await interaction.reply({ content: "🗑️ Removed that chroma alert.", ephemeral: true });
    } else {
        await interaction.reply({
            content: "That wasn't one of your chroma alerts. Use `/myalerts` to see your list.",
            ephemeral: true,
        });
    }
};

module.exports.autocomplete = async function unchromaAutocomplete(interaction) {
    const focused = norm(interaction.options.getFocused());
    const mine = store
        .listForUser(interaction.user.id)
        .filter((s) => s.type === "chroma-skin" || s.type === "chroma-champion")
        .map((s) => ({ label: store.describe(s), key: s.key }))
        .filter((c) => !focused || norm(c.label).includes(focused))
        .slice(0, 25);
    await interaction.respond(mine.map((c) => ({ name: c.label.slice(0, 100), value: c.key.slice(0, 100) })));
};
