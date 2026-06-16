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

function getRareTitle() {
    const roll = Math.floor(Math.random() * 2000);

    if (roll === 0) return "The Hamburglar";
    if (roll <= 2)  return "The Chosen Nugget";
    if (roll <= 6)  return "Golden Fry Prophet";

    return null;
}

function maybeFindLore(userData) {
    if (Math.floor(Math.random() * 12) !== 0) return null;

    const undiscovered = loreFragments.filter((fragment) => !userData.lore[fragment]);
    if (undiscovered.length === 0) return null;

    const fragment = undiscovered[Math.floor(Math.random() * undiscovered.length)];
    userData.lore[fragment] = true;
    return fragment;
}

module.exports = { loreFragments, getRareTitle, maybeFindLore };
