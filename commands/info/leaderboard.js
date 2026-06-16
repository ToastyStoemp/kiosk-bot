const { loadData } = require("../../lib/data");
const { formatMoney, getLoyaltyRank } = require("../../lib/utils");

const MEDALS = ["🥇", "🥈", "🥉"];

module.exports = async function handleLeaderboard(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const data = loadData();

    const entries = Object.entries(data.users)
        .filter(([, u]) => u.orders > 0)
        .sort(([, a], [, b]) => b.orders - a.orders)
        .slice(0, 10);

    if (entries.length === 0) {
        return interaction.editReply("🏆 No orders have been placed yet.");
    }

    const lines = await Promise.all(
        entries.map(async ([userId, userData], index) => {
            let displayName = userData.username || `User ${userId}`;

            if (interaction.guild) {
                try {
                    const member = await interaction.guild.members.fetch(userId);
                    displayName = member.displayName;
                } catch {
                    // Member left or unavailable — fall back to stored username.
                }
            }

            const rank = getLoyaltyRank(userData.orders);
            const medal = MEDALS[index] ?? `${index + 1}.`;

            return `${medal} **${displayName}** — ${userData.orders} orders — ${formatMoney(userData.totalSpentCents)} — ${rank}`;
        })
    );

    await interaction.editReply(`🏆 **Top Customers**\n\n${lines.join("\n")}`);
};
