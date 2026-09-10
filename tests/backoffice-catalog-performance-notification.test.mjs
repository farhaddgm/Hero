import assert from "node:assert/strict";
import test from "node:test";
import { createSystemCatalog } from "../packages/domain/src/system-catalog.mjs";
import { createPerformanceIntelligence } from "../packages/domain/src/performance-intelligence.mjs";
import { createNotificationObservability } from "../packages/domain/src/notification-observability.mjs";
import { validatePerformanceIntelligenceContract } from "../packages/contracts/src/performance-intelligence.mjs";
import { validateNotificationObservabilityContract } from "../packages/contracts/src/notification-observability.mjs";

const now=()=>"2026-09-10T12:00:00.000Z";const owner={subject:"hero-owner",role:"project-owner"};const admin={subject:"project-admin",role:"admin"};const viewer={subject:"project-viewer",role:"viewer"};

test("catalog records only local inventory, creates no-overwrite drift proposals, links evidence and computes blast radius",()=>{
 const catalog=createSystemCatalog({now});catalog.register({actor:admin,projectId:"project-vpn",entityId:"repo-vpn",type:"repository",name:"VPN repo",metadata:{desired:{branch:"main"}}});catalog.register({actor:admin,projectId:"project-vpn",entityId:"service-vpn",type:"service",name:"VPN service"});catalog.link({actor:admin,projectId:"project-vpn",fromEntityId:"service-vpn",toEntityId:"repo-vpn"});
 assert.equal(catalog.recordRepositoryInventory({actor:admin,projectId:"project-vpn",repositoryEntityId:"repo-vpn",observed:{branch:"feature"}}).state,"recorded-no-external-fetch");
 const drift=catalog.detectDrift({actor:admin,projectId:"project-vpn",entityId:"repo-vpn",observed:{branch:"feature"}});assert.deepEqual(drift.differences,["branch"]);assert.equal(drift.overwrite,"forbidden");
 catalog.attachReferences({actor:admin,projectId:"project-vpn",entityId:"repo-vpn",references:{document:"hero://docs/repo",health:"healthy"}});catalog.registerKnowledge({actor:admin,projectId:"project-vpn",knowledgeId:"knowledge-001",kind:"decision",title:"Repository decision",sourceRef:"hero://docs/repo",tags:["git"]});assert.equal(catalog.search({projectId:"project-vpn",query:"repository"}).length,2);assert.deepEqual(catalog.blastRadius({projectId:"project-vpn",entityId:"repo-vpn"}),["repo-vpn","service-vpn"]);
});

test("token ledger is immutable, complete by scope, cap-aware, evidence-linked and health is explainable",()=>{
 assert.deepEqual(validatePerformanceIntelligenceContract(),[]);const intelligence=createPerformanceIntelligence({now});intelligence.setBudget({actor:owner,projectId:"project-vpn",softThreshold:100,hardCap:150});
 const usage=intelligence.recordUsage({actor:admin,projectId:"project-vpn",usageId:"usage-001",invocationId:"invoke-001",provider:"openai",model:"sol",inputTokens:50,cachedTokens:10,outputTokens:45,teamId:"mahsulo",roleId:"analyst",taskId:"task-001",runId:"run-001"});assert.equal(usage.totalTokens,105);assert.equal(usage.budgetDecision,"soft-threshold-warning");
 const hard=intelligence.recordUsage({actor:admin,projectId:"project-vpn",usageId:"usage-002",invocationId:"invoke-002",provider:"openai",model:"sol",inputTokens:30,outputTokens:20,teamId:"mahsulo"});assert.equal(hard.budgetDecision,"hard-cap-pause-required");assert.equal(intelligence.ledger({actor:viewer,projectId:"project-vpn",groupBy:"team"})[0].totalTokens,155);
 intelligence.recordEvaluation({actor:admin,projectId:"project-vpn",evaluationId:"evaluation-001",subjectType:"role",subjectId:"analyst",method:"deterministic",goalFit:.9,errorCount:1,reworkCount:0,evidenceRefs:["hero://evidence/test"]});assert.equal(intelligence.scorecard({actor:viewer,projectId:"project-vpn",subjectId:"analyst"}).goalFit,.9);assert.equal(intelligence.health({actor:viewer,projectId:"project-vpn"}).status,"critical");intelligence.setCriticalOverride({actor:admin,projectId:"project-vpn",overrideId:"override-001",reason:"Critical vulnerability"});assert.equal(intelligence.health({actor:viewer,projectId:"project-vpn"}).criticalOverrides.length,1);
});

test("notification inbox deduplicates, actions remain internal, and audit/trace redacts sensitive fields",()=>{
 assert.deepEqual(validateNotificationObservabilityContract(),[]);const obs=createNotificationObservability({now});const first=obs.createNotification({actor:admin,projectId:"project-vpn",category:"budget",severity:"warning",title:"Token threshold",ownerId:"hero-owner",deduplicationKey:"budget-1",correlationId:"corr-001",action:{type:"approve"}});const second=obs.createNotification({actor:admin,projectId:"project-vpn",category:"budget",severity:"warning",title:"Token threshold",deduplicationKey:"budget-1",correlationId:"corr-001"});assert.equal(second.deduplicated,true);assert.equal(obs.act({actor:admin,projectId:"project-vpn",notificationId:first.notificationId,action:"snooze"}).state,"snoozed");
 const audit=obs.recordAudit({actor:admin,projectId:"project-vpn",kind:"command",outcome:"accepted",correlationId:"corr-001",data:{secret:"do-not-store",safe:"yes"}});assert.equal(audit.metadata.secret,"[redacted]");obs.recordTrace({actor:admin,projectId:"project-vpn",traceId:"trace-001",correlationId:"corr-001",kind:"execution",metadata:{password:"hidden"}});assert.equal(obs.setSli({actor:admin,projectId:"project-vpn",projection:"portfolio",lagSeconds:61,freshnessSeconds:60}).status,"stale");assert.equal(obs.observability({actor:viewer,projectId:"project-vpn"}).traceCount,1);
});
