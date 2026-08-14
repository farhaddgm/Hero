import { FAKE_AGENT_SCENARIOS } from "../../../packages/contracts/src/fake-agent.mjs";
import { getDashboardContractSummary } from "../../../packages/contracts/src/dashboard.mjs";
import { createFakeOrchestrationHarness } from "../../../packages/domain/src/fake-agent.mjs";

const SENSITIVE_INPUT = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]{12,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|credential)\s*[:=])/i;

function copy(value) {
  return structuredClone(value);
}

function assertText(label, value, { minimum = 0, maximum = 1000, required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new DashboardCommandError("INVALID_INPUT", `${label} الزامی است.`);
    return "";
  }
  if (typeof value !== "string") throw new DashboardCommandError("INVALID_INPUT", `${label} باید متن باشد.`);
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new DashboardCommandError("INVALID_INPUT", `${label} باید بین ${minimum} تا ${maximum} نویسه باشد.`);
  }
  if (SENSITIVE_INPUT.test(normalized)) {
    throw new DashboardCommandError("SENSITIVE_INPUT_REJECTED", "اطلاعات حساس را در درخواست وارد نکنید.");
  }
  return normalized;
}

function assertScenario(value) {
  const scenario = value ?? "success";
  if (!FAKE_AGENT_SCENARIOS.includes(scenario)) {
    throw new DashboardCommandError("INVALID_SCENARIO", "سناریوی Fake Agent معتبر نیست.");
  }
  return scenario;
}

function timestamp(now) {
  const value = now();
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error("Dashboard clock must return an ISO timestamp.");
  }
  return value;
}

function buildPlan(scenario) {
  const scenarioLabel = Object.freeze({
    success: "موفقیت کامل",
    "review-changes": "بازبینی و درخواست اصلاح",
    "failure-then-retry": "شکست و تلاش مجدد",
    "pause-resume": "توقف امن و ادامه"
  });
  return Object.freeze([
    Object.freeze({ order: 1, title: "تحلیل درخواست", state: "آماده" }),
    Object.freeze({ order: 2, title: `اجرای Fake Agent: ${scenarioLabel[scenario]}`, state: "نیازمند مجوز" }),
    Object.freeze({ order: 3, title: "تست، checkpoint و بازبینی", state: "در انتظار" }),
    Object.freeze({ order: 4, title: "تأیید نهایی و تحویل نتیجه", state: "در انتظار" })
  ]);
}

function publicRequest(request) {
  return Object.freeze(copy(request));
}

export class DashboardCommandError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DashboardCommandError";
    this.code = code;
  }
}

