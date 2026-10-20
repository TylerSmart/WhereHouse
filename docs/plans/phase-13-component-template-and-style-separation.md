# Phase 13: Angular Component Template & Style Separation

> **Branch:** `feature/phase-13-component-template-and-style-separation`
> **Status:** Planned (`[ ]` Not Started | `[~]` In Progress | `[x]` Completed)
> **PRD Reference:** Architectural Cleanliness & Frontend Conventions (`.agents/rules/frontend-angular.md`)
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

Refactor all Angular components in `WhereHouse.Client` that currently declare inline `template: \`...\`` and inline `styles: \`...\`` to separate, dedicated external `.component.html` and `.component.scss` files.

### Key Objectives
1. **100% External File Separation:**
   - Extract the inline HTML template into `<component-name>.component.html`.
   - Extract the inline SCSS styles into `<component-name>.component.scss`.
   - Update `@Component({...})` in `<component-name>.component.ts` to reference `templateUrl: './<component-name>.component.html'` and `styleUrl: './<component-name>.component.scss'`.
   - Maintain 100% functional, visual, and behavioral parity—zero changes to component logic, selectors, bindings, imports, tests, or styling.

2. **Rules Enforcement:**
   - Codified in `.agents/rules/frontend-angular.md`: strict requirement that all future Angular components MUST use separate `.component.html` and `.component.scss` files.

3. **Verification Guarantees:**
   - Zero compilation/bundle errors: `npm run build` succeeds cleanly.
   - Zero ESLint/Prettier violations: `npm run lint` succeeds cleanly.
   - All 208 Angular unit tests pass (`npm test -- --watch=false`).
   - All 65 Playwright E2E tests pass (`dotnet test Tests/WhereHouse.Client.E2ETests/WhereHouse.Client.E2ETests.csproj`).
   - All 123 backend unit and integration tests pass.

---

## 2. Component Inventory & Refactoring Map

A comprehensive scan of `WhereHouse.Client/src/app` identifies **19 components** currently utilizing inline templates and styles. All 19 are located within `WhereHouse.Client/src/app/features/dashboard/`. (Components `app.component`, `login.component`, `dashboard.component`, and `theme-customizer-dialog.component` already have separate `.html` and `.scss` files).

### Refactoring Pattern for Each Component

In `@Component({...})`:
- Replace `template: \`...\`,` with `templateUrl: './<component-name>.component.html',`
- Replace `styles: \`...\`,` with `styleUrl: './<component-name>.component.scss',`
- Retain all other metadata (`selector`, `imports`, `host`, etc.).

---

### Group 1: Spatial Hierarchy & Location Dialogs (5 Components)

