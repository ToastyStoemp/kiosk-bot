// Fetches the current League of Legends Mythic Shop rotation from the
// community tracker loldb.info.
//
// The page is a server-rendered Next.js app; the live rotation is embedded in
// the React Server Components (RSC) payload as a JSON array under "items".
// We reconstruct that payload, pull out the "items" arrays, and normalize each
// entry to { name, cost, currency, type, category, endTime, imageUrl }.

const URL = "https://loldb.info/mythic-shop";

async function fetchShop() {
    const res = await fetch(URL, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) mcdo-bot-mythic-alerts",
            Accept: "text/html",
        },
    });
    if (!res.ok) throw new Error(`loldb.info returned HTTP ${res.status}`);

    const html = await res.text();
    const items = parseItems(html);
    if (items.length === 0) {
        throw new Error(
            "Parsed 0 items from loldb.info — the page structure may have changed."
        );
    }
    return items.map(normalize);
}

function parseItems(html) {
    const rsc = decodeRscPayload(html);
    const arrays = extractItemsArrays(rsc);
    const seen = new Set();
    const merged = [];
    for (const arr of arrays) {
        for (const it of arr) {
            const key = it.id || `${it.displayName}|${it.endTime}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(it);
        }
    }
    return merged;
}

// Concatenate and unescape all self.__next_f.push([1,"..."]) string chunks.
function decodeRscPayload(html) {
    const re = /self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)/gs;
    let out = "";
    let m;
    while ((m = re.exec(html)) !== null) {
        try {
            out += JSON.parse(`"${m[1]}"`);
        } catch {
            // Skip chunks that aren't valid JSON string escaping.
        }
    }
    return out;
}

function extractItemsArrays(text) {
    const results = [];
    const needle = '"items"';
    let from = 0;
    while (true) {
        const idx = text.indexOf(needle, from);
        if (idx === -1) break;
        const bracket = text.indexOf("[", idx);
        if (bracket === -1) break;
        const end = matchBracket(text, bracket);
        from = idx + needle.length;
        if (end === -1) continue;
        const slice = text.slice(bracket, end + 1);
        try {
            const arr = JSON.parse(slice);
            if (Array.isArray(arr) && arr.some((x) => x && x.displayName)) {
                results.push(arr);
            }
        } catch {
            // Not the array we want (or truncated) — keep scanning.
        }
    }
    return results;
}

// Index of the matching close bracket for the open at openIdx, honoring strings.
function matchBracket(text, openIdx) {
    const open = text[openIdx];
    const close = open === "[" ? "]" : "}";
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = openIdx; i < text.length; i++) {
        const c = text[i];
        if (inStr) {
            if (esc) esc = false;
            else if (c === "\\") esc = true;
            else if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === "[" || c === "{") depth++;
        else if (c === "]" || c === "}") {
            depth--;
            if (depth === 0) return c === close ? i : -1;
        }
    }
    return -1;
}

const CURRENCY_LABELS = {
    lol_mythic_essence: "Mythic Essence",
    RP: "RP",
};

function normalize(it) {
    return {
        name: it.displayName || it.name || "Unknown item",
        cost: typeof it.cost === "number" ? it.cost : null,
        currency: CURRENCY_LABELS[it.currency] || it.currency || null,
        type: it.subType || null,
        category: it.rotationCategory || null,
        endTime: it.endTime && it.endTime !== "$undefined" ? it.endTime : null,
        imageUrl: it.imagePath || null,
    };
}

module.exports = { fetchShop, parseItems };
