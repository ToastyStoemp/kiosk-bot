const { parseOrder } = require("../../lib/menu");
const { processOrder } = require("./order");

module.exports = async function handleCustomOrder(interaction) {
    const request = interaction.options.getString("request");
    const parsed = parseOrder(request);

    if (!parsed || !parsed.hidden) {
        return interaction.reply({
            content: "That isn't a special order. Use `/order` for regular menu items.",
            ephemeral: true
        });
    }

    return processOrder(interaction, parsed.itemNumber, true);
};
