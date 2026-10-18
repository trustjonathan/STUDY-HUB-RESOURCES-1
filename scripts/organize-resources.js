const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const apply = process.argv.includes("--apply");
const verify = process.argv.includes("--verify");
const resourceExtensions = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"]);
const classTokens = [
    ["PrimarySevenClass", "Primary", "P7"],
    ["PrimarySixClass", "Primary", "P6"],
    ["PrimaryFiveClass", "Primary", "P5"],
    ["PrimaryFourClass", "Primary", "P4"],
    ["PrimaryThreeClass", "Primary", "P3"],
    ["PrimaryTwoClass", "Primary", "P2"],
    ["PrimaryOneClass", "Primary", "P1"],
    ["PrimarySeven", "Primary", "P7"],
    ["PrimarySix", "Primary", "P6"],
    ["PrimaryFive", "Primary", "P5"],
    ["PrimaryFour", "Primary", "P4"],
    ["PrimaryThree", "Primary", "P3"],
    ["PrimaryTwo", "Primary", "P2"],
    ["PrimaryOne", "Primary", "P1"],
    ["SeniorSix", "A-Level", "S6"],
    ["SeniorFive", "A-Level", "S5"],
    ["SeniorFour", "O-Level", "S4"],
    ["SeniorThree", "O-Level", "S3"],
    ["SeniorTwo", "O-Level", "S2"],
    ["SeniorOne", "O-Level", "S1"],
    ["BabyClass", "Nursery", "Baby Class"],
    ["MiddleClass", "Nursery", "Middle Class"],
    ["TopClass", "Nursery", "Top Class"],
    ["Baby", "Nursery", "Baby Class"],
    ["Middle", "Nursery", "Middle Class"],
    ["Top", "Nursery", "Top Class"]
];

function normalizeSubject(value, stage) {
    const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || /^(all|general|mixed|class|lessonnotes|pastpapers|schemesofwork|holidaypackages)$/.test(key)) return stage === "Nursery" ? "Learning Areas" : "General";
    if (stage === "Nursery") {
        if (["luganda", "kiswahili", "locallanguage", "languagedevelopmenti"].includes(key)) return "Language Development I";
        if (["english", "englishlanguage", "literacy", "reading", "writing", "languagedevelopmentii"].includes(key)) return "Language Development II";
        if (["language", "languagedevelopment"].includes(key)) return "Language Development";
        if (["math", "maths", "mathematics", "mtc", "numeracy", "numbers", "mathemeticalconcepts"].includes(key)) return "Mathematical Concepts";
        if (["socialdevelopment", "healthhabits", "generalknowledge", "environment"].includes(key)) return "Social Development";
        if (["art", "arts", "music", "pe", "physicaleducation", "performingarts", "artandcraft"].includes(key)) return "Physical & Expressive Arts";
    }
    if (["math", "maths", "mathematics", "mtc", "numeracy", "mathemeticalconcepts"].includes(key)) return "Mathematics";
    if (["sst", "socialstudies"].includes(key)) return "Social Studies";
    if (["cre", "christianreligiouseducation", "theology", "divinity"].includes(key)) return "CRE";
    if (["ire", "islamicreligiouseducation", "religiouseducation", "re"].includes(key)) return key === "ire" || key === "islamicreligiouseducation" ? "IRE" : "Religious Education";
    const aliases = {
        agric: "Agriculture", agriculture: "Agriculture", bio: "Biology", chem: "Chemistry",
        comp: "Computer Studies", computer: "Computer Studies", computerscience: "Computer Studies",
        economics: "Economics", english: "English", englishlanguage: "English", eng: "English", ent: "Entrepreneurship",
        entrepreneurship: "Entrepreneurship", fn: "Nutrition & Food Technology", foodandnutrition: "Nutrition & Food Technology",
        geography: "Geography", geog: "Geography", hist: "History", history: "History",
        ict: "ICT", kiswahili: "Kiswahili", lug: "Luganda", luganda: "Luganda",
        literature: "Literature in English", lit: "Literature in English", lit1: "Literacy", lit2: "Literacy",
        literacy1: "Literacy", literacy2: "Literacy", physics: "Physics", phy: "Physics",
        science: "Science", integratedscience: "Science", technologyanddesign: "Technology & Design",
        td: "Technology & Design", technicaldrawing: "Technical Drawing", art: "Art & Design",
        music: "Music", pe: "Physical Education", agricultureandnutrition: "Agriculture"
    };
    return aliases[key] || value.replace(/([a-z])([A-Z])/g, "$1 $2").trim() || "General";
}

