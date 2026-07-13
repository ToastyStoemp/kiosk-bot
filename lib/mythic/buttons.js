// Handles button clicks for the mythic-shop alerts (currently just the
// "Stop alerting me" button on an alert message).
//
// The button's custom_id is `unsub:<subscription key>`. Whoever clicks it is
// unsubscribed from that subscription — the click's user id decides who, so a
// shared channel alert works for everyone it pinged.

const store = require("./store");

const PREFIX = "unsub:";

// Returns true if this interaction was one of ours (and handled).
async function handleButton(interaction) {
    const id = interaction.customId || "";
    if (!id.startsWith(PREFIX)) return false;

    const key = id.slice(PREFIX.length);

    // Grab the label before removing, so the confirmation names what was removed.
    const target = store.listForUser(interaction.user.id).find((s) => s.key === key);
    const removed = store.removeByKey(interaction.user.id, key);

    const content = removed
        ? `🔕 Stopped alerts for **${target ? store.describe(target) : "that item"}**.`
        : "You weren't subscribed to that anymore (already removed?).";

    await interaction.reply({ content, ephemeral: true });
    return true;
}

module.exports = { handleButton };
