require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField
} = require("discord.js");

const DATA_FILE = path.join(__dirname, "data.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const orderMessage = `Ordering your nickname can be done here. Please order from the list below:

1. Big Mac
2. Chicken Nugget
3. Fries
4. Mc Flurry
5. McChicken
6. Happy Meal
7. Apple Pie`;

function defaultUserData() {
  return {
    orders: 0,
    mistakes: 0,
    mcflurryFails: 0,
    items: {},
    hiddenItems: {},
    rareTitles: {},
    lore: {}
  };
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
  }

  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUserData(data, userId) {
  if (!data.users[userId]) {
    data.users[userId] = defaultUserData();
  }

  return data.users[userId];
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

  if (roll === 0) return "Golden Fries";
  if (roll >= 98) return "Waffle Fries";
  if (roll >= 90) return "Curly Fries";

  return `${getVariant(user.id, ["Small", "Medium", "Large"])} Fries`;
}

function getNuggets(user) {
  const count = getVariant(user.id + "nuggets", ["1", "6", "9", "20"]);

  if (count == 1)
    return "Chicken Nugget";

  return `${count} Piece Chicken Nuggets`;
}

function getMcFlurry(user) {
  const roll = hash(user.id + "mcflurry") % 100;

  if (roll < 70) {
    return {
      nickname: "Disappointed Customer",
      itemKey: "Broken McFlurry",
      message: "The McFlurry machine is broken. Classic."
    };
  }

  return {
    nickname: `${getVariant(user.id + "mcflurry-flavor", [
      "Oreo",
      "Smarties",
      "M&M's",
      "Crunchie"
    ])} McFlurry`,
    itemKey: "McFlurry",
    message: null
  };
}

const hiddenMenu = {
  8: () => ({
    nickname: "The McRib",
    itemKey: "The McRib",
    hidden: true,
    message: "You found the secret menu."
  }),

  42: () => ({
    nickname: "The Meaning Meal",
    itemKey: "The Meaning Meal",
    hidden: true,
    message: "You now understand the universe, but not the pricing."
  }),

  69: () => ({
    nickname: "Nice Nuggets",
    itemKey: "Nice Nuggets",
    hidden: true,
    message: "Nice."
  }),

  404: () => ({
    nickname: "Missing Burger",
    itemKey: "Missing Burger",
    hidden: true,
    message: "Burger not found."
  }),

  1337: () => ({
    nickname: "Elite Fries",
    itemKey: "Elite Fries",
    hidden: true,
    message: "You have hacked the kiosk."
  })
};

const menu = {
  1: (user) => ({ nickname: "Big Mac", itemKey: "Big Mac" }),
  2: (user) => ({ nickname: getNuggets(user), itemKey: "Chicken Nuggets" }),
  3: (user) => ({ nickname: getFries(user), itemKey: "Fries" }),
  4: (user) => getMcFlurry(user),
  5: (user) => ({ nickname: "McChicken", itemKey: "McChicken" }),
  6: (user) => ({ nickname: "Happy Meal", itemKey: "Happy Meal" }),
  7: (user) => ({ nickname: "Apple Pie", itemKey: "Apple Pie" })
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

  const undiscovered = loreFragments.filter((fragment) => !userData.lore[fragment]);

  if (undiscovered.length === 0) return null;

  const fragment = getVariant(user.id + userData.orders + "fragment", undiscovered);
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

  const replacementNumber = getVariant(user.id + "wrong-order", availableNumbers);

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

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

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
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();

  if (content === "!loyalty") {
    const data = loadData();
    const userData = getUserData(data, message.author.id);

    const rank = getLoyaltyRank(userData.orders);
    const nextRank = getNextLoyaltyRank(userData.orders);

    let reply = `🍟 **Loyalty Account**

Orders: **${userData.orders}**
Status: **${rank}**`;

    if (nextRank) {
      reply += `

${nextRank.count - userData.orders} orders until **${nextRank.name}**.`;
    } else {
      reply += `

You have reached the highest loyalty tier.`;
    }

    return message.reply(reply);
  }

  if (content === "!receipt") {
    const data = loadData();
    const userData = getUserData(data, message.author.id);

    const mostOrdered = Object.entries(userData.items)
      .sort((a, b) => b[1] - a[1])[0];

    const hiddenFound = Object.keys(userData.hiddenItems).length;
    const rareTitles = Object.keys(userData.rareTitles);

    return message.reply(`🧾 **Receipt**

Orders: **${userData.orders}**
Most Ordered: **${mostOrdered ? mostOrdered[0] : "Nothing yet"}**
Kitchen Mistakes: **${userData.mistakes}**
Broken McFlurries: **${userData.mcflurryFails}**
Hidden Menu Items Found: **${hiddenFound}**
Rare Titles Found: **${rareTitles.length ? rareTitles.join(", ") : "None"}**`);
  }

  if (content === "!lore") {
    const data = loadData();
    const userData = getUserData(data, message.author.id);

    const foundLore = Object.keys(userData.lore);

    if (foundLore.length === 0) {
      return message.reply("📼 You have not discovered any lore yet.");
    }

    return message.reply(`📼 **Recovered Lore**

${foundLore.map((fragment) => `- ${fragment}`).join("\n")}`);
  }

  const parsed = parseOrder(message.content);
  if (!parsed) return;

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

    let reply = `Done — your nickname is now **${nickname}**.

Orders: **${userData.orders}**
Loyalty Status: **${loyaltyRank}**`;

    if (order.message) {
      reply += `

${order.message}`;
    }

    if (kitchenMessage) {
      reply += `

${kitchenMessage}`;
    }

    if (rareTitle) {
      reply += `

✨ **Extremely rare title discovered:** ${rareTitle}`;
    }

    if (lore) {
      reply += `

📼 **Lore discovered:** ${lore}`;
    }

    await message.reply(reply);
  } catch (error) {
    console.error("Could not change nickname:", error);
    await message.reply(
      "I couldn't change your nickname. Make sure my bot role is above your role in the server role list."
    );
  }
});

client.login(process.env.DISCORD_TOKEN);