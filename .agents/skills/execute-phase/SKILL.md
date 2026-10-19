---
name: execute-phase
description: >-
  Executes the latest (or specified) implementation plan in docs/plans/ step-by-step,
  running EF Core migrations, unit/integration/Angular/E2E tests, and fixing errors
  until green. Use this skill when the user asks to implement or execute a planned phase.
---

# Execute Planned Phase (`execute-phase`)

This skill is designed to be run by an **implementation model** after `plan-phase` has created a `feature/phase-<NN>-<slug>` branch and committed a phase blueprint in `docs/plans/`.

---

## Step-by-Step Workflow

### 1. Verify Active Phase Branch & Locate the Plan
1. Run `git branch --show-current` and check `docs/plans/`.
2. Ensure you are on the target phase branch (`feature/phase-<NN>-<slug>`), **never** on `main`. (If the repository is on `main`, check out the existing `feature/phase-<NN>-<slug>` branch before making any changes.)
3. Open the target `docs/plans/phase-<NN>-<slug>.md` file (the plan whose status is `Planned` or `In Progress`).
4. Update the plan status header to `[~] In Progress`.
5. **Do not scan the entire codebase**—the plan file already contains the exact file paths, C# signatures, EF configurations, API routes, and Angular interfaces needed. Only read existing files that you are directly modifying.

### 2. Execute Tasks Sequentially (`Task 1` $\rightarrow$ `Task 4`)
Work through each unchecked `- [ ]` task in Section 5 of the plan in order:

1. **Task 1 (Backend Core & Data + EF Migration):**
   - Implement the `WhereHouse.Core` and `WhereHouse.Data` files exactly as specified.
   - Run `dotnet ef migrations add <MigrationName> --project WhereHouse.Data` and `dotnet ef database update --project WhereHouse.Data`.
   - Write and run the unit tests (`dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj`). Fix any errors before moving to Task 2.
   - Check off `- [x] Task 1` in the plan file.

2. **Task 2 (API Controllers & Integration Tests):**
   - Implement the `WhereHouse.API` controller(s).
   - Write integration tests in `Tests/WhereHouse.API.IntegrationTests/` using `WhereHouseWebApplicationFactory`.
   - Run `dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj` and fix any issues until 100% passing.
   - Check off `- [x] Task 2` in the plan file.

3. **Task 3 (Angular Client & Unit Tests):**
   - Implement the TypeScript models, `@Service()` classes, components, and routes in `WhereHouse.Client`.
   - Write/update `.spec.ts` unit tests.
   - From `WhereHouse.Client`, run `npm run lint`, `npm run build`, and `npm test -- --watch=false`. Fix any compile, lint, or test errors until 100% passing.
   - Check off `- [x] Task 3` in the plan file.

4. **Task 4 (Playwright E2E, Formatting & Completion):**
   - Add/update Playwright E2E tests in `Tests/WhereHouse.Client.E2ETests/` if applicable.
   - Format all code (`dotnet csharpier format .` at repo root; `npm run format` and `npm run lint:fix` in `WhereHouse.Client`).
   - Check off `- [x] Task 4` and set the plan status header to `[x] Completed`.
   - Stage and commit all phase changes onto the `feature/phase-<NN>-<slug>` branch (`git add -A && git commit -m "feat(phase-<NN>): implement <slug>"`).
