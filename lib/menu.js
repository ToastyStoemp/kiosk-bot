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

function buildOrderMessage(version, totalOrders = 0) {
    return `🍟 **Kiosk Menu** — v${version} | ${totalOrders} orders served

Use **/order** to change your nickname. Choose from the list, or try **/customorder** if you're feeling adventurous.

1. Big Mac
2. Chicken Nuggets
3. Fries
4. McFlurry
5. McChicken
6. Happy Meal
7. Apple Pie

(Some say the menu is longer than it appears.)

/order — Place your order
/customorder — Request something special
/receipt — Your order summary
/receipts — Recent receipt history
/kiosk — Server-wide stats
/loyalty — Your loyalty progress
/lore — Discovered lore
/leaderboard — Top customers
/help — Help and account info`;
}

function pick(options) {
    return options[Math.floor(Math.random() * options.length)];
}

function getFries() {
    const roll = Math.random() * 100;

    if (roll < 1)  return { nickname: "Golden Fries", priceCents: 999 };
    if (roll < 3)  return { nickname: "Waffle Fries",  priceCents: 499 };
    if (roll < 11) return { nickname: "Curly Fries",   priceCents: 449 };

    const size = pick(["Small", "Medium", "Large"]);
    const sizePrices = { Small: 199, Medium: 299, Large: 399 };

    return { nickname: `${size} Fries`, priceCents: sizePrices[size] };
}

function getNuggets() {
    const count = pick(["1", "6", "9", "20"]);
    const nuggetPrices = { "1": 49, "6": 449, "9": 599, "20": 999 };

    return {
        nickname: count === "1" ? "Chicken Nugget" : `${count} Piece Chicken Nuggets`,
        priceCents: nuggetPrices[count]
    };
}

function getMcFlurry() {
    if (Math.random() < 0.7) {
        return {
            nickname: "Disappointed Customer",
            itemKey: "Broken McFlurry",
            priceCents: 349,
            message: "The McFlurry machine is broken. Classic. You were still charged."
        };
    }

    const flavour = pick(["Oreo", "Smarties", "M&M's", "Crunchie"]);
    const flavourPrices = { Oreo: 349, Smarties: 399, "M&M's": 449, Crunchie: 499 };

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
    1: () => ({ nickname: "Big Mac", itemKey: "Big Mac", priceCents: prices["Big Mac"] }),

    2: () => {
        const nuggets = getNuggets();
        return { nickname: nuggets.nickname, itemKey: "Chicken Nuggets", priceCents: nuggets.priceCents };
    },

    3: () => {
        const fries = getFries();
        return { nickname: fries.nickname, itemKey: "Fries", priceCents: fries.priceCents };
    },

    4: () => getMcFlurry(),

    5: () => ({ nickname: "McChicken", itemKey: "McChicken", priceCents: prices["McChicken"] }),

    6: () => ({ nickname: "Happy Meal", itemKey: "Happy Meal", priceCents: prices["Happy Meal"] }),

    7: () => ({ nickname: "Apple Pie", itemKey: "Apple Pie", priceCents: prices["Apple Pie"] })
};

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

module.exports = { prices, buildOrderMessage, menu, hiddenMenu, parseOrder };
