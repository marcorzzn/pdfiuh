const { performance } = require('perf_hooks');

const numPages = 500;
const wordsPerPage = 500;
const words = ["hello", "world", "performance", "optimization", "pdfiuh", "search", "match", "string", "lower", "case", "the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog"];

const pageTexts = new Map();
const pageTextsLower = new Map();

function getRandomWord() {
    return words[Math.floor(Math.random() * words.length)];
}

console.log(`Generating mock data: ${numPages} pages, ${wordsPerPage} words/page...`);
for (let i = 1; i <= numPages; i++) {
    let textArr = [];
    for (let w = 0; w < wordsPerPage; w++) {
        textArr.push(getRandomWord() + (Math.random() > 0.8 ? "PDFiuh" : ""));
    }
    const text = textArr.join(" ");
    pageTexts.set(i, text);
    pageTextsLower.set(i, text.toLowerCase());
}
console.log(`Mock data generated.`);

function performSearchOld(query) {
    const lower = query.toLowerCase();
    let matches = [];

    for (const [page, text] of pageTexts) {
        let idx = 0;
        const textLower = text.toLowerCase();
        while ((idx = textLower.indexOf(lower, idx)) !== -1) {
            matches.push({
                page,
                text: text.substring(idx, idx + query.length),
                charOffset: idx,
                length: query.length,
            });
            idx += query.length;
        }
    }
    return matches;
}

function performSearchNew(query) {
    const lower = query.toLowerCase();
    let matches = [];

    for (const [page, text] of pageTexts) {
        let idx = 0;
        const textLower = pageTextsLower.get(page);
        while ((idx = textLower.indexOf(lower, idx)) !== -1) {
            matches.push({
                page,
                text: text.substring(idx, idx + query.length),
                charOffset: idx,
                length: query.length,
            });
            idx += query.length;
        }
    }
    return matches;
}

const queries = ["hello", "performance", "xyz", "the", "pdfiuh"];
const iterations = 500; // Simulating typings

console.log(`Simulating ${iterations} searches for each of ${queries.length} queries.`);

// Measure Old
let startOld = performance.now();
let oldMatches = 0;
for (let i = 0; i < iterations; i++) {
    for (const q of queries) {
        oldMatches += performSearchOld(q).length;
    }
}
let endOld = performance.now();
const timeOld = endOld - startOld;

// Measure New
let startNew = performance.now();
let newMatches = 0;
for (let i = 0; i < iterations; i++) {
    for (const q of queries) {
        newMatches += performSearchNew(q).length;
    }
}
let endNew = performance.now();
const timeNew = endNew - startNew;

console.log(`Old Implementation: ${timeOld.toFixed(2)} ms (Matches: ${oldMatches})`);
console.log(`New Implementation: ${timeNew.toFixed(2)} ms (Matches: ${newMatches})`);
console.log(`Improvement: ${((timeOld - timeNew) / timeOld * 100).toFixed(2)}% faster`);