function classFromIndex(stem) {
    const lower = stem.toLowerCase();
    for (const [token, stage, grade] of classTokens) {
        const index = lower.indexOf(token.toLowerCase());
        if (index < 0) continue;
        let subject = stem.slice(0, index) + stem.slice(index + token.length);
        subject = subject.replace(/(all)?(pastpapers|lessonnotes|schemesofwork|holidaypackages)$/i, "");
        subject = subject.replace(/^(all|mixed)/i, "");
        return { stage, grade, subject: normalizeSubject(subject, stage) };
    }
    return null;
}

function classFromFilename(filename) {
    const name = filename.toLowerCase();
    let stage;
    let grade;
    if (/\bbaby\b/.test(name)) [stage, grade] = ["Nursery", "Baby Class"];
    else if (/\bmiddle\b/.test(name)) [stage, grade] = ["Nursery", "Middle Class"];
    else if (/\btop\b/.test(name) && /class/.test(name)) [stage, grade] = ["Nursery", "Top Class"];
    else {
        const primary = name.match(/(?:^|[^a-z0-9])(?:p\.?\s*([1-7])|primary\s*(one|two|three|four|five|six|seven))(?:[^a-z0-9]|$)/);
        const senior = name.match(/(?:^|[^a-z0-9])(?:s\.?\s*([1-6])|senior\s*(one|two|three|four|five|six))(?:[^a-z0-9]|$)/);
        const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
        if (primary) [stage, grade] = ["Primary", `P${primary[1] || words[primary[2]]}`];
        else if (senior) {
            const number = Number(senior[1] || words[senior[2]]);
            [stage, grade] = [number <= 4 ? "O-Level" : "A-Level", `S${number}`];
        }
    }
    if (!stage) return null;
    const subject = filename.replace(/\.[^.]+$/, "").replace(/\b(?:baby|middle|top|primary|senior|p\.?\s*[1-7]|s\.?\s*[1-6]|one|two|three|four|five|six|seven)\b/ig, " ");
    return { stage, grade, subject: normalizeSubject(subject, stage) };
}

function resourceNameFromUrl(value) {
    try {
        return decodeURIComponent(path.posix.basename(new URL(value, "https://local.invalid").pathname));
    } catch {
        return path.posix.basename(value);
    }
}

function encodeRelativePath(value) {
    return value.split("/").map(encodeURIComponent).join("/");
}

function findResources(directory, prefix = "") {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const relative = path.posix.join(prefix, entry.name);
        if (entry.isFile() && resourceExtensions.has(path.extname(entry.name).toLowerCase())) return [relative];
        if (entry.isDirectory()) return findResources(path.join(directory, entry.name), relative);
        return [];
    });
}

const rootFiles = fs.readdirSync(root, { withFileTypes: true });
const resources = [
    ...rootFiles.filter((entry) => entry.isFile() && resourceExtensions.has(path.extname(entry.name).toLowerCase())).map((entry) => entry.name),
    ...findResources(path.join(root, "Resources"), "Resources")
];
const resourceByName = new Map(resources.map((resourcePath) => [path.posix.basename(resourcePath).toLowerCase(), resourcePath]));
const candidates = new Map();
let jsonFiles = 0;

for (const entry of rootFiles.filter((item) => item.isFile() && item.name.endsWith(".json"))) {
    let data;
    try {
        data = JSON.parse(fs.readFileSync(path.join(root, entry.name), "utf8"));
    } catch {
        continue;
    }
    jsonFiles++;
    const classification = classFromIndex(path.basename(entry.name, ".json"));
    if (!classification) continue;
    for (const item of Array.isArray(data) ? data : [data]) {
        if (!item || typeof item.pdfUrl !== "string") continue;
        const resourcePath = resourceByName.get(resourceNameFromUrl(item.pdfUrl).toLowerCase());
        if (!resourcePath) continue;
        const key = `${classification.stage}/${classification.grade}/${classification.subject}`;
        const choices = candidates.get(resourcePath) || new Map();
        const choice = choices.get(key) || { ...classification, count: 0 };
        choice.count++;
        choices.set(key, choice);
        candidates.set(resourcePath, choices);
    }
}

const plan = new Map();
for (const resourcePath of resources) {
    const choices = [...(candidates.get(resourcePath)?.values() || [])];
    choices.sort((left, right) => {
        const leftSpecific = left.subject === "General" ? 0 : 1;
        const rightSpecific = right.subject === "General" ? 0 : 1;
        return rightSpecific - leftSpecific || right.count - left.count || `${left.stage}/${left.grade}/${left.subject}`.localeCompare(`${right.stage}/${right.grade}/${right.subject}`);
    });
    const classification = choices[0] || classFromFilename(path.posix.basename(resourcePath));
    const location = classification
        ? `Resources/${classification.stage}/${classification.grade}/${classification.subject}`
        : "Resources/Unsorted/General";
    plan.set(resourcePath, `${location}/${path.posix.basename(resourcePath)}`);
}

