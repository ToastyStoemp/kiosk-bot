const skins = require("../../lib/mythic/skins");
const store = require("../../lib/mythic/store");
const alerts = require("../../lib/mythic/alerts");
const { norm } = require("../../lib/mythic/util");

// /alert <skin> — subscribe the caller to a skin, validating it exists.
module.exports = async function handleAlert(interaction) {
    const query = interaction.options.getString("skin", true);

    await interaction.deferReply({ ephemeral: true });

    await skins.ensureLoaded().catch(() => {});
    const resolved = skins.isLoaded() ? skins.resolve(query) : { ok: true, name: query };

    if (!resolved.ok) {
        const suggestions = resolved.suggestions?.length
            ? `\n\nDid you mean:\n${resolved.suggestions.map((s) => `• ${s}`).join("\n")}`
            : "\n\nStart typing and pick a skin from the autocomplete list.";
        await interaction.editReply(`❌ I couldn't find a skin called **${query}**.${suggestions}`);
        return;
    }

    const name = resolved.name;
    const sub = { type: "skin", match: norm(name), label: name };
    const added = store.add(interaction.user.id, sub);

    let liveNote = "";
    try {
        const shopItems = await alerts.getCurrentShop();
        if (alerts.findMatch(shopItems, sub)) {
            liveNote = `\n\n🔥 Heads up — **${name}** is in the Mythic Shop **right now**!`;
        }
    } catch {
        // Live check is best-effort.
    }

    await interaction.editReply(
        (added
            ? `✅ You'll be pinged when **${name}** hits the Mythic Shop.`
            : `👍 You're already subscribed to **${name}**.`) + liveNote
    );
};

// Autocomplete: search the skin catalog as the user types.
module.exports.autocomplete = async function alertAutocomplete(interaction) {
    await skins.ensureLoaded().catch(() => {});
    const focused = interaction.options.getFocused();
    const results = skins.isLoaded() ? skins.search(focused, 25) : [];
    await interaction.respond(
        results.map((e) => ({ name: e.name.slice(0, 100), value: e.name.slice(0, 100) }))
    );
};
