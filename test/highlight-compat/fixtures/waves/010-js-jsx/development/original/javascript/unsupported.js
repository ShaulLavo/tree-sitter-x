/** @param {number} v documentation */
function outer(v) { const local = v; return local; }
const rx = /a[b]+/gu;
const html = htmlTag`<b>${outer(1)}</b>`;
