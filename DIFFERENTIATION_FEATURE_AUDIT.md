# Talent Sonar: Differentiation Feature Audit

**Date:** January 16, 2026  
**Status:** Comprehensive feature check (no changes made)

---

## Executive Summary

This audit checks the Talent Sonar app code against the five differentiation levers outlined in the positioning strategy. The app has **strong foundational implementations** for most levers, with some gaps in messaging, UI presentation, and account-specific learning features.

---

## 1. "Explainable Matching" as a Product, Not a Feature

### ✅ **IMPLEMENTED**

**Evidence Pack Service** (`services/EvidencePackService.ts`)
- Generates 3-bullet "Why them" with evidence snippets
- Includes skill alignment, role & seniority, and evidence signals
- Provides confidence scores (0-1 scale)
- Supports both deterministic and AI-powered generation
- Fallback to deterministic when AI unavailable

**What's Shown:**
- Match reasons with specific evidence (resume snippets, profile data)
- Risk statement + mitigation strategy
- Missing signals (gaps that are trainable vs fatal)
- Confidence percentage displayed in UI

**Where It Lives:**
- `components/CandidatePane.tsx` - displays evidence pack in candidate cards
- `services/EvidencePackService.ts` - builds the pack
- `types.ts` - `EvidencePack` interface with `matchReasons`, `risk`, `missing`, `confidence`

### ⚠️ **GAPS**

1. **Messaging not differentiated**: The UI shows "Evidence" but doesn't position it as "Explainable Matching" or emphasize it as a product differentiator
2. **No "What to verify" section**: Evidence pack has truth-check preview questions but they're not labeled as "targeted verification questions"
3. **No red flags section**: Risk mitigation exists but isn't explicitly called out as "red flags + data provenance"
4. **Data provenance not visible**: Evidence snippets have `source` field but UI doesn't show where data came from (resume vs profile vs inferred)

---

## 2. The Output Isn't a Score — It's a Confidence Pack

### ✅ **PARTIALLY IMPLEMENTED**

**What Exists:**
- 6-bullet "Why them" → **3 bullets implemented** (skill alignment, role & seniority, evidence signals)
- 3 "Deal-breaker checks" → **Not implemented**
- 5 structured interview questions → **Implemented** (TruthCheckService generates 5 questions)
- 90-second HM brief → **Not implemented**
- Compliance note → **Partially implemented** (evidence source tracking exists but not surfaced)

### ✅ **IMPLEMENTED COMPONENTS**

**Truth Check Service** (`services/TruthCheckService.ts`)
- Generates exactly 5 "Describe the last time..." questions
- Each question has a rubric with strong/adequate/concern bands
- Questions are tailored to job + candidate gaps
- Focuses on hands-on proof, not generic claims

**Decision Artifacts** (`services/DecisionArtifactService.ts`)
- Stores screening results, interview debriefs, shortlist analyses
- Captures score, decision (STRONG_PASS/PASS/BORDERLINE/FAIL), summary
- Stores full details (questions, answers, rubric version)
- Audit trail with timestamps and actor info

**Where It Lives:**
- `components/modals/PreHmTruthCheckModal.tsx` - UI for truth check capture
- `services/TruthCheckService.ts` - question generation
- `services/TruthCheckAssessmentService.ts` - scoring and assessment

### ⚠️ **GAPS**

1. **No "Deal-breaker checks"**: Missing explicit 3-item checklist for must-haves vs fatal flaws
2. **No HM brief**: No 90-second summary artifact for hiring managers
3. **No compliance note**: Evidence provenance not packaged as a compliance artifact
4. **Confidence pack not branded**: The output is scattered across multiple modals/screens, not presented as a unified "Confidence Pack"
5. **No visual summary card**: No single view showing all 5 components together

---

## 3. Built for Recruiters' Reality: Speed, Batch-Work, and Triage

### ✅ **IMPLEMENTED**

**Batch Analysis** (`hooks/useAnalysis.ts`)
- `handleBatchAnalysis()` processes multiple candidates at once
- Progress tracking (current/total)
- Batch processing UI overlay with progress bar
- Auto-triggered when jobs are added

**Screening Agent** (`services/AutonomousScreeningAgent.ts`)
- Conducts initial screens with qualifying questions
- Scores responses and filters candidates
- Generates screening results with recommendations
- Stores results persistently

**Triage Features:**
- Pipeline stages (sourced → new → long_list → screening → scheduling → interview → offer → hired → rejected)
- Candidate filtering by stage
- Shortlist generation with scoring
- Batch operations on multiple candidates

**Where It Lives:**
- `components/CandidatePane.tsx` - batch analysis UI
- `services/AutonomousScreeningAgent.ts` - screening logic
- `pages/PipelinePage.tsx` - pipeline triage view

### ⚠️ **GAPS**

1. **No "Show me the 12 most defensible profiles"**: Missing explicit triage query/filter for "top N defensible candidates"
2. **Auto-generate outreach angles**: Partially implemented (OutreachDraftService exists) but not surfaced in batch workflow
3. **Auto-build screening notes**: Screening results exist but not auto-populated as notes in UI
4. **No "5 good, not 50 ranked"**: UI shows ranked lists but doesn't have a "defensible shortlist" mode that limits to top N
5. **Batch outreach not implemented**: Can't bulk-generate outreach messages for multiple candidates

---

## 4. "Gold-Standard Learning" from Your Hires, Not Internet Hype

### ❌ **NOT IMPLEMENTED**

**What's Missing:**
- Benchmark Library: No past successful profiles → role archetype mapping
- Calibration memory: No storage of "what Merck/Airbus HMs actually selected"
- Drift alerts: No "this role changed vs last quarter" detection
- Learning from hires: No feedback loop to update matching based on who was hired

