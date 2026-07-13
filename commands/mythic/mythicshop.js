const alerts = require("../../lib/mythic/alerts");

const SECTION_ORDER = ["FEATURED", "BIWEEKLY", "WEEKLY", "DAILY"];
const SECTION_LABEL = {
    FEATURED: "⭐ Featured",
    BIWEEKLY: "🗓️ Bi-weekly",
    WEEKLY: "📅 Weekly",
    DAILY: "🌙 Daily",
};

// /mythicshop — show the skins currently in the Mythic Shop.
module.exports = async function handleMythicShop(interaction) {
    await interaction.deferReply({ ephemeral: true });

    let items;
    try {
        items = await alerts.getCurrentShop();
    } catch (err) {
        await interaction.editReply(`Couldn't reach the Mythic Shop data right now (${err.message}).`);
        return;
    }

    // Focus on skins — that's what /alert targets.
    const skins = items.filter((it) => it.type === "skin");
    const bySection = new Map();
    for (const it of skins) {
        const key = it.category || "OTHER";
        if (!bySection.has(key)) bySection.set(key, []);
        bySection.get(key).push(it);
    }

    const sections = [...SECTION_ORDER, ...[...bySection.keys()].filter((k) => !SECTION_ORDER.includes(k))];
    const fields = [];
    for (const sec of sections) {
        const list = bySection.get(sec);
        if (!list || !list.length) continue;
        let value = list
            .map((it) => `• ${it.name}${it.cost != null ? ` — ${it.cost} ${it.currency || ""}`.trimEnd() : ""}`)
            .join("\n");
        if (value.length > 1024) value = value.slice(0, 1000) + "\n…";
        fields.push({ name: SECTION_LABEL[sec] || sec, value });
    }

    const otherCount = items.length - skins.length;
    await interaction.editReply({
        embeds: [
            {
                title: "🛒 Current Mythic Shop — Skins",
                color: 0x9b59d0,
                fields: fields.length ? fields : [{ name: "​", value: "No skins in the shop right now." }],
                footer: {
                    text:
                        `${skins.length} skin(s)` +
                        (otherCount > 0 ? ` · +${otherCount} chromas/emotes/icons` : "") +
                        " · data: loldb.info",
                },
            },
        ],
    });
};