export function createControlDashboard(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const requests = new Map();
  let sequence = 0;
  let fullAutonomy = options.fullAutonomy === true;
  let globalStop = false;

  function getRequest(requestId) {
    const request = requests.get(requestId);
    if (!request) throw new DashboardCommandError("REQUEST_NOT_FOUND", "درخواست پیدا نشد.");
    return request;
  }

  function snapshot() {
    return Object.freeze({
      contract: getDashboardContractSummary(),
      fullAutonomy,
      globalStop,
      providerMode: "Fake Agent only",
      requests: [...requests.values()]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(publicRequest)
    });
  }

  function createRequest(input) {
    const title = assertText("عنوان", input?.title, { minimum: 3, maximum: 120, required: true });
    const description = assertText("شرح", input?.description, { maximum: 1000 });
    const scenario = assertScenario(input?.scenario);
    sequence += 1;
    const createdAt = timestamp(now);
    const request = {
      requestId: `REQ-${String(sequence).padStart(3, "0")}`,
      title,
      description,
      scenario,
      status: globalStop ? "متوقف" : fullAutonomy ? "آماده اجرا" : "نیازمند تأیید",
      plan: buildPlan(scenario),
      createdAt,
      updatedAt: createdAt,
      approvedAt: fullAutonomy && !globalStop ? createdAt : null,
      rejectedAt: null,
      stoppedAt: globalStop ? createdAt : null,
      result: null
    };
    requests.set(request.requestId, request);
    return publicRequest(request);
  }

  function approveRequest(requestId) {
    if (globalStop) throw new DashboardCommandError("GLOBAL_STOP_ACTIVE", "توقف اضطراری فعال است؛ اجرای جدید مجاز نیست.");
    const request = getRequest(requestId);
    if (!["نیازمند تأیید", "متوقف"].includes(request.status)) {
      throw new DashboardCommandError("REQUEST_NOT_APPROVABLE", "این درخواست در وضعیت قابل تأیید نیست.");
    }
    request.status = "آماده اجرا";
    request.approvedAt = timestamp(now);
    request.updatedAt = request.approvedAt;
    request.stoppedAt = null;
    return publicRequest(request);
  }

  function rejectRequest(requestId) {
    const request = getRequest(requestId);
    if (["تکمیل", "رد شد"].includes(request.status)) {
      throw new DashboardCommandError("REQUEST_NOT_REJECTABLE", "این درخواست دیگر قابل رد نیست.");
    }
    request.status = "رد شد";
    request.rejectedAt = timestamp(now);
    request.updatedAt = request.rejectedAt;
    return publicRequest(request);
  }

  function stopRequest(requestId) {
    const request = getRequest(requestId);
    if (!["نیازمند تأیید", "آماده اجرا"].includes(request.status)) {
      throw new DashboardCommandError("REQUEST_NOT_STOPPABLE", "فقط درخواست اجرا نشده را می‌توان متوقف کرد.");
    }
    request.status = "متوقف";
    request.stoppedAt = timestamp(now);
    request.updatedAt = request.stoppedAt;
    return publicRequest(request);
  }

  function runFakeAgent(requestId) {
    if (globalStop) throw new DashboardCommandError("GLOBAL_STOP_ACTIVE", "توقف اضطراری فعال است؛ اجرای جدید مجاز نیست.");
    const request = getRequest(requestId);
    if (request.status !== "آماده اجرا") {
      throw new DashboardCommandError("REQUEST_NOT_READY", "پیش از اجرای Fake Agent، درخواست باید تأیید شود.");
    }
    request.status = "در حال اجرا";
    request.updatedAt = timestamp(now);
    const result = createFakeOrchestrationHarness({ now }).run({
      runId: `RUN-UI-${request.requestId}`,
      taskId: `TASK-UI-${request.requestId}`,
      stepId: "HERO-009",
      documentVersion: "v1.0",
      scenario: request.scenario
    });
    request.status = "تکمیل";
    request.updatedAt = timestamp(now);
    request.result = Object.freeze({
      status: "تکمیل",
      scenario: result.scenario,
      attempts: result.attempts.map(attempt => Object.freeze({
        attempt: attempt.attempt,
        outcome: attempt.outcome,
        tests: attempt.tests
      })),
      eventCount: result.events.length,
      runnerStates: result.runners.map(runner => runner.state),
      summary: "Fake Agent بدون شبکه، Provider زنده یا هزینه اجرا شد."
    });
    return publicRequest(request);
  }

  function setFullAutonomy(value) {
    if (typeof value !== "boolean") throw new DashboardCommandError("INVALID_INPUT", "وضعیت اختیار کامل باید درست یا نادرست باشد.");
    fullAutonomy = value;
    return snapshot();
  }

  function setGlobalStop(value) {
    if (typeof value !== "boolean") throw new DashboardCommandError("INVALID_INPUT", "وضعیت توقف اضطراری باید درست یا نادرست باشد.");
    globalStop = value;
    return snapshot();
  }

  return Object.freeze({
    snapshot,
    createRequest,
    approveRequest,
    rejectRequest,
    stopRequest,
    runFakeAgent,
    setFullAutonomy,
    setGlobalStop
  });
}
