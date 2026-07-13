const { buildOrderMessage } = require("./menu");

let _message = null;
let _version = "dev";

function init(version) {
    _version = version;
}

function setMenuMessage(msg) {
    _message = msg;
}

function refreshMenuMessage(totalOrders) {
    if (!_message) return;
    const content = buildOrderMessage(_version, totalOrders);
    if (_message.content === content) return;
    _message.edit(content).then(edited => { _message = edited; }).catch(err => {
        console.error("Could not refresh menu message:", err);
    });
}

// Post a fresh menu message (e.g. after the order channel is purged) and adopt
// it as the tracked menu message.
async function repostMenu(channel, totalOrders) {
    const content = buildOrderMessage(_version, totalOrders);
    const msg = await channel.send(content);
    _message = msg;
    return msg;
}

module.exports = { init, setMenuMessage, refreshMenuMessage, repostMenu };
