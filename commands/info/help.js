const { loadData, getUserData } = require("../../lib/data");
const { formatMoney, getLoyaltyRank } = require("../../lib/utils");
const { loreFragments } = require("../../lib/lore");
const { prices } = require("../../lib/menu");

module.exports = async function handleHelp(interaction) {
    const data = loadData();
    const userData = getUserData(data, interaction.user.id);

    const loyaltyRank = getLoyaltyRank(userData.orders);
    const hiddenFound = Object.keys(userData.hiddenItems || {}).length;
    const loreFound = Object.keys(userData.lore || {}).length;
    const rareTitles = Object.keys(userData.rareTitles || {});

    await interaction.reply({
        content: `🍟 Kiosk Help

━━━━━━━━━━━━━━━
YOUR ACCOUNT
━━━━━━━━━━━━━━━

Orders: ${userData.orders}
Total Spent: ${formatMoney(userData.totalSpentCents)}
Loyalty Status: ${loyaltyRank}
Hidden Items Found: ${hiddenFound}
Lore Discovered: ${loreFound}/${loreFragments.length}

Rare Titles:
${rareTitles.length ? rareTitles.join(", ") : "None"}

━━━━━━━━━━━━━━━
MENU
━━━━━━━━━━━━━━━

1. Big Mac — ${formatMoney(prices["Big Mac"])}
2. Chicken Nuggets — $0.49 / $4.49 / $5.99 / $9.99
3. Fries — $1.99 / $2.99 / $3.99 / rare variants extra
4. McFlurry — $3.49 / $3.99 / $4.49 / $4.99
5. McChicken — ${formatMoney(prices["McChicken"])}
6. Happy Meal — ${formatMoney(prices["Happy Meal"])}
7. Apple Pie — ${formatMoney(prices["Apple Pie"])}

━━━━━━━━━━━━━━━
COMMANDS
━━━━━━━━━━━━━━━

/order — Place your order
/customorder — Request something special
/receipt — Your order summary
/receipts — Recent receipt history
/kiosk — Server-wide stats
/loyalty — Your loyalty progress
/lore — Discovered lore
/leaderboard — Top customers
/help — This menu

━━━━━━━━━━━━━━━
MYTHIC SHOP ALERTS
━━━━━━━━━━━━━━━

/alert — Get pinged when a skin hits the Mythic Shop
/unalert — Stop alerts for a skin
/chroma champion — Any chroma of a champion
/chroma skin — A specific skin's chroma
/unchroma — Stop a chroma alert
/myalerts — List everything you're watching
/mythicshop — See what's in the shop right now`,
        ephemeral: true
    });
};
