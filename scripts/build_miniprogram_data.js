#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "data", "questions.js");
const coreSource = path.join(root, "quiz-core.js");
const outputDir = path.join(root, "miniprogram", "data");
const coreOutputDir = path.join(root, "miniprogram", "utils");
const output = path.join(outputDir, "questions.js");
const coreOutput = path.join(coreOutputDir, "quiz-core.js");

const text = fs.readFileSync(source, "utf8").trim();
const match = text.match(/window\.QUESTION_BANK\s*=\s*(.*);$/s);
if (!match) {
  throw new Error("data/questions.js does not contain window.QUESTION_BANK");
}

const bank = JSON.parse(match[1]);
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(coreOutputDir, { recursive: true });
fs.writeFileSync(
  output,
  "module.exports = "
    + JSON.stringify(bank, null, 0)
    + ";\n",
  "utf8"
);
fs.copyFileSync(coreSource, coreOutput);

console.log(`Wrote ${output}`);
console.log(`Synced ${coreOutput}`);
console.log(`Questions: ${bank.questions.length}`);