**What Exists (Partial):**
- `services/CareerPathService.ts` - has role archetypes but they're hardcoded, not learned
- `services/VerifiedSkillsService.ts` - tracks verified skills but not tied to hire outcomes
- `services/ProfileEnrichmentService.ts` - enriches profiles but doesn't learn from hires

### ⚠️ **GAPS**

1. **No hire outcome tracking**: No way to mark "this candidate was hired and succeeded" to update benchmarks
2. **No role archetype learning**: Role archetypes are static, not updated based on actual hires
3. **No calibration memory**: No storage of hiring manager selections over time
4. **No drift detection**: No alerts when role requirements change
5. **No account-specific intelligence**: All matching is generic, not customized per client/account

---

## 5. Truth-First Governance (Enterprise Advantage)

### ✅ **IMPLEMENTED**

**Audit Service** (`services/AuditService.ts`)
- Logs all actions with actor, timestamp, details
- Tracks compliance checks passed/failed
- Stores audit trail

**Fairness Service** (`services/PipelineFairnessService.ts`)
- Aggregate-only fairness reports (no per-candidate demographics)
- Gender and education distribution tracking
- Fairness alerts (imbalance, concentration)
- Privacy-first: k-anonymity-ish minimum sample sizes

**Data Provenance:**
- Evidence snippets track source (resume, profile, supabase_document, manual_note, inferred)
- Decision artifacts store rubric version, external ID, method (deterministic vs AI)
- Pipeline events append-only log

**Where It Lives:**
- `services/AuditService.ts` - audit logging
- `services/PipelineFairnessService.ts` - fairness reporting
- `sql/FAIRNESS_DEMOGRAPHICS_SETUP.sql` - fairness database setup
- `pages/GovernancePage.tsx` - governance UI
- `types/audit.ts` - audit types

### ⚠️ **GAPS**

1. **No bias checks UI**: Fairness reports exist but not prominently surfaced in matching workflow
2. **No explainability logs**: No audit trail showing "why this candidate was ranked #1"
3. **No human-in-the-loop gates**: No workflow to require human approval before certain actions
4. **No compliance note in confidence pack**: Governance info not packaged with match results
5. **No "safe + auditable" messaging**: Governance features exist but aren't positioned as differentiators

---

## Message Pillars: Implementation Status

### Pillar 1: Confidence (not matching)
**Status:** ✅ Partially implemented
- Evidence packs show confidence scores
- Truth checks provide verification framework
- **Gap:** Not positioned as "reduce hiring uncertainty" — just shown as features

### Pillar 2: Evidence (not vibes)
**Status:** ✅ Implemented
- Evidence packs with snippets and sources
- Truth check rubrics with strong/adequate/concern bands
- Decision artifacts with full audit trail
- **Gap:** Evidence provenance not always visible to user

### Pillar 3: Throughput (not dashboards)
**Status:** ✅ Partially implemented
- Batch analysis for multiple candidates
- Screening agent for first-pass triage
- Pipeline stages for workflow
- **Gap:** No "compress days into minutes" messaging or workflow optimization

---

## Feature Completeness Matrix

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| **Explainable Matching** | ✅ 80% | EvidencePackService | Missing data provenance UI, red flags section |
| **Confidence Pack** | ⚠️ 60% | Multiple services | 3/6 bullets, no HM brief, no deal-breaker checks |
| **Truth Check Questions** | ✅ 95% | TruthCheckService | 5 questions with rubrics, fully implemented |
| **Batch Triage** | ✅ 85% | AutonomousScreeningAgent | Missing "top N defensible" mode |
| **Auto-Outreach** | ⚠️ 40% | OutreachDraftService | Service exists, not in batch workflow |
| **Benchmark Library** | ❌ 0% | N/A | Not implemented |
| **Calibration Memory** | ❌ 0% | N/A | Not implemented |
| **Drift Alerts** | ❌ 0% | N/A | Not implemented |
| **Audit Trail** | ✅ 90% | AuditService | Implemented, not surfaced in UI |
| **Fairness Checks** | ✅ 85% | PipelineFairnessService | Implemented, not in matching workflow |
| **Data Provenance** | ✅ 70% | EvidencePackService | Tracked, not always visible |

---

## Quick Wins (High Impact, Low Effort)

1. **Add "Deal-breaker Checks"** to confidence pack (3 items: must-haves, fatal flaws, trainable gaps)
2. **Surface data provenance** in evidence pack UI (show "From: Resume" / "From: Profile" / "Inferred")
3. **Add HM brief** as 90-second summary card
4. **Brand as "Confidence Pack"** — create unified modal showing all 5 components
5. **Add "Top N Defensible"** filter to triage workflow
6. **Surface fairness checks** in candidate matching workflow

---

## Medium Effort (Strategic)

1. **Implement Benchmark Library** — store successful hire profiles by role
2. **Add Calibration Memory** — track HM selections over time
3. **Implement Drift Alerts** — detect role requirement changes
4. **Add Hire Outcome Feedback** — mark candidates as hired/succeeded to update benchmarks
5. **Batch Outreach Workflow** — generate + send outreach for multiple candidates

---

## Summary

**Strengths:**
- Evidence-based matching is well-implemented
- Truth check questions are production-ready
- Audit and fairness infrastructure is solid
- Batch processing and triage workflows exist

**Weaknesses:**
- No learning from hires (benchmark library, calibration memory)
- Confidence pack not unified or branded
- Governance features not surfaced in matching workflow
- Messaging doesn't emphasize differentiation

**Recommendation:**
Focus on quick wins first (deal-breaker checks, HM brief, unified confidence pack) to ship a complete "Confidence Pack" product. Then tackle medium-effort items (benchmark library, calibration memory) for account-specific intelligence.
