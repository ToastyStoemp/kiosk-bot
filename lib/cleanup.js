const { loadData, saveData } = require("./data");

let _client = null;

function init(client) {
    _client = client;
}

function getClient() {
    return _client;
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
        const channel = await _client.channels.fetch(entry.channelId);
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

module.exports = { init, getClient, trackMessageForDeletion, scheduleCleanupLoop };
