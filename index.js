require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  Partials
} = require("discord.js");

const DATA_FILE = path.join(__dirname, "data.json");

const ONE_HOUR = 60 * 60 * 1000;
const THREE_MINUTES = 3 * 60 * 1000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const prices = {
  "Big Mac": 599,
  "Chicken Nuggets": 449,
  "Fries": 299,
  "McFlurry": 349,
  "Broken McFlurry": 349,
  "McChicken": 399,
  "Happy Meal": 499,
  "Apple Pie": 199,
  "The McRib": 699,
  "The Meaning Meal": 420,
  "Nice Nuggets": 690,
  "Missing Burger": 404,
  "Elite Fries": 1337
};

const orderMessage = `🍟 **Kiosk Menu**

Ordering your nickname can be done here. You can order from the list below:

1. Big Mac
2. Chicken Nuggets
3. Fries
4. McFlurry
5. McChicken
6. Happy Meal
7. Apple Pie

Commands:
!help
!receipt
!loyalty
!lore

Commands also work in DMs. Ordering only works in the server.`;

function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function defaultUserData() {
  return {
    orders: 0,
    mistakes: 0,
    mcflurryFails: 0,
    totalSpentCents: 0,
    items: {},
    hiddenItems: {},
    rareTitles: {},
    lore: {}
  };
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ users: {}, cleanup: [] }, null, 2)
    );
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

  if (!data.users) data.users = {};
  if (!data.cleanup) data.cleanup = [];

  return data;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUserData(data, userId) {
  if (!data.users[userId]) {
    data.users[userId] = defaultUserData();
  }

  const defaults = defaultUserData();

  data.users[userId] = {
    ...defaults,
    ...data.users[userId],
    items: data.users[userId].items || {},
    hiddenItems: data.users[userId].hiddenItems || {},
    rareTitles: data.users[userId].rareTitles || {},
    lore: data.users[userId].lore || {},
    totalSpentCents: data.users[userId].totalSpentCents || 0
  };

  return data.users[userId];
}

function trackMessageForDeletion(message, delayMs) {
  if (!message || !message.guild) return;

  const data = loadData();

  data.cleanup.push({
    channelId: message.channel.id,
    messageId: message.id,
    deleteAt: Date.now() + delayMs
  });

  saveData(data);
}

async function deleteTrackedMessage(entry) {
  try {
    const channel = await client.channels.fetch(entry.channelId);
    const msg = await channel.messages.fetch(entry.messageId);
    await msg.delete();
  } catch {
    // Already deleted, missing permissions, or unavailable.
  }
}

async function processCleanupQueue() {
  const data = loadData();
  const now = Date.now();
  const remaining = [];

  for (const entry of data.cleanup) {
    if (entry.deleteAt <= now) {
      await deleteTrackedMessage(entry);
    } else {
      remaining.push(entry);
    }
  }

  data.cleanup = remaining;
  saveData(data);
}

function scheduleCleanupLoop() {
  processCleanupQueue();
  setInterval(processCleanupQueue, 60 * 1000);
}

function hash(seed) {
  let total = 0;
  for (const char of seed) total += char.charCodeAt(0);
  return total;
}

function getVariant(seed, options) {
  return options[hash(seed) % options.length];
}

function getLoyaltyRank(orderCount) {
  if (orderCount >= 250) return "CEO";
  if (orderCount >= 100) return "Regional Manager";
  if (orderCount >= 50) return "Franchise Owner";
  if (orderCount >= 25) return "VIP Customer";
  if (orderCount >= 10) return "Regular";
  return "Customer";
}

function getNextLoyaltyRank(orderCount) {
  const ranks = [
    { count: 10, name: "Regular" },
    { count: 25, name: "VIP Customer" },
    { count: 50, name: "Franchise Owner" },
    { count: 100, name: "Regional Manager" },
    { count: 250, name: "CEO" }
  ];

  return ranks.find((rank) => orderCount < rank.count);
}

function getFries(user) {
  const roll = hash(user.id + "fries") % 100;

  if (roll === 0) return { nickname: "Golden Fries", priceCents: 999 };
  if (roll >= 98) return { nickname: "Waffle Fries", priceCents: 499 };
  if (roll >= 90) return { nickname: "Curly Fries", priceCents: 449 };

  const size = getVariant(user.id, ["Small", "Medium", "Large"]);

  const sizePrices = {
    Small: 199,
    Medium: 299,
    Large: 399
  };

  return {
    nickname: `${size} Fries`,
    priceCents: sizePrices[size]
  };
}

