import assert from "node:assert/strict";
import test from "node:test";

import { createHeroServer } from "../apps/control-plane/src/server.mjs";
import { createHumanIdentity, createTotpCode } from "../packages/domain/src/human-identity.mjs";
import { createProjectAccessRegistry } from "../packages/domain/src/project-access.mjs";
import { buildDocx, buildZip } from "./helpers/zip-builder.mjs";

const ownerSecret = "owner-mfa-secret-for-upload-http-1";
const now = () => "2026-10-08T12:00:00.000Z";

test("private upload route: binary arrives as base64, hostile content is refused with precise codes and nothing is stored", async t => {
  const access = createProjectAccessRegistry({ ownerUserId: "hero-owner", ownerUser: { email: "owner@example.test", displayName: "Owner" }, now });
  const identity = createHumanIdentity({ accessRegistry: access, sessionSecret: "upload-http-session-secret-1234567890123456", now, owner: { userId: "hero-owner", email: "owner@example.test", displayName: "Owner", password: "Owner password 123", mfaSecret: ownerSecret } });
  const login = identity.completeLogin({ challengeId: identity.beginLogin({ email: "owner@example.test", password: "Owner password 123" }).challengeId, mfaCode: createTotpCode(ownerSecret, Math.floor(Date.parse(now()) / 1000)) });
  const app = createHeroServer({ host: "127.0.0.1", port: 0, now, projectAccessRegistry: access, humanIdentity: identity });
  const address = await app.start(); t.after(() => app.stop());
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${login.token}`, origin: base, "content-type": "application/json" };
  const created = await fetch(`${base}/api/projects`, { method: "POST", headers, body: JSON.stringify({ projectId: "upload-project", name: "Upload", intake: { projectType: "application", riskLevel: "standard" } }) });
  assert.equal([200, 201].includes(created.status), true);
  const upload = (body) => fetch(`${base}/api/projects/upload-project/inputs/upload`, { method: "POST", headers, body: JSON.stringify(body) });
  const b64 = buffer => buffer.toString("base64");

  const docx = await upload({ type: "word", filename: "plan.docx", encoding: "base64", content: b64(buildDocx("Quarterly plan")), mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  assert.equal(docx.status, 201);
  const stored = (await docx.json()).input;
  assert.equal(stored.parse.text, "Quarterly plan");
  assert.equal(stored.scan.externalAntivirus, "not-connected");

  const eicar = await upload({ type: "text", filename: "eicar.txt", content: "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*" });
  assert.equal(eicar.status, 422); assert.equal((await eicar.json()).code, "MALWARE_SCAN_REJECTED");
  const traversal = await upload({ type: "zip", filename: "t.zip", encoding: "base64", content: b64(buildZip([{ name: "../../evil.txt", data: "x" }])) });
  assert.equal(traversal.status, 422); assert.equal((await traversal.json()).code, "UPLOAD_CONTENT_REJECTED");
  const bomb = await upload({ type: "zip", filename: "b.zip", encoding: "base64", content: b64(buildZip([{ name: "zeros.bin", data: Buffer.alloc(30 * 1024 * 1024) }])) });
  assert.equal(bomb.status, 413); assert.equal((await bomb.json()).code, "ZIP_BOMB_REJECTED");
  const badBase64 = await upload({ type: "zip", filename: "x.zip", encoding: "base64", content: "not base64!!" });
  assert.equal(badBase64.status, 400); assert.equal((await badBase64.json()).code, "UPLOAD_ENCODING_INVALID");
  const mismatch = await upload({ type: "pdf", filename: "report.pdf.exe", content: "%PDF-1.7" });
  assert.equal(mismatch.status, 422);
  const link = await fetch(`${base}/api/projects/upload-project/inputs/link`, { method: "POST", headers, body: JSON.stringify({ url: "https://169.254.169.254/latest/meta-data/", label: "metadata" }) });
  assert.equal(link.status, 400); assert.equal((await link.json()).code, "SSRF_URL_REJECTED");
  const publicLink = await fetch(`${base}/api/projects/upload-project/inputs/link`, { method: "POST", headers, body: JSON.stringify({ url: "https://example.com/brief", label: "brief" }) });
  assert.equal(publicLink.status, 201);
  assert.equal((await publicLink.json()).input.fetchState, "pending-separate-authorization", "a link is recorded, never fetched");

  const overview = await fetch(`${base}/api/projects/upload-project/workspace-overview`, { headers });
  assert.equal(overview.status, 200);
  const text = JSON.stringify(await overview.json());
  assert.equal(text.includes("plan.docx"), true, "the accepted upload is listed, so the check can see stored names");
  assert.equal(text.includes("eicar.txt") || text.includes("evil.txt") || text.includes("b.zip"), false, "rejected uploads are never stored");
});
