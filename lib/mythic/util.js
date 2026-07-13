// Shared helpers for the mythic-shop alert feature.

// Normalize a skin name for comparison: lowercase, strip punctuation/accents,
// collapse whitespace. Used everywhere we compare names so the shop, the
// catalog, and user input all line up.
function norm(s) {
    return String(s ?? "")
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")    // drop combining accents
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")       // punctuation -> space
        .replace(/\s+/g, " ")
        .trim();
}

module.exports = { norm };