function getNuggets(user) {
  const count = getVariant(user.id + "nuggets", ["1", "6", "9", "20"]);

  const nuggetPrices = {
    "1": 49,
    "6": 449,
    "9": 599,
    "20": 999
  };

  return {
    nickname:
      count === "1" ? "Chicken Nugget" : `${count} Piece Chicken Nuggets`,
    priceCents: nuggetPrices[count]
  };
}

function getMcFlurry(user) {
  const roll = hash(user.id + "mcflurry") % 100;

  if (roll < 70) {
    return {
      nickname: "Disappointed Customer",
      itemKey: "Broken McFlurry",
      priceCents: 349,
      message: "The McFlurry machine is broken. Classic. You were still charged."
    };
  }

  const flavour = getVariant(user.id + "mcflurry-flavor", [
    "Oreo",
    "Smarties",
    "M&M's",
    "Crunchie"
  ]);

  const flavourPrices = {
    Oreo: 349,
    Smarties: 399,
    "M&M's": 449,
    Crunchie: 499
  };

  return {
    nickname: `${flavour} McFlurry`,
    itemKey: "McFlurry",
    priceCents: flavourPrices[flavour],
    message: null
  };
}

const hiddenMenu = {
  8: () => ({
    nickname: "The McRib",
    itemKey: "The McRib",
    priceCents: prices["The McRib"],
    hidden: true,
    message: "You found the secret menu."
  }),

  42: () => ({
    nickname: "The Meaning Meal",
    itemKey: "The Meaning Meal",
    priceCents: prices["The Meaning Meal"],
    hidden: true,
    message: "You now understand the universe, but not the pricing."
  }),

  69: () => ({
    nickname: "Nice Nuggets",
    itemKey: "Nice Nuggets",
    priceCents: prices["Nice Nuggets"],
    hidden: true,
    message: "Nice."
  }),

  404: () => ({
    nickname: "Missing Burger",
    itemKey: "Missing Burger",
    priceCents: prices["Missing Burger"],
    hidden: true,
    message: "Burger not found."
  }),

  1337: () => ({
    nickname: "Elite Fries",
    itemKey: "Elite Fries",
    priceCents: prices["Elite Fries"],
    hidden: true,
    message: "You have hacked the kiosk."
  })
};

const menu = {
  1: () => ({
    nickname: "Big Mac",
    itemKey: "Big Mac",
    priceCents: prices["Big Mac"]
  }),

  2: (user) => {
    const nuggets = getNuggets(user);
    return {
      nickname: nuggets.nickname,
      itemKey: "Chicken Nuggets",
      priceCents: nuggets.priceCents
    };
  },

  3: (user) => {
    const fries = getFries(user);
    return {
      nickname: fries.nickname,
      itemKey: "Fries",
      priceCents: fries.priceCents
    };
  },

  4: (user) => getMcFlurry(user),

  5: () => ({
    nickname: "McChicken",
    itemKey: "McChicken",
    priceCents: prices["McChicken"]
  }),

  6: () => ({
    nickname: "Happy Meal",
    itemKey: "Happy Meal",
    priceCents: prices["Happy Meal"]
  }),

  7: () => ({
    nickname: "Apple Pie",
    itemKey: "Apple Pie",
    priceCents: prices["Apple Pie"]
  })
};

const loreFragments = [
  "Note #1: The freezer has been humming since 1997.",
  "Note #2: Someone keeps resetting the McFlurry machine at 3:17 AM.",
  "Note #3: The fries remember.",
  "Note #4: A receipt was found with no order, only the words: DO NOT SUPER SIZE.",
  "Note #5: The clown is not an employee.",
  "Note #6: The drive-thru speaker sometimes answers before anyone speaks.",
  "Note #7: The ice cream mix is delivered by an unmarked van.",
  "Note #8: The Hamburglar was never caught. He was promoted.",
  "Note #9: Under the counter is a button labeled MCEMERGENCY.",
  "Note #10: The final menu item is not food."
];

function getRareTitle(user) {
  const roll = hash(user.id + "rare-title") % 2000;

  if (roll === 0) return "The Hamburglar";
  if (roll <= 2) return "The Chosen Nugget";
  if (roll <= 6) return "Golden Fry Prophet";

  return null;
}

function maybeFindLore(user, userData) {
  const roll = hash(user.id + userData.orders + "lore") % 12;
  if (roll !== 0) return null;

  const undiscovered = loreFragments.filter(
    (fragment) => !userData.lore[fragment]
  );

  if (undiscovered.length === 0) return null;

  const fragment = getVariant(
    user.id + userData.orders + "fragment",
    undiscovered
  );

  userData.lore[fragment] = true;
  return fragment;
}

