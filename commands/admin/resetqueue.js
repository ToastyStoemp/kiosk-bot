const { PermissionFlagsBits } = require("discord.js");

module.exports = async function handleResetQueue(interaction) {
    if (!interaction.guild) {
        return interaction.reply({ content: "This command only works in the server.", ephemeral: true });
    }

    const botMember = interaction.guild.members.me;

    if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        return interaction.reply({ content: "I need **Manage Nicknames** to do that.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    let changed = 0;
    let failed = 0;
    let skippedBots = 0;
    let skippedAlreadyQueued = 0;

    const members = await interaction.guild.members.fetch();

    for (const [, member] of members) {
        if (member.user.bot) {
            skippedBots++;
            continue;
        }

        if (member.nickname === "Queuing to order") {
            skippedAlreadyQueued++;
            continue;
        }

        if (!member.manageable) {
            failed++;
            continue;
        }

        try {
            await member.setNickname("Queuing to order");
            changed++;
        } catch (error) {
            failed++;
            console.error(`Failed to reset ${member.user.tag}:`, error.message);
        }
    }

    await interaction.editReply(
        `Done. Reset **${changed}** members. Failed: **${failed}**. Already queued: **${skippedAlreadyQueued}**. Skipped bots: **${skippedBots}**.`
    );
};
