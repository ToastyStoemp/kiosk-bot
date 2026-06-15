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
**Can I have a number [Number], please** - Can be used to place your order:

1. Big Mac
2. Chicken Nugget
3. Fries
4. Mc Flurry
5. McChicken
6. Happy Meal
7. Apple Pie`;

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
  }

  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function hash(seed) {
  let total = 0;

  for (const char of seed) {
    total += char.charCodeAt(0);
  }

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
  const count = getVariant(user.id + "nuggets", ["6", "9", "20"]);
  return `${count} Piece Chicken Nuggets`;
}

function getMcFlurry(user) {
  const roll = hash(user.id + "mcflurry") % 100;

  if (roll < 70) {
    return {
      nickname: "Disappointed Customer",
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
    message: null
  };
}

const menu = {
  1: (user) => ({ nickname: "Big Mac" }),
  2: (user) => ({ nickname: getNuggets(user) }),
  3: (user) => ({ nickname: getFries(user) }),
  4: (user) => getMcFlurry(user),
  5: (user) => ({ nickname: "McChicken" }),
  6: (user) => ({ nickname: "Happy Meal" }),
  7: (user) => ({ nickname: "Apple Pie" })
};

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

  if (message.content.toLowerCase() === "!loyalty") {
    const data = loadData();
    const userData = data.users[message.author.id] || { orders: 0 };

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

  const match = message.content.match(/^can i have a number (\d+), please$/i);
  if (!match) return;

  const itemNumber = match[1];
  const menuItem = menu[itemNumber];

  if (!menuItem) {
    return message.reply("That number is not on the menu.");
  }

  const data = loadData();

  if (!data.users[message.author.id]) {
    data.users[message.author.id] = { orders: 0 };
  }

  data.users[message.author.id].orders += 1;
  saveData(data);

  let order = menuItem(message.author);
  let kitchenMessage = null;

  if (shouldKitchenMakeMistake(message.author)) {
    const originalNickname = order.nickname;
    order = getMistakeOrder(message.author, itemNumber);

    kitchenMessage = `The kitchen made a mistake.

You ordered: **${originalNickname}**
You received: **${order.nickname}**`;
  }

  const orderCount = data.users[message.author.id].orders;
  const loyaltyRank = getLoyaltyRank(orderCount);

  const nickname = `${order.nickname} | ${loyaltyRank}`;

  const botMember = message.guild.members.me;

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
    return message.reply("I need the **Manage Nicknames** permission to do that.");
  }

  try {
    await message.member.setNickname(nickname);

    let reply = `Done — your nickname is now **${nickname}**.

Orders: **${orderCount}**
Loyalty Status: **${loyaltyRank}**`;

    if (order.message) {
      reply += `

${order.message}`;
    }

    if (kitchenMessage) {
      reply += `

${kitchenMessage}`;
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