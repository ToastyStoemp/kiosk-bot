const skins = require("../../lib/mythic/skins");
const store = require("../../lib/mythic/store");
const alerts = require("../../lib/mythic/alerts");
const { norm } = require("../../lib/mythic/util");

// /chroma champion <champion> — any chroma of that champion
// /chroma skin <skin>         — that specific skin's chroma
module.exports = async function handleChroma(interaction) {
    const which = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });
    await skins.ensureLoaded().catch(() => {});

    if (which === "champion") {
        const query = interaction.options.getString("champion", true);
        const r = skins.isLoaded() ? skins.resolveChampion(query) : { ok: false, suggestions: [] };
        if (!r.ok) {
            const s = r.suggestions?.length
                ? `\n\nDid you mean:\n${r.suggestions.map((x) => `• ${x}`).join("\n")}`
                : "\n\nStart typing and pick a champion from the list.";
            await interaction.editReply(`❌ I couldn't find a champion called **${query}**.${s}`);
            return;
        }
        const sub = { type: "chroma-champion", match: String(r.id), label: r.name };
        const added = store.add(interaction.user.id, sub);

        let liveNote = "";
        try {
            const m = alerts.findMatch(await alerts.getCurrentShop(), sub);
            if (m) liveNote = `\n\n🔥 A **${r.name}** chroma is in the shop right now (${alerts.displayLabel(m)}).`;
        } catch {}

        await interaction.editReply(
            (added
                ? `✅ You'll be pinged when **any ${r.name} chroma** hits the Mythic Shop.`
                : `👍 You're already watching **${r.name}** chromas.`) + liveNote
        );
        return;
    }

    // which === "skin"
    const query = interaction.options.getString("skin", true);
    const r = skins.isLoaded() ? skins.resolve(query) : { ok: true, name: query };
    if (!r.ok) {
        const s = r.suggestions?.length
            ? `\n\nDid you mean:\n${r.suggestions.map((x) => `• ${x}`).join("\n")}`
            : "\n\nStart typing and pick a skin from the list.";
        await interaction.editReply(`❌ I couldn't find a skin called **${query}**.${s}`);
        return;
    }
    const sub = { type: "chroma-skin", match: norm(r.name), label: r.name };
    const added = store.add(interaction.user.id, sub);

    let liveNote = "";
    try {
        const m = alerts.findMatch(await alerts.getCurrentShop(), sub);
        if (m) liveNote = `\n\n🔥 The **${r.name}** chroma is in the shop right now (${alerts.displayLabel(m)}).`;
    } catch {}

    await interaction.editReply(
        (added
            ? `✅ You'll be pinged when the **${r.name}** chroma hits the Mythic Shop.`
            : `👍 You're already watching the **${r.name}** chroma.`) + liveNote
    );
};

module.exports.autocomplete = async function chromaAutocomplete(interaction) {
    await skins.ensureLoaded().catch(() => {});
    const which = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused();

    if (which === "champion") {
        const res = skins.isLoaded() ? skins.searchChampions(focused, 25) : [];
        await interaction.respond(res.map((c) => ({ name: c.name.slice(0, 100), value: c.name.slice(0, 100) })));
    } else {
        const res = skins.isLoaded() ? skins.search(focused, 25) : [];
        await interaction.respond(res.map((e) => ({ name: e.name.slice(0, 100), value: e.name.slice(0, 100) })));
    }
};
