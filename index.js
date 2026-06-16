require("dotenv").config();

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ActivityType } = require("discord.js");

let version = "dev";
try { version = require("./version.json").version; } catch {}
const cleanup = require("./lib/cleanup");
const { buildOrderMessage } = require("./lib/menu");
const kiosk = require("./lib/kiosk");
const { loadData } = require("./lib/data");

const commandDefs = [
    new SlashCommandBuilder()
        .setName("order")
        .setDescription("Order from the menu and get your nickname changed")
        .addIntegerOption(opt => opt
            .setName("item")
            .setDescription("What would you like?")
            .setRequired(true)
            .addChoices(
                { name: "1. Big Mac",          value: 1 },
                { name: "2. Chicken Nuggets",  value: 2 },
                { name: "3. Fries",            value: 3 },
                { name: "4. McFlurry",         value: 4 },
                { name: "5. McChicken",        value: 5 },
                { name: "6. Happy Meal",       value: 6 },
                { name: "7. Apple Pie",        value: 7 }
            )
        ),

    new SlashCommandBuilder()
        .setName("customorder")
        .setDescription("Place a special request — some items are not on the menu")
        .addStringOption(opt => opt
            .setName("request")
            .setDescription("What would you like?")
            .setRequired(true)
        ),

    new SlashCommandBuilder().setName("receipt").setDescription("View your order summary"),
    new SlashCommandBuilder().setName("receipts").setDescription("View your recent receipt history"),
    new SlashCommandBuilder().setName("kiosk").setDescription("View the server-wide cash register"),
    new SlashCommandBuilder().setName("loyalty").setDescription("View your loyalty progress"),
    new SlashCommandBuilder().setName("lore").setDescription("View discovered lore"),
    new SlashCommandBuilder().setName("leaderboard").setDescription("View the top customers"),
    new SlashCommandBuilder().setName("help").setDescription("View your account and available commands"),

    new SlashCommandBuilder()
        .setName("resetqueue")
        .setDescription("Reset all member nicknames to \"Queuing to order\"")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

].map(cmd => cmd.toJSON());

const commands = {
    order:        require("./commands/order/order"),
    customorder:  require("./commands/order/customorder"),
    receipt:      require("./commands/info/receipt"),
    receipts:     require("./commands/info/receipts"),
    kiosk:        require("./commands/info/kiosk"),
    loyalty:      require("./commands/info/loyalty"),
    lore:         require("./commands/info/lore"),
    leaderboard:  require("./commands/info/leaderboard"),
    help:         require("./commands/info/help"),
    resetqueue:   require("./commands/admin/resetqueue"),
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ]
});

async function ensureMenuMessage(channel) {
    const { global } = loadData();
    const orderMessage = buildOrderMessage(version, global.orders);
    const recentMessages = await channel.messages.fetch({ limit: 50 });

    const existingMenu = recentMessages.find(
        (msg) => msg.author.id === client.user.id && msg.content.includes("🍟 **Kiosk Menu**")
    );

    if (existingMenu) {
        if (existingMenu.content === orderMessage) {
            console.log("Existing kiosk menu found and up to date.");
            return existingMenu;
        }

        console.log("Existing kiosk menu found but outdated. Editing it.");
        return existingMenu.edit(orderMessage);
    }

    console.log("No existing kiosk menu found. Posting a new one.");
    return channel.send(orderMessage);
}

async function registerCommands() {
    const guildId = process.env.GUILD_ID;

    if (!guildId) {
        console.warn("GUILD_ID not set — skipping slash command registration.");
        return;
    }

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, guildId),
            { body: commandDefs }
        );
        console.log("Slash commands registered.");
    } catch (error) {
        console.error("Failed to register slash commands:", error);
    }
}

process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
});

client.once("clientReady", async () => {
    console.log(`Logged in as ${client.user.tag} (v${version})`);

    client.user.setActivity(`v${version}`, { type: ActivityType.Playing });

    kiosk.init(version);
    cleanup.init(client);
    cleanup.scheduleCleanupLoop();
    await registerCommands();

    const channelId = process.env.ORDER_CHANNEL_ID;

    if (channelId) {
        try {
            const channel = await client.channels.fetch(channelId);
            const msg = await ensureMenuMessage(channel);
            kiosk.setMenuMessage(msg);
        } catch (error) {
            console.error("Could not send order message:", error);
        }
    }
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const handler = commands[interaction.commandName];
    if (!handler) return;

    try {
        await handler(interaction);
    } catch (error) {
        console.error(`Handler error for /${interaction.commandName}:`, error);

        const payload = { content: "Something went wrong at the kiosk.", ephemeral: true };

        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(payload);
            } else {
                await interaction.reply(payload);
            }
        } catch {
            // Ignore.
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
