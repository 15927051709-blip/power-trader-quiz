const bank = require("../../data/questions.js");
const core = require("../../utils/quiz-core.js");

const STORAGE_KEY = "powerTraderMiniStats.v1";
const EXAM_HISTORY_KEY = "powerTraderMiniExamHistory.v1";

Page({
  questions: [],
  stats: null,
  examHistory: [],
  current: null,
  selected: new Set(),
  submitted: false,
  correct: false,
  orderIndex: 0,
  exam: {
    status: "setup",
    paper: [],
    index: 0,
    answers: {},
    marked: [],
    startedAt: null,
    elapsedSeconds: 0,
    result: null
  },
  timer: null,

  data: {
    view: "practice",
    mode: "random",
    filter: "all",
    source: "高级工",
    examSource: "高级工",
    search: "",
    modeOptions: [
      { value: "random", label: "随机" },
      { value: "order", label: "顺序" },
      { value: "wrong", label: "错题" },
      { value: "favorite", label: "收藏" },
      { value: "weak", label: "薄弱" }
    ],
    filterOptions: [
      { value: "all", label: "全部" },
      { value: "单选", label: "单选" },
      { value: "多选", label: "多选" },
      { value: "判断", label: "判断" }
    ],
    sourceOptions: [
      { value: "高级工", label: "高级工" },
      { value: "技师", label: "技师" },
      { value: "技师新增", label: "技师新增" }
    ],
    metaText: "题库加载中",
    statA: 0,
    statALabel: "已答题",
    statB: "0%",
    statBLabel: "正确率",
    statC: 0,
    statCLabel: "错题本",
    sourceLabel: "高级工题库",
    examSourceLabel: "高级工题库",
    currentQuestion: null,
    currentOptions: [],
    currentTypeClass: "",
    practiceEmpty: false,
    emptyText: "",
    practiceProgress: "",
    weakText: "",
    feedbackText: "",
    feedbackClass: "",
    favoriteText: "收藏",
    examStatus: "setup",
    examQuestion: null,
    examOptions: [],
    examDisplayIndex: 1,
    examRemainingText: "120:00",
    examDurationText: "00:00",
    examQuestionScore: 1,
    examMarkText: "标记",
    answerSheet: [],
    examScore: 0,
    examAnswered: 0,
    examBreakdown: [],
    reviewItems: [],
    analysisText: "完成模拟考试后显示平均分、最高分、最低分和薄弱题型。",
    historyText: "还没有模拟考试记录。",
    showActions: true,
    leftText: "跳过",
    rightText: "提交答案",
    leftDisabled: false,
    rightDisabled: true
  },

  onLoad() {
    this.questions = bank.questions || [];
    this.stats = this.loadStats();
    this.examHistory = this.loadExamHistory();
    this.pickQuestion();
  },

  onUnload() {
    this.stopTimer();
  },

  loadStats() {
    const saved = wx.getStorageSync(STORAGE_KEY) || {};
    return {
      answered: Number(saved.answered || 0),
      correct: Number(saved.correct || 0),
      wrongIds: Array.isArray(saved.wrongIds) ? saved.wrongIds : [],
      favoriteIds: Array.isArray(saved.favoriteIds) ? saved.favoriteIds : [],
      history: saved.history && typeof saved.history === "object" ? saved.history : {}
    };
  },

  saveStats() {
    wx.setStorageSync(STORAGE_KEY, this.stats);
  },

  loadExamHistory() {
    const saved = wx.getStorageSync(EXAM_HISTORY_KEY);
    return Array.isArray(saved) ? saved : [];
  },

  saveExamHistory() {
    wx.setStorageSync(EXAM_HISTORY_KEY, this.examHistory.slice(0, 10));
  },

  setView(event) {
    const view = event.currentTarget.dataset.view;
    this.setData({ view });
    if (view === "practice" && !this.current) this.pickQuestion();
    this.render();
  },

  setMode(event) {
    const mode = event.currentTarget.dataset.mode;
    const next = { mode };
    if (mode === "weak") next.filter = "all";
    this.setData(next, () => this.pickQuestion());
  },

  setFilter(event) {
    this.orderIndex = 0;
    this.setData({ filter: event.currentTarget.dataset.filter }, () => this.pickQuestion());
  },

  setSource(event) {
    this.orderIndex = 0;
    this.setData({ source: event.currentTarget.dataset.source }, () => this.pickQuestion());
  },

  setExamSource(event) {
    const source = event.currentTarget.dataset.source;
    const reset = () => {
      this.stopTimer();
      this.exam = {
        status: "setup",
        paper: [],
        index: 0,
        answers: {},
        marked: [],
        startedAt: null,
        elapsedSeconds: 0,
        result: null
      };
      this.setData({ examSource: source, examStatus: "setup" }, () => this.render());
    };

    if (this.exam.status === "active") {
      wx.showModal({
        title: "结束本次考试？",
        content: "当前模拟考试还未交卷，确认重新选择题库？",
        success: (result) => { if (result.confirm) reset(); }
      });
      return;
    }
    reset();
  },

  onSearchInput(event) {
    this.orderIndex = 0;
    this.setData({ search: event.detail.value }, () => this.pickQuestion());
  },

  filteredQuestions() {
    const term = this.data.search.trim();
    const weakType = this.getWeakType();
    return this.questions.filter((question) => {
      const typeOk = this.data.filter === "all" || question.type === this.data.filter;
      const sourceOk = core.matchesSource(question, this.data.source);
      const searchOk = !term || question.stem.includes(term);
      const wrongOk = this.data.mode !== "wrong" || this.stats.wrongIds.includes(question.id);
      const favoriteOk = this.data.mode !== "favorite" || this.stats.favoriteIds.includes(question.id);
      const weakOk = this.data.mode !== "weak" || (weakType && question.type === weakType);
      return typeOk && sourceOk && searchOk && wrongOk && favoriteOk && weakOk;
    });
  },

  pickQuestion() {
    const pool = this.filteredQuestions();
    this.selected = new Set();
    this.submitted = false;
    this.correct = false;
    if (!pool.length) {
      this.current = null;
      this.render();
      return;
    }

    if (this.data.mode === "order") {
      this.orderIndex %= pool.length;
      this.current = pool[this.orderIndex];
      this.orderIndex += 1;
    } else {
      this.current = pool[Math.floor(Math.random() * pool.length)];
    }
    this.render();
  },

  selectOption(event) {
    const label = event.currentTarget.dataset.label;
    if (this.data.view === "exam" && this.exam.status === "active") {
      const question = this.exam.paper[this.exam.index];
      const selected = new Set(this.exam.answers[question.id] || []);
      if (question.type === "多选") {
        selected.has(label) ? selected.delete(label) : selected.add(label);
      } else {
        selected.clear();
        selected.add(label);
      }
      if (selected.size) this.exam.answers[question.id] = Array.from(selected);
      else delete this.exam.answers[question.id];
      this.render();
      return;
    }

    if (!this.current || this.submitted) return;
    if (this.current.type === "多选") {
      this.selected.has(label) ? this.selected.delete(label) : this.selected.add(label);
    } else {
      this.selected = new Set([label]);
    }
    this.render();
  },

  submitPractice() {
    if (!this.current || !this.selected.size || this.submitted) return;
    const correct = core.sameAnswer(Array.from(this.selected), this.current.answer);
    this.submitted = true;
    this.correct = correct;
    this.stats.answered += 1;
    if (correct) this.stats.correct += 1;
    this.stats.history[this.current.id] = {
      selected: Array.from(this.selected),
      correct,
      at: new Date().toISOString()
    };
    const wrongSet = new Set(this.stats.wrongIds);
    correct ? wrongSet.delete(this.current.id) : wrongSet.add(this.current.id);
    this.stats.wrongIds = Array.from(wrongSet);
    this.saveStats();
    this.render();
  },

  resetStats() {
    wx.showModal({
      title: "清空记录？",
      content: "确认清空本机刷题记录、错题本和收藏题？",
      success: (result) => {
        if (!result.confirm) return;
        this.stats = { answered: 0, correct: 0, wrongIds: [], favoriteIds: [], history: {} };
        this.saveStats();
        this.pickQuestion();
      }
    });
  },

  toggleFavorite() {
    if (!this.current) return;
    const favoriteSet = new Set(this.stats.favoriteIds);
    favoriteSet.has(this.current.id) ? favoriteSet.delete(this.current.id) : favoriteSet.add(this.current.id);
    this.stats.favoriteIds = Array.from(favoriteSet);
    this.saveStats();
    this.render();
  },

  startExam() {
    try {
      this.exam.paper = core.buildExamPaper(this.questions, this.data.examSource);
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
      return;
    }
    this.exam.status = "active";
    this.exam.index = 0;
    this.exam.answers = {};
    this.exam.marked = [];
    this.exam.startedAt = Date.now();
    this.exam.elapsedSeconds = 0;
    this.exam.result = null;
    this.startTimer();
    this.render();
  },

  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      if (this.exam.status !== "active" || !this.exam.startedAt) return;
      this.exam.elapsedSeconds = Math.floor((Date.now() - this.exam.startedAt) / 1000);
      if (this.exam.elapsedSeconds >= core.EXAM_RULE.durationSeconds) {
        this.submitExam(true);
        wx.showToast({ title: "时间到，已自动交卷", icon: "none" });
        return;
      }
      this.renderStats();
      this.setData({
        examRemainingText: core.formatDuration(core.EXAM_RULE.durationSeconds - this.exam.elapsedSeconds)
      });
    }, 1000);
  },

  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  },

  goExamQuestion(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.exam.index = Math.max(0, Math.min(index, this.exam.paper.length - 1));
    this.render();
  },

  toggleExamMark() {
    const question = this.exam.paper[this.exam.index];
    const marked = new Set(this.exam.marked);
    marked.has(question.id) ? marked.delete(question.id) : marked.add(question.id);
    this.exam.marked = Array.from(marked);
    this.render();
  },

  submitExam(force = false) {
    const unanswered = this.exam.paper.length - this.countExamAnswered();
    const finish = () => {
      this.stopTimer();
      this.exam.elapsedSeconds = this.exam.startedAt
        ? Math.floor((Date.now() - this.exam.startedAt) / 1000)
        : this.exam.elapsedSeconds;
      const summary = core.summarizeExam(this.exam.paper, this.exam.answers);
      const details = this.exam.paper.map((question, index) => {
        const selected = this.exam.answers[question.id] || [];
        const score = core.scoreQuestion(question, selected);
        const max = this.maxQuestionScore(question);
        return { question, index, selected, score, max };
      });
      this.exam.result = {
        ...summary,
        details,
        source: this.data.examSource,
        duration: this.exam.elapsedSeconds,
        submittedAt: new Date().toISOString()
      };
      this.updateWrongBookFromExam(details);
      this.exam.status = "result";
      this.examHistory.unshift({
        source: this.data.examSource,
        score: summary.total,
        byType: summary.byType,
        duration: this.exam.elapsedSeconds,
        at: this.exam.result.submittedAt
      });
      this.examHistory = this.examHistory.slice(0, 10);
      this.saveExamHistory();
      this.render();
    };

    if (!force && unanswered > 0) {
      wx.showModal({
        title: "确认交卷？",
        content: `还有 ${unanswered} 题未答，确认交卷？`,
        success: (result) => { if (result.confirm) finish(); }
      });
      return;
    }
    finish();
  },

  updateWrongBookFromExam(details) {
    const wrongSet = new Set(this.stats.wrongIds);
    details.forEach((item) => {
      const correct = item.score === item.max;
      this.stats.history[item.question.id] = {
        selected: item.selected,
        correct,
        at: this.exam.result.submittedAt,
        source: "exam"
      };
      correct ? wrongSet.delete(item.question.id) : wrongSet.add(item.question.id);
    });
    this.stats.wrongIds = Array.from(wrongSet);
    this.saveStats();
  },

  countExamAnswered() {
    return this.exam.paper.filter((question) => (this.exam.answers[question.id] || []).length).length;
  },

  maxQuestionScore(question) {
    const rule = core.EXAM_RULE.sections.find((section) => section.type === question.type);
    return rule ? rule.points : 0;
  },

  getWeakType() {
    return core.analyzeExamHistory(this.examHistory).weakType;
  },

  leftAction() {
    if (this.data.view === "exam" && this.exam.status === "active") {
      this.exam.index = Math.max(0, this.exam.index - 1);
      this.render();
      return;
    }
    this.pickQuestion();
  },

  rightAction() {
    if (this.data.view === "exam" && this.exam.status === "active") {
      if (this.exam.index === this.exam.paper.length - 1) this.submitExam();
      else {
        this.exam.index += 1;
        this.render();
      }
      return;
    }
    if (this.submitted) this.pickQuestion();
    else this.submitPractice();
  },

  backToPractice() {
    this.setData({ view: "practice" }, () => this.render());
  },

  answerText(question) {
    if (question.type === "判断") return question.answer.join("");
    return question.answer.map((label) => {
      const option = question.options.find((item) => item.label === label);
      return option ? `${label}. ${option.text}` : label;
    }).join("；");
  },

  selectedAnswerText(question, selected) {
    if (!selected.length) return "未作答";
    if (question.type === "判断") return selected.join("");
    return selected.map((label) => {
      const option = question.options.find((item) => item.label === label);
      return option ? `${label}. ${option.text}` : label;
    }).join("；");
  },

  typeClass(type) {
    if (type === "多选") return "multi";
    if (type === "判断") return "judge";
    return "";
  },

  render() {
    this.renderStats();
    this.renderAnalysis();
    if (this.data.view === "practice") this.renderPractice();
    else this.renderExam();
  },

  renderStats() {
    if (this.data.view === "exam") {
      if (this.exam.status === "active") {
        this.setData({
          metaText: `${core.sourceLabel(this.data.examSource)} · 模拟考试`,
          statA: `${this.countExamAnswered()}/${this.exam.paper.length}`,
          statALabel: "已答题",
          statB: core.formatDuration(core.EXAM_RULE.durationSeconds - this.exam.elapsedSeconds),
          statBLabel: "剩余",
          statC: this.exam.marked.length,
          statCLabel: "标记"
        });
        return;
      }
      if (this.exam.status === "result" && this.exam.result) {
        const deductCount = this.exam.result.details.filter((item) => item.score < item.max).length;
        this.setData({
          metaText: `${core.sourceLabel(this.data.examSource)} · 模拟考试`,
          statA: this.exam.result.total,
          statALabel: "本次得分",
          statB: core.formatDuration(this.exam.result.duration),
          statBLabel: "用时",
          statC: deductCount,
          statCLabel: "扣分题"
        });
        return;
      }
      this.setData({
        metaText: `${core.sourceLabel(this.data.examSource)} · 模拟考试`,
        statA: 85,
        statALabel: "题量",
        statB: 100,
        statBLabel: "满分",
        statC: this.examHistory.length,
        statCLabel: "模考记录"
      });
      return;
    }

    const answered = this.stats.answered;
    const weakType = this.data.mode === "weak" ? this.getWeakType() : "";
    this.setData({
      metaText: weakType
        ? `${core.sourceLabel(this.data.source)} · 薄弱项：${weakType}`
        : `${core.sourceLabel(this.data.source)} · ${this.countBySource(this.data.source)} 道去重题`,
      statA: answered,
      statALabel: "已答题",
      statB: answered ? `${Math.round(this.stats.correct / answered * 100)}%` : "0%",
      statBLabel: "正确率",
      statC: this.data.mode === "favorite" ? this.stats.favoriteIds.length : this.stats.wrongIds.length,
      statCLabel: this.data.mode === "favorite" ? "收藏题" : "错题本"
    });
  },

  countBySource(source) {
    return this.questions.filter((question) => core.matchesSource(question, source)).length;
  },

  renderPractice() {
    if (!this.current) {
      const emptyText = this.data.mode === "weak"
        ? "还没有足够的模拟考试记录判断薄弱项。先完成一套模拟考试后再来练薄弱项。"
        : "当前条件下没有题目。可以切回全部题型，或先完成一些错题/收藏题后再进入对应模式。";
      this.setData({
        practiceEmpty: true,
        emptyText,
        showActions: true,
        leftText: "跳过",
        rightText: "提交答案",
        leftDisabled: false,
        rightDisabled: true
      });
      return;
    }

    const poolCount = this.filteredQuestions().length;
    const currentOptions = this.current.options.map((option) => {
      const selected = this.selected.has(option.label);
      const isRight = this.current.answer.includes(option.label);
      const isWrongPick = this.submitted && selected && !isRight;
      return {
        ...option,
        className: [
          selected ? "selected" : "",
          this.submitted && isRight ? "correct" : "",
          isWrongPick ? "wrong" : ""
        ].filter(Boolean).join(" ")
      };
    });
    const feedbackText = this.submitted
      ? `${this.correct ? "答对了" : "答错了"}\n正确答案：${this.answerText(this.current)}`
      : "";
    const weakType = this.data.mode === "weak" ? this.getWeakType() : "";

    this.setData({
      practiceEmpty: false,
      currentQuestion: this.current,
      currentOptions,
      currentTypeClass: this.typeClass(this.current.type),
      sourceLabel: core.sourceLabel(this.data.source),
      practiceProgress: `${poolCount} 题可练`,
      weakText: weakType ? `薄弱项：${weakType}` : "",
      feedbackText,
      feedbackClass: this.correct ? "good" : "bad",
      favoriteText: this.stats.favoriteIds.includes(this.current.id) ? "取消收藏" : "收藏",
      showActions: true,
      leftText: "跳过",
      rightText: this.submitted ? "下一题" : "提交答案",
      leftDisabled: false,
      rightDisabled: !this.selected.size
    });
  },

  renderExam() {
    if (this.exam.status === "setup") {
      this.setData({
        examStatus: "setup",
        examSourceLabel: core.sourceLabel(this.data.examSource),
        showActions: false
      });
      return;
    }
    if (this.exam.status === "result") {
      this.renderExamResult();
      return;
    }
    this.renderExamQuestion();
  },

  renderExamQuestion() {
    const question = this.exam.paper[this.exam.index];
    const selectedSet = new Set(this.exam.answers[question.id] || []);
    const examOptions = question.options.map((option) => ({
      ...option,
      className: selectedSet.has(option.label) ? "selected" : ""
    }));
    const answerSheet = this.exam.paper.map((item, index) => ({
      index,
      label: index + 1,
      className: [
        index === this.exam.index ? "current" : "",
        (this.exam.answers[item.id] || []).length ? "answered" : "",
        this.exam.marked.includes(item.id) ? "marked" : ""
      ].filter(Boolean).join(" ")
    }));

    this.setData({
      examStatus: "active",
      examSourceLabel: core.sourceLabel(this.data.examSource),
      examQuestion: question,
      examOptions,
      currentTypeClass: this.typeClass(question.type),
      examDisplayIndex: this.exam.index + 1,
      examRemainingText: core.formatDuration(core.EXAM_RULE.durationSeconds - this.exam.elapsedSeconds),
      examQuestionScore: this.maxQuestionScore(question),
      examMarkText: this.exam.marked.includes(question.id) ? "取消标记" : "标记",
      answerSheet,
      showActions: true,
      leftText: "上一题",
      rightText: this.exam.index === this.exam.paper.length - 1 ? "交卷" : "下一题",
      leftDisabled: this.exam.index === 0,
      rightDisabled: false
    });
  },

  renderExamResult() {
    const result = this.exam.result;
    const reviewItems = result.details
      .filter((item) => item.score < item.max)
      .map((item) => ({
        id: item.question.id,
        title: `${item.index + 1}. ${item.question.stem}`,
        selectedText: this.selectedAnswerText(item.question, item.selected),
        answerText: this.answerText(item.question),
        score: item.score,
        max: item.max
      }));
    const examBreakdown = core.EXAM_RULE.sections.map((section) => {
      const item = result.byType[section.type];
      return { type: section.type, score: item.score, max: item.max };
    });

    this.setData({
      examStatus: "result",
      examSourceLabel: core.sourceLabel(result.source),
      examScore: result.total,
      examAnswered: result.answered,
      examDurationText: core.formatDuration(result.duration),
      examBreakdown,
      reviewItems,
      showActions: false
    });
  },

  renderAnalysis() {
    const analysis = core.analyzeExamHistory(this.examHistory);
    const analysisText = analysis.count
      ? `近 ${analysis.count} 次：平均 ${analysis.average} 分，最高 ${analysis.best} 分，最低 ${analysis.worst} 分。薄弱项：${analysis.weakType || "暂无"}。`
      : "完成模拟考试后显示平均分、最高分、最低分和薄弱题型。";
    const historyText = this.examHistory.length
      ? this.examHistory.slice(0, 5).map((item) => {
        const date = new Date(item.at);
        const label = Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
        return `${label} · ${item.source} · ${item.score}分 · ${core.formatDuration(item.duration)}`;
      }).join("\n")
      : "还没有模拟考试记录。";
    this.setData({ analysisText, historyText });
  }
});
