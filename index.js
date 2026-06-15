require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

function getVariant(seed, options) {
  let hash = 0;

  for (const char of seed) {
    hash += char.charCodeAt(0);
  }

  return options[hash % options.length];
}

const menu = {
  1: () => "Big Mac",
  2: (user) => `${getVariant(user.id, ["6", "9", "20"])} Chicken Nuggets`,
  3: (user) => `${getVariant(user.id, ["Small", "Medium", "Large"])} Fries`,
  4: (user) => `${getVariant(user.id, ["Oreo", "Smarties", "M&M's"])} McFlurry`,
  5: () => "McChicken",
  6: () => "Happy Meal",
  7: () => "Apple Pie"
};

const orderMessage = `Ordering your nickname can be done here. Please order from the list below:
**Can I have a number [Number], please** - Can be used to place your order:

1. Big Mac
2. Chicken Nugget
3. Fries
4. Mc Flurry
5. McChicken
6. Happy Meal
7. Apple Pie`;

client.once("ready", async () => {
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

  const match = message.content.match(/^can i have a number (\d+), please$/i);
  if (!match) return;

  const itemNumber = match[1];
  const menuItem = menu[itemNumber];

  if (!menuItem) {
    return message.reply("That number is not on the menu.");
  }

  const nickname = menuItem(message.author);

  const botMember = message.guild.members.me;

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
    return message.reply("I need the **Manage Nicknames** permission to do that.");
  }

  try {
    await message.member.setNickname(nickname);
    await message.reply(`Done — your nickname is now **${nickname}**.`);
  } catch (error) {
    console.error("Could not change nickname:", error);
    await message.reply(
      "I couldn't change your nickname. Make sure my bot role is above your role in the server role list."
    );
  }
});

client.login(process.env.DISCORD_TOKEN);