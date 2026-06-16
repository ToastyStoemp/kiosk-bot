const { PermissionFlagsBits } = require("discord.js");
const { loadData, saveData, getUserData } = require("../../lib/data");
const { formatMoney, formatDuration, isRateLimited, getLoyaltyRank, hash, getVariant } = require("../../lib/utils");
const { getClient } = require("../../lib/cleanup");
const { menu, hiddenMenu, prices } = require("../../lib/menu");
const { getRareTitle, maybeFindLore } = require("../../lib/lore");
const { ORDER_COOLDOWN } = require("../../lib/constants");

function shouldKitchenMakeMistake(user) {
    return hash(user.id + "kitchen-mistake") % 10 === 0;
}

function getMistakeOrder(user, originalItemNumber) {
    const availableNumbers = Object.keys(menu).filter((n) => n !== String(originalItemNumber));
    const replacementNumber = getVariant(user.id + "wrong-order", availableNumbers);
    return menu[replacementNumber](user);
}

function createReceipt(interaction, order, priceCents) {
    return {
        id: `K-${Date.now().toString().slice(-6)}`,
        userId: interaction.user.id,
        username: interaction.user.username,
        item: order.nickname,
        itemKey: order.itemKey,
        priceCents,
        timestamp: Date.now()
    };
}

async function processOrder(interaction, itemNumber, isHidden) {
    const cooldown = interaction.guild ? ORDER_COOLDOWN : ORDER_COOLDOWN / 2;
    const orderLimit = isRateLimited(interaction.user.id, "order", cooldown);

    if (orderLimit.limited) {
        return interaction.reply({
            content: `You are still eating. Order again in **${formatDuration(orderLimit.remainingMs)}**.`,
            ephemeral: true
        });
    }

    const menuItem = isHidden ? hiddenMenu[itemNumber] : menu[itemNumber];

    if (!menuItem) {
        return interaction.reply({ content: "That item is not available.", ephemeral: true });
    }

    if (interaction.guild) {
        const botMember = interaction.guild.members.me;

        if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            return interaction.reply({
                content: "I need the **Manage Nicknames** permission to do that.",
                ephemeral: true
            });
        }
    }

    await interaction.deferReply({ ephemeral: true });

    const data = loadData();
    const userData = getUserData(data, interaction.user.id);

    userData.username = interaction.user.username;
    userData.orders += 1;

    let order = menuItem(interaction.user);
    let kitchenMessage = null;

    if (!isHidden && shouldKitchenMakeMistake(interaction.user)) {
        const originalNickname = order.nickname;
        order = getMistakeOrder(interaction.user, itemNumber);
        userData.mistakes += 1;
        kitchenMessage = `The kitchen made a mistake.\n\nYou ordered: **${originalNickname}**\nYou received: **${order.nickname}**`;
    }

    const loyaltyRank = getLoyaltyRank(userData.orders);
    const priceCents = order.priceCents || prices[order.itemKey] || 0;

    userData.totalSpentCents += priceCents;
    data.global.orders += 1;
    data.global.revenueCents += priceCents;
    data.global.items[order.itemKey] = (data.global.items[order.itemKey] || 0) + 1;

    if (order.itemKey === "Broken McFlurry") userData.mcflurryFails += 1;
    userData.items[order.itemKey] = (userData.items[order.itemKey] || 0) + 1;
    if (order.hidden) userData.hiddenItems[order.itemKey] = true;

    const receipt = createReceipt(interaction, order, priceCents);
    userData.receipts.push(receipt);
    data.global.receipts.push(receipt);

    userData.receipts = userData.receipts.slice(-25);
    data.global.receipts = data.global.receipts.slice(-50);

    const rareTitle = getRareTitle(interaction.user);
    if (rareTitle) userData.rareTitles[rareTitle] = true;

    const lore = maybeFindLore(interaction.user, userData);

    saveData(data);

    let nickname = order.nickname;
    if (order.nickname === "Disappointed Customer") nickname = `Disappointed ${loyaltyRank}`;
    if (rareTitle) nickname = rareTitle;

    let nicknameChanged = false;

    try {
        if (interaction.guild) {
            await interaction.member.setNickname(nickname);
            nicknameChanged = true;
        } else if (process.env.GUILD_ID) {
            try {
                const guild = await getClient().guilds.fetch(process.env.GUILD_ID);
                const member = await guild.members.fetch(interaction.user.id);
                await member.setNickname(nickname);
                nicknameChanged = true;
            } catch {
                // User not in the server or bot lacks permission.
            }
        }
    } catch (error) {
        console.error("Could not change nickname:", error);
    }

    let replyText = nicknameChanged
        ? `Done — your nickname is now **${nickname}**.`
        : `Order placed — join the server to get your nickname changed to **${nickname}**.`;

    replyText += `\n\nItem Cost: **${formatMoney(priceCents)}**\nTotal Spent: **${formatMoney(userData.totalSpentCents)}**\nOrders: **${userData.orders}**\nLoyalty Status: **${loyaltyRank}**`;

    if (order.message) replyText += `\n\n${order.message}`;
    if (kitchenMessage) replyText += `\n\n${kitchenMessage}`;
    if (rareTitle) replyText += `\n\n✨ **Extremely rare title discovered:** ${rareTitle}`;
    if (lore) replyText += `\n\n📼 **Lore discovered:** ${lore}`;

    await interaction.editReply(replyText);
}

async function handleOrder(interaction) {
    const itemNumber = interaction.options.getInteger("item");
    return processOrder(interaction, itemNumber, false);
}

module.exports = handleOrder;
module.exports.processOrder = processOrder;
