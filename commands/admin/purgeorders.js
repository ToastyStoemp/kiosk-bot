const { PermissionFlagsBits } = require("discord.js");
const { loadData } = require("../../lib/data");
const kiosk = require("../../lib/kiosk");

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// /purgeorders — bulk-delete recent messages in the order channel, then re-post
// the kiosk menu. Restricted to members with Manage Messages.
module.exports = async function handlePurgeOrders(interaction) {
    if (!interaction.guild) {
        return interaction.reply({ content: "This command only works in the server.", ephemeral: true });
    }

    const channelId = process.env.ORDER_CHANNEL_ID;
    let channel = null;
    try {
        channel = channelId
            ? await interaction.client.channels.fetch(channelId)
            : interaction.channel;
    } catch {
        channel = null;
    }

    if (!channel || typeof channel.bulkDelete !== "function" || !channel.guild) {
        return interaction.reply({
            content: "I couldn't find a text order channel to purge. Check `ORDER_CHANNEL_ID`.",
            ephemeral: true,
        });
    }

    const me = interaction.guild.members.me;
    const perms = channel.permissionsFor(me);
    if (!perms || !perms.has(PermissionFlagsBits.ManageMessages) || !perms.has(PermissionFlagsBits.ReadMessageHistory)) {
        return interaction.reply({
            content: `I need **Manage Messages** and **Read Message History** in <#${channel.id}>.`,
            ephemeral: true,
        });
    }

    await interaction.deferReply({ ephemeral: true });

    const amount = interaction.options.getInteger("amount"); // null = clear recent
    let deleted = 0;
    let tooOld = false;

    // Delete one batch (a fetched Collection). Discord's bulk endpoint needs
    // 2–100 messages and rejects anything older than 14 days, so we filter
    // ourselves and delete a lone message individually.
    async function deleteBatch(msgs) {
        const now = Date.now();
        const fresh = msgs.filter((m) => now - m.createdTimestamp < TWO_WEEKS_MS && m.deletable);
        if (fresh.size < msgs.size) tooOld = true;
        if (fresh.size === 0) return 0;
        if (fresh.size === 1) {
            await fresh.first().delete();
            return 1;
        }
        const res = await channel.bulkDelete(fresh, true);
        return res.size;
    }

    try {
        if (amount) {
            const msgs = await channel.messages.fetch({ limit: amount });
            deleted += await deleteBatch(msgs);
        } else {
            // Clear recent messages in batches, with a safety cap (~2000).
            for (let i = 0; i < 20; i++) {
                const msgs = await channel.messages.fetch({ limit: 100 });
                if (msgs.size === 0) break;
                const n = await deleteBatch(msgs);
                deleted += n;
                if (n === 0) break; // remaining messages are too old to bulk-delete
            }
        }
    } catch (error) {
        console.error("Purge failed:", error);
        return interaction.editReply(`Purge failed: ${error.message}`);
    }

    // Put the kiosk menu back so ordering still works.
    let menuNote = "";
    if (channelId && channel.id === channelId) {
        try {
            const data = loadData();
            await kiosk.repostMenu(channel, data.global.orders);
            menuNote = "\nRe-posted the kiosk menu.";
        } catch (e) {
            console.error("Could not re-post menu after purge:", e.message);
            menuNote = "\n(Couldn't re-post the kiosk menu — restart the bot or check permissions.)";
        }
    }

    await interaction.editReply(
        `🧹 Purged **${deleted}** message(s) from <#${channel.id}>.` +
        (tooOld ? "\nMessages older than 14 days can't be bulk-deleted by Discord." : "") +
        menuNote
    );
};
