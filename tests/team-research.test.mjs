import assert from "node:assert/strict";
import test from "node:test";

import {
  TEAM_RESEARCH_BENCHMARKS,
  getTeamResearchContractSummary,
  validateTeamResearchContract
} from "../packages/contracts/src/team-research.mjs";
import { createTeamRegistry } from "../packages/domain/src/team-registry.mjs";
import {
  TeamResearchCommandError,
  createTeamResearchRegistry
} from "../packages/domain/src/team-research-registry.mjs";

const fixedNow = () => "2026-08-30T10:00:00.000Z";
const owner = { kind: "project-owner", id: "hero-owner" };
const researcher = { kind: "agent", id: "research-agent" };

function report() {
  return {
    reportVersion: "v1.0",
    summary: "این گزارش روش‌ها، شواهد، مقایسه‌ها و توصیهٔ اجرایی برای بهبود تیم را جمع‌بندی می‌کند.",
    methods: ["مرور منابع حرفه‌ای", "مقایسهٔ گزینه‌ها با معیار مشترک"],
    sourceRefs: ["https://example.com/source-a", "https://example.com/source-b", "hero://research/evidence-001"],
    findings: [
      { findingId: "finding-1", dimension: "quality", observation: "کیفیت با تعریف خروجی و بازبینی مستقل بهتر کنترل می‌شود.", evidence: "سه منبع بر معیار پذیرش و review تأکید دارند.", confidence: 90, benchmarkScore: 88 },
      { findingId: "finding-2", dimension: "speed", observation: "قالب استاندارد زمان شروع و تحویل را کاهش می‌دهد.", evidence: "مقایسهٔ فرایندها نشان می‌دهد کار تکراری حذف می‌شود.", confidence: 84, benchmarkScore: 82 },
      { findingId: "finding-3", dimension: "risk", observation: "گیت تصمیم مالک ریسک تغییر مسیر را آشکار نگه می‌دارد.", evidence: "رویه‌های بررسی‌شده، escalation و تصمیم ثبت‌شده دارند.", confidence: 86, benchmarkScore: 85 }
    ],
    benchmarks: [
      { benchmarkId: "benchmark-1", compared: "روش A و روش B", criteria: ["کیفیت", "سرعت"], winner: "روش A", rationale: "برای این تیم شواهد قابل بازبینی‌تری تولید می‌کند.", score: 87 },
      { benchmarkId: "benchmark-2", compared: "الگوی داخلی و الگوی حرفه‌ای", criteria: ["ریسک", "قابلیت نگهداری"], winner: "الگوی ترکیبی", rationale: "کنترل مالک را با اجرای تکرارپذیر ترکیب می‌کند.", score: 84 }
    ],
    recommendations: [
      { recommendationId: "recommendation-1", type: "principle-proposals", title: "اصل شواهد‌محوری افزوده شود", rationale: "این اصل رفتار تیم را به گزارش و مقایسهٔ قابل ممیزی متصل می‌کند.", tradeoffs: ["نیازمند زمان برای ثبت شواهد"], confidence: 88 }
    ],
    knowledgeEntries: ["قالب مقایسهٔ چندمعیاره برای تصمیم‌های تیمی"],
    principleProposals: ["هر توصیه باید با شاهد، trade-off و معیار موفقیت همراه باشد"],
    trainingUpdates: ["تمرین مقایسهٔ دو روش با شواهد مستقل"]
  };
}

test("team research contract provides one benchmark brief for every team", () => {
  assert.deepEqual(validateTeamResearchContract(), []);
  assert.equal(TEAM_RESEARCH_BENCHMARKS.length, 11);
  assert.equal(getTeamResearchContractSummary().requirements.minimumSources, 3);
});

test("owner can request, review and apply a research report to team knowledge and principles", () => {
  const teamRegistry = createTeamRegistry({ now: fixedNow });
  const researchRegistry = createTeamResearchRegistry({ now: fixedNow, teamRegistry });
  const requested = researchRegistry.request({ teamId: "tahlilgoro", question: "بهترین روش تحلیل و benchmark چیست؟", objective: "بهبود کیفیت تصمیم‌های تحلیلگرو", actor: owner, idempotencyKey: "research-request-1" });
  assert.equal(requested.research.status, "requested");
  const started = researchRegistry.start({ researchId: requested.research.researchId, actor: owner });
  assert.equal(started.research.status, "researching");
  const ready = researchRegistry.submitReport({ researchId: requested.research.researchId, report: report(), actor: researcher });
  assert.equal(ready.research.status, "report-ready");
  const approved = researchRegistry.review({ researchId: requested.research.researchId, decision: "approved", actor: owner, idempotencyKey: "research-review-1" });
  assert.equal(approved.research.status, "applied");
  assert.ok(approved.applied.applied.knowledgeEntries.includes("قالب مقایسهٔ چندمعیاره برای تصمیم‌های تیمی"));
  const team = teamRegistry.get("tahlilgoro");
  assert.ok(team.knowledge.includes("قالب مقایسهٔ چندمعیاره برای تصمیم‌های تیمی"));
  assert.ok(team.principles.includes("هر توصیه باید با شاهد، trade-off و معیار موفقیت همراه باشد"));
  assert.equal(team.knowledgeProvenance[0].sourceVersion, "v1.0");
  assert.deepEqual(team.knowledgeProvenance[0].sourceRefs, report().sourceRefs);
  assert.equal(team.knowledgeProvenance[0].approvedBy, owner.id);
  assert.ok(researchRegistry.events().some(event => event.type === "team.research-applied"));
});

test("research rejects weak evidence and rejected reports do not change the team", () => {
  const teamRegistry = createTeamRegistry({ now: fixedNow });
  const researchRegistry = createTeamResearchRegistry({ now: fixedNow, teamRegistry });
  const requested = researchRegistry.request({ teamId: "mahsulo", actor: owner, idempotencyKey: "research-request-2" });
  assert.throws(
    () => researchRegistry.submitReport({ researchId: requested.research.researchId, actor: researcher, report: { ...report(), sourceRefs: ["hero://one"] } }),
    TeamResearchCommandError
  );
  researchRegistry.start({ researchId: requested.research.researchId, actor: owner });
  researchRegistry.submitReport({ researchId: requested.research.researchId, actor: researcher, report: report() });
  const rejected = researchRegistry.review({ researchId: requested.research.researchId, decision: "rejected", feedback: "این گزارش باید با دامنهٔ دقیق‌تر بازتعریف شود.", actor: owner, idempotencyKey: "research-review-2" });
  assert.equal(rejected.research.status, "rejected");
  assert.equal(teamRegistry.get("mahsulo").knowledge.length, 0);
});
