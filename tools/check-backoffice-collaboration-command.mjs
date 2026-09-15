import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateBackofficeCollaborationContract } from "../packages/contracts/src/backoffice-collaboration.mjs";
import { validateBackofficeCommandCenterContract } from "../packages/contracts/src/backoffice-command-center.mjs";
import { validateSystemCatalogContract } from "../packages/contracts/src/system-catalog.mjs";
import { REPO_ROOT, isInsideRoot } from "./fs-policy.mjs";

const BATCHES = [["007",61,70],["008",71,80],["009",81,90]];
const EXCLUDED = ["production-deploy","destructive-data-operation","external-spend","secret-change","external-message","irreversible-operation","pilot-execution","notion-write"];
function file(root, value) { const absolute = path.resolve(root, value); if (!isInsideRoot(absolute, root)) throw new Error("Path outside root."); return absolute; }
function step(number) { return `BO-${String(number).padStart(3,"0")}`; }
export function validateBackofficeCollaborationCommand({ root = REPO_ROOT } = {}) {
  const errors=[]; const base=path.resolve(root);
  for (const issue of [...validateBackofficeCollaborationContract(),...validateBackofficeCommandCenterContract(),...validateSystemCatalogContract()]) errors.push({code:"CONTRACT_INVALID",detail:issue});
  for (const [suffix,from,to] of BATCHES) { const auth=JSON.parse(fs.readFileSync(file(base,`config/authorizations/backoffice-20260910-${suffix}.json`),"utf8")); const expected=Array.from({length:to-from+1},(_,i)=>step(from+i)); if(auth.authorizationId!==`BATCH-BACKOFFICE-20260910-${suffix}`||auth.status!=="active"||auth.grantedBy!=="project-owner"||auth.globalStop!==false||auth.steps.map(item=>item.stepId).join(",")!==expected.join(",")) errors.push({code:"AUTH_INVALID",detail:suffix}); for(const excluded of EXCLUDED)if(!auth.excludedOperations?.includes(excluded)||auth.operations?.includes(excluded))errors.push({code:"SENSITIVE_SCOPE_INVALID",detail:excluded}); }
  const roadmap=fs.readFileSync(file(base,"docs/roadmap/BACKOFFICE-COMMAND-CENTER-IMPLEMENTATION-v1.0.md"),"utf8"); for(let index=61;index<=90;index++)if(!roadmap.includes(`| \`${step(index)}\` |`))errors.push({code:"ROADMAP_STEP_MISSING",detail:step(index)});
  for(const relative of ["packages/domain/src/project-collaboration.mjs","packages/domain/src/command-center.mjs","packages/domain/src/system-catalog.mjs","packages/adapters/migrations/012_collaboration_command_catalog.sql","apps/control-plane/src/project-control-room-view.mjs","tests/backoffice-collaboration-command-catalog.test.mjs","docs/decisions/ADR-0014-collaboration-command-center-and-system-catalog.md","docs/roadmap/BACKOFFICE-COLLABORATION-COMMAND-CATALOG-BO-061-090.md"])if(!fs.existsSync(file(base,relative)))errors.push({code:"FILE_MISSING",detail:relative});
  const registry=JSON.parse(fs.readFileSync(file(base,"docs/registry/document-registry.json"),"utf8")); const records=new Map(registry.documents.map(item=>[item.id,item.status])); for(const id of ["HERO-ADR-0014","HERO-EVIDENCE-BACKOFFICE-COLLABORATION-COMMAND-CATALOG-BO-061-090"])if(records.get(id)!=="active")errors.push({code:"DOCUMENT_NOT_ACTIVE",detail:id});
  return Object.freeze({ok:errors.length===0,stepCount:30,errors:Object.freeze(errors)});
}
const current=fileURLToPath(import.meta.url); if(process.argv[1]&&path.resolve(process.argv[1])===current){const result=validateBackofficeCollaborationCommand();if(result.ok)console.log("Back Office collaboration/command: PASS — 30 steps, 3 snapshots, Global Stop off");else{result.errors.forEach(error=>console.error(`FAIL ${error.code} — ${error.detail}`));process.exitCode=1;}}