function shouldKitchenMakeMistake(user) {
  return hash(user.id + "kitchen-mistake") % 10 === 0;
}

function getMistakeOrder(user, originalItemNumber) {
  const availableNumbers = Object.keys(menu).filter(
    (number) => number !== originalItemNumber
  );

  const replacementNumber = getVariant(
    user.id + "wrong-order",
    availableNumbers
  );

  return menu[replacementNumber](user);
}

function parseOrder(content) {
  const text = content.toLowerCase();

  const hiddenNumber = text.match(/\b(1337|404|69|42|8)\b/);
  if (hiddenNumber) return { itemNumber: hiddenNumber[1], hidden: true };

  if (text.includes("mcrib")) return { itemNumber: "8", hidden: true };
  if (text.includes("meaning meal")) return { itemNumber: "42", hidden: true };
  if (text.includes("nice nuggets")) return { itemNumber: "69", hidden: true };
  if (text.includes("missing burger")) return { itemNumber: "404", hidden: true };
  if (text.includes("elite fries")) return { itemNumber: "1337", hidden: true };

  const numberMatch = text.match(/\b([1-7])\b/);
  if (numberMatch) return { itemNumber: numberMatch[1], hidden: false };

  if (text.includes("big mac")) return { itemNumber: "1", hidden: false };
  if (text.includes("nugget")) return { itemNumber: "2", hidden: false };
  if (text.includes("fries") || text.includes("fry")) return { itemNumber: "3", hidden: false };
  if (text.includes("mcflurry") || text.includes("mc flurry") || text.includes("flurry")) return { itemNumber: "4", hidden: false };
  if (text.includes("mcchicken") || text.includes("mc chicken")) return { itemNumber: "5", hidden: false };
  if (text.includes("happy meal")) return { itemNumber: "6", hidden: false };
  if (text.includes("apple pie") || text.includes("pie")) return { itemNumber: "7", hidden: false };

  return null;
}