#### 1. `LocationDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/location-dialog/`
- **TypeScript:** `location-dialog.component.ts`
- **New Template File:** `location-dialog.component.html` (extracted from `template: \`...\``)
- **New Style File:** `location-dialog.component.scss` (extracted from `styles: \`...\``)
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-location-dialog',
    templateUrl: './location-dialog.component.html',
    styleUrl: './location-dialog.component.scss',
  })
  ```

#### 2. `LocationAttachmentsDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/location-attachments-dialog/`
- **TypeScript:** `location-attachments-dialog.component.ts`
- **New Template File:** `location-attachments-dialog.component.html`
- **New Style File:** `location-attachments-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-location-attachments-dialog',
    templateUrl: './location-attachments-dialog.component.html',
    styleUrl: './location-attachments-dialog.component.scss',
  })
  ```

#### 3. `MoveLocationDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/move-location-dialog/`
- **TypeScript:** `move-location-dialog.component.ts`
- **New Template File:** `move-location-dialog.component.html`
- **New Style File:** `move-location-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-move-location-dialog',
    templateUrl: './move-location-dialog.component.html',
    styleUrl: './move-location-dialog.component.scss',
  })
  ```

#### 4. `ConfirmDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/confirm-delete-dialog/`
- **TypeScript:** `confirm-delete-dialog.component.ts`
- **New Template File:** `confirm-delete-dialog.component.html`
- **New Style File:** `confirm-delete-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-confirm-dialog',
    templateUrl: './confirm-delete-dialog.component.html',
    styleUrl: './confirm-delete-dialog.component.scss',
  })
  ```

#### 5. `CategoryManagerDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/category-manager-dialog/`
- **TypeScript:** `category-manager-dialog.component.ts`
- **New Template File:** `category-manager-dialog.component.html`
- **New Style File:** `category-manager-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-category-manager-dialog',
    templateUrl: './category-manager-dialog.component.html',
    styleUrl: './category-manager-dialog.component.scss',
  })
  ```

---

### Group 2: Item Management & Inspection Dialogs (5 Components)

#### 6. `ItemDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/item-dialog/`
- **TypeScript:** `item-dialog.component.ts`
- **New Template File:** `item-dialog.component.html`
- **New Style File:** `item-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-item-dialog',
    templateUrl: './item-dialog.component.html',
    styleUrl: './item-dialog.component.scss',
  })
  ```

#### 7. `ItemAttachmentsDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/item-attachments-dialog/`
- **TypeScript:** `item-attachments-dialog.component.ts`
- **New Template File:** `item-attachments-dialog.component.html`
- **New Style File:** `item-attachments-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-item-attachments-dialog',
    templateUrl: './item-attachments-dialog.component.html',
    styleUrl: './item-attachments-dialog.component.scss',
  })
  ```

#### 8. `SmartSearchDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/smart-search-dialog/`
- **TypeScript:** `smart-search-dialog.component.ts`
- **New Template File:** `smart-search-dialog.component.html`
- **New Style File:** `smart-search-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-smart-search-dialog',
    templateUrl: './smart-search-dialog.component.html',
    styleUrl: './smart-search-dialog.component.scss',
  })
  ```

#### 9. `RapidIntakeDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/rapid-intake-dialog/`
- **TypeScript:** `rapid-intake-dialog.component.ts`
- **New Template File:** `rapid-intake-dialog.component.html`
- **New Style File:** `rapid-intake-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-rapid-intake-dialog',
    templateUrl: './rapid-intake-dialog.component.html',
    styleUrl: './rapid-intake-dialog.component.scss',
  })
  ```

#### 10. `ScannerDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/scanner-dialog/`
- **TypeScript:** `scanner-dialog.component.ts`
- **New Template File:** `scanner-dialog.component.html`
- **New Style File:** `scanner-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-scanner-dialog',
    templateUrl: './scanner-dialog.component.html',
    styleUrl: './scanner-dialog.component.scss',
  })
  ```

---

### Group 3: Operations, Labels & Lifecycle Dialogs (5 Components)

#### 11. `CheckoutReturnDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/checkout-return-dialog/`
- **TypeScript:** `checkout-return-dialog.component.ts`
- **New Template File:** `checkout-return-dialog.component.html`
- **New Style File:** `checkout-return-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-checkout-return-dialog',
    templateUrl: './checkout-return-dialog.component.html',
    styleUrl: './checkout-return-dialog.component.scss',
  })
  ```

#### 12. `LoadoutsDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/loadouts-dialog/`
- **TypeScript:** `loadouts-dialog.component.ts`
- **New Template File:** `loadouts-dialog.component.html`
- **New Style File:** `loadouts-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-loadouts-dialog',
    templateUrl: './loadouts-dialog.component.html',
    styleUrl: './loadouts-dialog.component.scss',
  })
  ```

#### 13. `LabelGeneratorDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/label-generator-dialog/`
- **TypeScript:** `label-generator-dialog.component.ts`
- **New Template File:** `label-generator-dialog.component.html`
- **New Style File:** `label-generator-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-label-generator-dialog',
    templateUrl: './label-generator-dialog.component.html',
    styleUrl: './label-generator-dialog.component.scss',
  })
  ```

#### 14. `DeclutterGraveyardDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/declutter-graveyard-dialog/`
- **TypeScript:** `declutter-graveyard-dialog.component.ts`
- **New Template File:** `declutter-graveyard-dialog.component.html`
- **New Style File:** `declutter-graveyard-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-declutter-graveyard-dialog',
    templateUrl: './declutter-graveyard-dialog.component.html',
    styleUrl: './declutter-graveyard-dialog.component.scss',
  })
  ```

#### 15. `StageArchiveDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/stage-archive-dialog/`
- **TypeScript:** `stage-archive-dialog.component.ts`
- **New Template File:** `stage-archive-dialog.component.html`
- **New Style File:** `stage-archive-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-stage-archive-dialog',
    templateUrl: './stage-archive-dialog.component.html',
    styleUrl: './stage-archive-dialog.component.scss',
  })
  ```

---

### Group 4: Maintenance, Vault & Admin Dialogs (4 Components)

#### 16. `MaintenanceDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/maintenance-dialog/`
- **TypeScript:** `maintenance-dialog.component.ts`
- **New Template File:** `maintenance-dialog.component.html`
- **New Style File:** `maintenance-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-maintenance-dialog',
    templateUrl: './maintenance-dialog.component.html',
    styleUrl: './maintenance-dialog.component.scss',
  })
  ```

#### 17. `ActionCenterDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/action-center-dialog/`
- **TypeScript:** `action-center-dialog.component.ts`
- **New Template File:** `action-center-dialog.component.html`
- **New Style File:** `action-center-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-action-center-dialog',
    templateUrl: './action-center-dialog.component.html',
    styleUrl: './action-center-dialog.component.scss',
  })
  ```

#### 18. `InsuranceExportDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/insurance-export-dialog/`
- **TypeScript:** `insurance-export-dialog.component.ts`
- **New Template File:** `insurance-export-dialog.component.html`
- **New Style File:** `insurance-export-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-insurance-export-dialog',
    templateUrl: './insurance-export-dialog.component.html',
    styleUrl: './insurance-export-dialog.component.scss',
  })
  ```

#### 19. `ImportExportDialogComponent`
- **Location:** `WhereHouse.Client/src/app/features/dashboard/import-export-dialog/`
- **TypeScript:** `import-export-dialog.component.ts`
- **New Template File:** `import-export-dialog.component.html`
- **New Style File:** `import-export-dialog.component.scss`
- **Update Decorator:**
  ```typescript
  @Component({
    imports: [...],
    selector: 'app-import-export-dialog',
    templateUrl: './import-export-dialog.component.html',
    styleUrl: './import-export-dialog.component.scss',
  })
  ```

---

## 3. Step-by-Step Execution Checklist

- [ ] **Task 1: Spatial Hierarchy & Location Dialogs (5 components)**
  - Separate `location-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `location-attachments-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `move-location-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `confirm-delete-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `category-manager-dialog` into `.html`, `.scss`, and update `.ts`
  - Verify build & unit tests for Group 1:
    ```powershell
    npm test --prefix WhereHouse.Client -- --watch=false
    ```

- [ ] **Task 2: Item Management & Inspection Dialogs (5 components)**
  - Separate `item-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `item-attachments-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `smart-search-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `rapid-intake-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `scanner-dialog` into `.html`, `.scss`, and update `.ts`
  - Verify build & unit tests for Group 2:
    ```powershell
    npm test --prefix WhereHouse.Client -- --watch=false
    ```

- [ ] **Task 3: Operations, Labels & Lifecycle Dialogs (5 components)**
  - Separate `checkout-return-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `loadouts-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `label-generator-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `declutter-graveyard-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `stage-archive-dialog` into `.html`, `.scss`, and update `.ts`
  - Verify build & unit tests for Group 3:
    ```powershell
    npm test --prefix WhereHouse.Client -- --watch=false
    ```

- [ ] **Task 4: Maintenance, Vault & Admin Dialogs (4 components)**
  - Separate `maintenance-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `action-center-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `insurance-export-dialog` into `.html`, `.scss`, and update `.ts`
  - Separate `import-export-dialog` into `.html`, `.scss`, and update `.ts`
  - Verify build & unit tests for Group 4:
    ```powershell
    npm test --prefix WhereHouse.Client -- --watch=false
    ```

- [ ] **Task 5: Comprehensive Full-Suite Verification & Formatting**
  - Run Angular linter and fix any whitespace issues:
    ```powershell
    npm run lint --prefix WhereHouse.Client
    ```
  - Run Angular production build:
    ```powershell
    npm run build --prefix WhereHouse.Client
    ```
  - Run full Angular unit test suite (208 tests):
    ```powershell
    npm test --prefix WhereHouse.Client -- --watch=false
    ```
  - Run backend unit and integration tests (123 tests):
    ```powershell
    pwsh -NoProfile -Command "Get-Process -Name 'WhereHouse*','testhost*' -ErrorAction SilentlyContinue | Stop-Process -Force; dotnet test Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj; dotnet test Tests/WhereHouse.Infrastructure.UnitTests/WhereHouse.Infrastructure.UnitTests.csproj; dotnet test Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj"
    ```
  - Run full Playwright E2E suite (65 tests across all 16 suites):
    ```powershell
    pwsh -NoProfile -Command "Get-Process -Name 'WhereHouse*','testhost*' -ErrorAction SilentlyContinue | Stop-Process -Force; dotnet test Tests/WhereHouse.Client.E2ETests/WhereHouse.Client.E2ETests.csproj"
    ```
  - Format repository with CSharpier:
    ```powershell
    dotnet csharpier format .
    ```
  - Verify `.agents/rules/frontend-angular.md` rule is updated.
  - Mark plan status as `[x] Completed`.
