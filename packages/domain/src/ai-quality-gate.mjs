import { createQualityGate } from "./quality-gate.mjs";

const SYSTEM_ACTOR = Object.freeze({ kind: "system", id: "hero-ai-quality-gate" });
const STATUS_BY_VERDICT = Object.freeze({
  approved: Object.freeze({ status: "approved", code: "AI_EVALUATION_APPROVED" }),
  needs_revision: Object.freeze({ status: "changes-requested", code: "AI_EVALUATION_NEEDS_REVISION" }),
  rejected: Object.freeze({ status: "blocked", code: "AI_EVALUATION_REJECTED" })
});

function immutableCopy(value) {
  return Object.freeze(structuredClone(value));
}

function assertIdentifier(label, value) {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}

/**
 * Adapts a completed evaluator invocation to the existing Quality Gate.
 * The adapter records evidence only; it never grants a develop/release authorization.
 */
export function createAiReviewPipeline({ aiOrchestration, invokeEvaluator } = {}) {
  if (!aiOrchestration || typeof aiOrchestration.evaluateInvocation !== "function") throw new Error("aiOrchestration.evaluateInvocation is required.");
  if (typeof invokeEvaluator !== "function") throw new Error("invokeEvaluator is required.");

  return Object.freeze({
    async reviewAsync(input) {
      const gateId = assertIdentifier("gateId", input.gateId);
      const outcome = await invokeEvaluator(immutableCopy({ ...input, gateId }));
      if (!outcome || typeof outcome !== "object") throw new Error("Evaluator did not return an invocation reference.");
      const invocationId = assertIdentifier("invocationId", outcome.invocationId);
      const evaluationId = assertIdentifier("evaluationId", outcome.evaluationId ?? `EVAL-${gateId}-${input.correctionCycles ?? 0}`);
      const target = outcome.target ?? { kind: "quality-gate", gateId };
      const evaluation = aiOrchestration.evaluateInvocation({
        invocationId,
        evaluationId,
        target,
        actor: outcome.actor ?? SYSTEM_ACTOR,
        idempotencyKey: outcome.idempotencyKey ?? `quality-gate-evaluation-${gateId}-${input.correctionCycles ?? 0}`
      });
      const mapped = STATUS_BY_VERDICT[evaluation.evaluation.verdict];
      if (!mapped) throw new Error("Evaluator returned an unsupported verdict.");
      return Object.freeze({
        status: mapped.status,
        code: mapped.code,
        evaluationId: evaluation.evaluation.evaluationId,
        review: Object.freeze({ findings: evaluation.evaluation.findings, score: evaluation.evaluation.score, confidence: evaluation.evaluation.confidence })
      });
    }
  });
}

export function createAiQualityGate({ aiOrchestration, invokeEvaluator, ...options } = {}) {
  const asyncReviewPipeline = createAiReviewPipeline({ aiOrchestration, invokeEvaluator });
  return createQualityGate({ ...options, asyncReviewPipeline });
}
