---
name: plan-phase
description: >-
  Generates a detailed, token-efficient implementation plan for the next WhereHouse
  milestone or vertical slice so a lower-cost/faster model can execute it with zero
  architectural ambiguity. Use this skill when the user asks to plan the next phase,
  milestone, or feature from the PRD.
---

# Plan Next Phase (`plan-phase`)

This skill is designed to be run by a **high-reasoning model** during the **Planning Phase**. Its goal is to do all architectural heavy lifting upfront and produce a self-contained, file-by-file blueprint in `docs/plans/` so that a faster, lower-cost model can execute the implementation in a single pass without having to guess schemas, routes, or UX flows.

---

## Step-by-Step Workflow

### 1. Assess Current Progress (Minimal Token Scan)
1. Read [`docs/PRD.md`](../../../docs/PRD.md) (specifically Section 6 Roadmap and the relevant functional sections).
2. Check existing plans in `docs/plans/` (if any) and list the current entities in `WhereHouse.Data/Entities/` and features in `WhereHouse.Client/src/app/features/` to determine what has already been built.
3. If the user did not specify which phase or slice to plan, identify the **next unbuilt vertical slice** in the current Milestone.
   - *Sizing Rule:* Keep a single phase scoped to **1–3 closely related vertical slices** (e.g., *"Phase 01: Location & Movable Container Hierarchy + Sample Todo Cleanup"* or *"Phase 02: Categories, Attribute Templates & Core Items"*). If a Milestone is huge, break it into 2–3 digestible phases so the execution model's context window stays clean.

### 2. Clarify Only Unresolved Product Decisions
- Do **not** ask questions that are already answered in [`docs/PRD.md`](../../../docs/PRD.md) or [`.agents/rules/`](../../rules/).
- If there is a genuine UX or business-logic ambiguity not covered by the PRD, use `ask_question` to resolve it with the user before writing the plan.

### 3. Draft the Handoff Blueprint (`docs/plans/phase-<NN>-<slug>.md`)
Write the implementation plan to `docs/plans/phase-<NN>-<slug>.md` following the exact structure in [resources/plan-template.md](./resources/plan-template.md).

To save maximum tokens during the **Execution Phase**, the plan **MUST** specify:
- **Exact File Paths** to create, modify, or delete across `WhereHouse.Core`, `WhereHouse.Data`, `WhereHouse.API`, `WhereHouse.Client`, and `Tests`.
- **Exact Data Contracts & Schema Details:**
  - C# Entity properties, enums, foreign keys, indexes, and delete behaviors (`Restrict` vs `Cascade` — remember SQL Server disallows multiple cascade paths!).
  - C# `record` DTOs, Request validation attributes, and `I*Service` method signatures.
  - Exact EF Core migration name to run (`dotnet ef migrations add <MigrationName> --project WhereHouse.Data`).
- **Exact API Endpoints:** HTTP verbs, relative route paths, query parameters, status codes, and `IsPrivate` ("Secret/Gift Mode") ownership enforcement rules.
- **Exact Angular Client Specs:** TypeScript model interfaces, `@Service()` methods, component routes, signals/computed properties, and mobile + desktop layout requirements.
- **Ordered Execution Checklist (`- [ ]`):** Broken into sequential tasks (`Backend Core & Data` $\rightarrow$ `API & Integration Tests` $\rightarrow$ `Angular Client & Spec Tests` $\rightarrow$ `Playwright E2E & Final Format/Verify`) with exact test commands to run after each task.

### 4. Present for Approval
- Do **not** write application code during `plan-phase`.
- Point the user to the generated `docs/plans/phase-<NN>-<slug>.md` file, highlight any key architectural choices made (such as SQL Server foreign-key cascade rules or tree query strategies), and let them know they can switch to their execution model and run `/execute-phase` when ready.
