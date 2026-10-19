---
name: plan-phase
description: >-
  Generates a detailed, token-efficient implementation plan for the next WhereHouse
  milestone or vertical slice so a lower-cost/faster model can execute it with zero
  architectural ambiguity. Use this skill when the user asks to plan the next phase,
  milestone, or feature from the PRD.
---

# Plan Next Phase (`plan-phase`)

This skill is designed to be run by a **high-reasoning model** during the **Planning Phase**. Its goal is to start from a clean `main` branch, do all architectural heavy lifting upfront, create a dedicated phase branch, and commit a self-contained, file-by-file blueprint in `docs/plans/` onto that branch so a faster, lower-cost model can execute it in a single pass.

---

## Step-by-Step Workflow

### 1. Ensure Clean `main` Branch Baseline
1. Run `git status` and `git branch --show-current` to verify the repository state.
2. If the repository is not currently on `main`:
   - If the working tree is clean, switch to `main` (`git checkout main`) and pull latest changes if `origin/main` is reachable (`git pull --ff-only` — ignore error if remote is not yet created).
   - If there are uncommitted changes or an unmerged phase in progress, alert the user before switching branches.

### 2. Assess Current Progress (Minimal Token Scan)
1. Read [`docs/PRD.md`](../../../docs/PRD.md) (specifically Section 6 Roadmap and the relevant functional sections).
2. Check existing plans in `docs/plans/` (if any) and list the current entities in `WhereHouse.Data/Entities/` and features in `WhereHouse.Client/src/app/features/` to determine what has already been built on `main`.
3. If the user did not specify which phase or slice to plan, identify the **next unbuilt vertical slice** in the current Milestone and choose a concise phase number and kebab-case slug (e.g., `01-location-hierarchy`).
   - *Sizing Rule:* Keep a single phase scoped to **1–3 closely related vertical slices** (e.g., *"Phase 01: Location & Movable Container Hierarchy + Sample Todo Cleanup"* or *"Phase 02: Categories, Attribute Templates & Core Items"*). If a Milestone is huge, break it into 2–3 digestible phases so the execution model's context window stays clean.

### 3. Clarify Only Unresolved Product Decisions
- Do **not** ask questions that are already answered in [`docs/PRD.md`](../../../docs/PRD.md) or [`.agents/rules/`](../../rules/).
- If there is a genuine UX or business-logic ambiguity not covered by the PRD, use `ask_question` to resolve it with the user before writing the plan.

### 4. Create the Phase Branch & Draft the Blueprint (`docs/plans/phase-<NN>-<slug>.md`)
1. Create and switch to a dedicated phase branch off `main`:
   ```powershell
   git checkout -b feature/phase-<NN>-<slug>
   ```
2. Write the implementation plan to `docs/plans/phase-<NN>-<slug>.md` following the exact structure in [resources/plan-template.md](./resources/plan-template.md).

To save maximum tokens during the **Execution Phase**, the plan **MUST** specify:
- **Exact File Paths** to create, modify, or delete across `WhereHouse.Core`, `WhereHouse.Data`, `WhereHouse.API`, `WhereHouse.Client`, and `Tests`.
- **Exact Data Contracts & Schema Details:**
  - C# Entity properties, enums, foreign keys, indexes, and delete behaviors (`Restrict` vs `Cascade` — remember SQL Server disallows multiple cascade paths!).
  - C# `record` DTOs, Request validation attributes, and `I*Service` method signatures.
  - Exact EF Core migration name to run (`dotnet ef migrations add <MigrationName> --project WhereHouse.Data`).
- **Exact API Endpoints:** HTTP verbs, relative route paths, query parameters, status codes, and `IsPrivate` ("Secret/Gift Mode") ownership enforcement rules.
- **Exact Angular Client Specs:** TypeScript model interfaces, `@Service()` methods, component routes, signals/computed properties, and mobile + desktop layout requirements.
- **Ordered Execution Checklist (`- [ ]`):** Broken into sequential tasks (`Backend Core & Data` $\rightarrow$ `API & Integration Tests` $\rightarrow$ `Angular Client & Spec Tests` $\rightarrow$ `Playwright E2E & Final Format/Verify`) with exact test commands to run after each task.

### 5. Commit the Plan onto the Phase Branch & Present for Approval
1. Stage and commit the generated plan (and any planning artifacts) directly onto the `feature/phase-<NN>-<slug>` branch:
   ```powershell
   git add docs/plans/phase-<NN>-<slug>.md
   git commit -m "docs(plan): add phase <NN> implementation plan (<slug>)"
   ```
2. Do **not** write application code during `plan-phase`.
3. Point the user to the committed `docs/plans/phase-<NN>-<slug>.md` file, confirm the active branch name (`feature/phase-<NN>-<slug>`), highlight any key architectural choices made, and let them know they can switch to their execution model and run `/execute-phase` when ready.
