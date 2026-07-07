#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  EXAM_RULE,
  buildExamPaper,
  scoreQuestion,
  summarizeExam
} = require("../quiz-core.js");

const root = path.resolve(__dirname, "..");
const text = fs.readFileSync(path.join(root, "data", "questions.js"), "utf8").trim();
const bank = JSON.parse(text.match(/window\.QUESTION_BANK\s*=\s*(.*);$/s)[1]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function countsByType(paper) {
  return paper.reduce((counts, question) => {
    counts[question.type] = (counts[question.type] || 0) + 1;
    return counts;
  }, {});
}

function validatePaper(source) {
  const paper = buildExamPaper(bank.questions, source);
  const counts = countsByType(paper);
  EXAM_RULE.sections.forEach((section) => {
    assert(
      counts[section.type] === section.count,
      `${source} ${section.type} expected ${section.count}, got ${counts[section.type] || 0}`
    );
  });
  assert(paper.length === 85, `${source} expected 85 questions, got ${paper.length}`);
}

validatePaper("高级工");
validatePaper("技师");
validatePaper("技师新增");

const multi = { type: "多选", answer: ["A", "C", "D"] };
assert(scoreQuestion(multi, ["A", "C", "D"]) === 2, "multi exact answer scores 2");
assert(scoreQuestion(multi, ["A", "D"]) === 1, "multi partial correct scores 1");
assert(scoreQuestion(multi, ["A", "B"]) === 0, "multi wrong pick scores 0");
assert(scoreQuestion({ type: "单选", answer: ["A"] }, ["A"]) === 1, "single correct scores 1");
assert(scoreQuestion({ type: "判断", answer: ["正确"] }, ["错误"]) === 0, "judge wrong scores 0");

const summary = summarizeExam(
  [
    { id: "single", type: "单选", answer: ["A"] },
    { id: "multi", type: "多选", answer: ["A", "C", "D"] },
    { id: "judge", type: "判断", answer: ["正确"] }
  ],
  {
    single: ["A"],
    multi: ["A", "C"],
    judge: ["正确"]
  }
);
assert(summary.total === 3, `summary expected 3, got ${summary.total}`);
assert(summary.answered === 3, `summary expected 3 answered, got ${summary.answered}`);

console.log("exam rules ok");