if (verify) {
    let checked = 0;
    let missing = 0;
    for (const entry of rootFiles.filter((item) => item.isFile() && item.name.endsWith(".json"))) {
        let data;
        try { data = JSON.parse(fs.readFileSync(path.join(root, entry.name), "utf8")); } catch { continue; }
        for (const item of Array.isArray(data) ? data : [data]) {
            if (!item || typeof item.pdfUrl !== "string" || !item.pdfUrl.startsWith("Resources/")) continue;
            checked++;
            const relative = item.pdfUrl.split("/").map((part) => decodeURIComponent(part)).join("/");
            if (!fs.existsSync(path.join(root, relative))) missing++;
        }
    }
    let htmlChecked = 0;
    let htmlMissing = 0;
    for (const entry of rootFiles.filter((item) => item.isFile() && item.name.endsWith(".html"))) {
        const html = fs.readFileSync(path.join(root, entry.name), "utf8");
        for (const match of html.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)) {
            if (!match[2].startsWith("Resources/")) continue;
            htmlChecked++;
            const relative = match[2].split("/").map((part) => decodeURIComponent(part)).join("/");
            if (!fs.existsSync(path.join(root, relative))) htmlMissing++;
        }
    }
    console.log(`Checked ${checked} JSON and ${htmlChecked} HTML resource links; missing files: ${missing + htmlMissing}.`);
    process.exitCode = missing + htmlMissing ? 1 : 0;
} else if (!apply) {
    const folderCounts = new Map();
    let indexed = 0;
    let inferred = 0;
    let unsorted = 0;
    for (const [resourcePath, destination] of plan) {
        const folder = path.posix.dirname(destination);
        folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
        if (candidates.has(resourcePath)) indexed++;
        else if (folder === "Resources/Unsorted/General") unsorted++;
        else inferred++;
    }
    console.log(`Dry run: ${resources.length} document files; ${indexed} classified by index; ${inferred} inferred from filenames; ${unsorted} unsorted.`);
    console.log(`${jsonFiles} JSON files parsed. Top destination folders:`);
    for (const [folder, count] of [...folderCounts].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${count}\t${folder}`);
    console.log("Run with --apply to move resources and update JSON links.");
} else {
    for (const [resourcePath, destination] of plan) {
        const target = path.join(root, destination);
        if (path.resolve(root, resourcePath) === target) continue;
        if (fs.existsSync(target)) throw new Error(`Destination already exists: ${destination}`);
    }
    for (const [resourcePath, destination] of plan) {
        const target = path.join(root, destination);
        if (path.resolve(root, resourcePath) === target) continue;
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.renameSync(path.join(root, resourcePath), target);
    }
    let updated = 0;
    for (const entry of rootFiles.filter((item) => item.isFile() && item.name.endsWith(".json"))) {
        const file = path.join(root, entry.name);
        let data;
        try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
        let changed = false;
        for (const item of Array.isArray(data) ? data : [data]) {
            if (!item || typeof item.pdfUrl !== "string") continue;
            const resourcePath = resourceByName.get(resourceNameFromUrl(item.pdfUrl).toLowerCase());
            const destination = resourcePath && plan.get(resourcePath);
            if (!destination) continue;
            const localUrl = encodeRelativePath(destination);
            if (item.pdfUrl !== localUrl) {
                item.pdfUrl = localUrl;
                changed = true;
            }
        }
        if (changed) {
            fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
            updated++;
        }
    }
    let htmlUpdated = 0;
    for (const entry of rootFiles.filter((item) => item.isFile() && item.name.endsWith(".html"))) {
        const file = path.join(root, entry.name);
        const original = fs.readFileSync(file, "utf8");
        const revised = original.replace(/(\bhref\s*=\s*)(["'])(.*?)\2/gi, (match, prefix, quote, value) => {
            if (!/\.(pdf|docx?|xlsx?|pptx?)(?:[?#].*)?$/i.test(value)) return match;
            const resourcePath = resourceByName.get(resourceNameFromUrl(value).toLowerCase());
            const destination = resourcePath && plan.get(resourcePath);
            return destination ? `${prefix}${quote}${encodeRelativePath(destination)}${quote}` : match;
        });
        if (revised !== original) {
            fs.writeFileSync(file, revised);
            htmlUpdated++;
        }
    }
    console.log(`Processed ${resources.length} document files; updated ${updated} JSON indexes and ${htmlUpdated} HTML pages.`);
}