async function sendHelp(message) {
  const data = loadData();
  const userData = getUserData(data, message.author.id);

  const loyaltyRank = getLoyaltyRank(userData.orders);
  const hiddenFound = Object.keys(userData.hiddenItems || {}).length;
  const loreFound = Object.keys(userData.lore || {}).length;
  const rareTitles = Object.keys(userData.rareTitles || {});

  await message.author.send(`🍟 Kiosk Help

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

!receipt - View your order history

!loyalty - View your loyalty progress

!lore - View discovered lore

!help - Show this help menu`);
}

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  scheduleCleanupLoop();

  const channelId = process.env.ORDER_CHANNEL_ID;

  if (channelId) {
    try {
      const channel = await client.channels.fetch(channelId);
      await channel.send(orderMessage);
    } catch (error) {
      console.error("Could not send order message:", error);
    }
  }
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();

    if (content === "!help") {
      try {
        await sendHelp(message);

        if (message.guild) {
          const reply = await message.reply("📬 I've sent you a DM.");
          trackMessageForDeletion(message, THREE_MINUTES);
          trackMessageForDeletion(reply, THREE_MINUTES);
        }
      } catch (err) {
        console.error("Could not send help DM:", err);
        const reply = await message.reply("I couldn't DM you.");
        trackMessageForDeletion(message, THREE_MINUTES);
        trackMessageForDeletion(reply, THREE_MINUTES);
      }

      return;
    }

    if (content === "!loyalty") {
      const data = loadData();
      const userData = getUserData(data, message.author.id);

      const rank = getLoyaltyRank(userData.orders);
      const nextRank = getNextLoyaltyRank(userData.orders);

      let replyText = `🍟 **Loyalty Account**

Orders: **${userData.orders}**
Total Spent: **${formatMoney(userData.totalSpentCents)}**
Status: **${rank}**`;

      if (nextRank) {
        replyText += `

${nextRank.count - userData.orders} orders until **${nextRank.name}**.`;
      } else {
        replyText += `

You have reached the highest loyalty tier.`;
      }

      const reply = await message.reply(replyText);
      trackMessageForDeletion(message, THREE_MINUTES);
      trackMessageForDeletion(reply, THREE_MINUTES);
      return;
    }

    if (content === "!receipt") {
      const data = loadData();
      const userData = getUserData(data, message.author.id);

      const mostOrdered = Object.entries(userData.items)
        .sort((a, b) => b[1] - a[1])[0];

      const hiddenFound = Object.keys(userData.hiddenItems || {}).length;
      const rareTitles = Object.keys(userData.rareTitles || {});

      const reply = await message.reply(`🧾 **Receipt**

Orders: **${userData.orders}**
Total Spent: **${formatMoney(userData.totalSpentCents)}**
Most Ordered: **${mostOrdered ? mostOrdered[0] : "Nothing yet"}**
Kitchen Mistakes: **${userData.mistakes}**
Broken McFlurries: **${userData.mcflurryFails}**
Hidden Menu Items Found: **${hiddenFound}**
Rare Titles Found: **${rareTitles.length ? rareTitles.join(", ") : "None"}**`);

      trackMessageForDeletion(message, THREE_MINUTES);
      trackMessageForDeletion(reply, THREE_MINUTES);
      return;
    }

    if (content === "!lore") {
      const data = loadData();
      const userData = getUserData(data, message.author.id);

      const foundLore = Object.keys(userData.lore || {});

      const reply = await message.reply(
        foundLore.length === 0
          ? "📼 You have not discovered any lore yet."
          : `📼 **Recovered Lore**

${foundLore.map((fragment) => `- ${fragment}`).join("\n")}`
      );

      trackMessageForDeletion(message, THREE_MINUTES);
      trackMessageForDeletion(reply, THREE_MINUTES);
      return;
    }

    const parsed = parseOrder(message.content);
    if (!parsed) return;

    if (!message.guild) {
      return message.reply(
        "Ordering only works in the server, because I need to change your server nickname."
      );
    }

    const itemNumber = parsed.itemNumber;
    const menuItem = parsed.hidden ? hiddenMenu[itemNumber] : menu[itemNumber];

    if (!menuItem) return message.reply("That number is not on the menu.");

    const botMember = message.guild.members.me;

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
      return message.reply("I need the **Manage Nicknames** permission to do that.");
    }

    const data = loadData();
    const userData = getUserData(data, message.author.id);

    userData.orders += 1;

    let order = menuItem(message.author);
    let kitchenMessage = null;

    if (!parsed.hidden && shouldKitchenMakeMistake(message.author)) {
      const originalNickname = order.nickname;
      order = getMistakeOrder(message.author, itemNumber);

      userData.mistakes += 1;

      kitchenMessage = `The kitchen made a mistake.

You ordered: **${originalNickname}**
You received: **${order.nickname}**`;
    }

    const loyaltyRank = getLoyaltyRank(userData.orders);
    const priceCents = order.priceCents || prices[order.itemKey] || 0;

    userData.totalSpentCents += priceCents;

    if (order.itemKey === "Broken McFlurry") {
      userData.mcflurryFails += 1;
    }

    userData.items[order.itemKey] = (userData.items[order.itemKey] || 0) + 1;

    if (order.hidden) {
      userData.hiddenItems[order.itemKey] = true;
    }

    const rareTitle = getRareTitle(message.author);
    if (rareTitle) {
      userData.rareTitles[rareTitle] = true;
    }

    const lore = maybeFindLore(message.author, userData);

    saveData(data);

    let nickname = order.nickname;

    if (order.nickname === "Disappointed Customer") {
      nickname = `Disappointed ${loyaltyRank}`;
    }

    if (rareTitle) {
      nickname = rareTitle;
    }

    try {
      await message.member.setNickname(nickname);

      let replyText = `Done — your nickname is now **${nickname}**.

Item Cost: **${formatMoney(priceCents)}**
Total Spent: **${formatMoney(userData.totalSpentCents)}**
Orders: **${userData.orders}**
Loyalty Status: **${loyaltyRank}**`;

      if (order.message) {
        replyText += `

${order.message}`;
      }

      if (kitchenMessage) {
        replyText += `

${kitchenMessage}`;
      }

      if (rareTitle) {
        replyText += `

✨ **Extremely rare title discovered:** ${rareTitle}`;
      }

      if (lore) {
        replyText += `

📼 **Lore discovered:** ${lore}`;
      }

      const reply = await message.reply(replyText);

      trackMessageForDeletion(message, ONE_HOUR);
      trackMessageForDeletion(reply, ONE_HOUR);
    } catch (error) {
      console.error("Could not change nickname:", error);

      const reply = await message.reply(
        "I couldn't change your nickname. Make sure my bot role is above your role in the server role list."
      );

      trackMessageForDeletion(message, ONE_HOUR);
      trackMessageForDeletion(reply, ONE_HOUR);
    }
  } catch (error) {
    console.error("Message handler error:", error);

    try {
      const reply = await message.reply("Something went wrong at the kiosk.");
      trackMessageForDeletion(message, ONE_HOUR);
      trackMessageForDeletion(reply, ONE_HOUR);
    } catch {
      // Ignore reply failures.
    }
  }
});

client.login(process.env.DISCORD_TOKEN);