# Phase 10: Responsive UX, Split-Pane Data Table, Bulk Actions, Tree Drag-and-Drop & Scheduled Digest Automation

> **Branch:** `feature/phase-10-responsive-ux-bulk-actions-and-scheduled-digests`
> **Status:** [x] Completed
> **PRD Reference:** `docs/prd.md` — Sections 4.1.2 (`Container Relocation Inheritance`), 4.3.3 (`Built-In Label Sheet Generator`), 4.8.2 (`"Secret / Gift Mode" Privacy`), 4.8.3 (`Scheduled Weekly Household Digest & Real-Time Triggers`), and Section 5 (`UX & Responsive Design Principles`)
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

This phase closes out all remaining UX, bulk workflow, and background automation specifications from **PRD Section 5 (UX & Responsive Design Principles)** and **Section 4.8.3 (Scheduled Weekly Digest & Real-Time Triggers)**:

1. **Batch Item Operations API (`IItemService.BulkUpdateItemsAsync`, `POST /api/items/bulk-update`, PRD Section 5):**
   - Enables multi-item operations from the desktop split-pane data table and card grid in a single atomic transaction:
     - **Bulk Move:** Relocates all selected items to a target `HomeLocationId` (or root when `UpdateHomeLocation = true` and `TargetHomeLocationId = null`), updating `LastTouchedAt`.
     - **Bulk Tagging:** Appends `AddTags` and/or removes `RemoveTags` across all selected items (case-insensitive deduplication).
     - **Bulk Category Assignment:** Updates `CategoryId` across all selected items when `UpdateCategory = true`.
   - Enforces strict **"Secret / Gift Mode" (`IsPrivate`)** boundaries: non-owners cannot modify another user's private items or move items into another user's private location (`403 Forbidden`).

2. **Automated Scheduled Weekly Digest & Real-Time Alert Background Worker (`IActionCenterService.ProcessScheduledNotificationsAsync`, `WeeklyDigestBackgroundService`, PRD 4.8.3):**
   - Adds `ProcessScheduledNotificationsAsync(DateTimeOffset utcNow, CancellationToken cancellationToken = default)` to `IActionCenterService`:
     - Evaluates all enabled `NotificationChannel`s across the household where `EnableWeeklyDigest == true`, `DigestDayOfWeek == utcNow.DayOfWeek`, and `DigestHourUtc == utcNow.Hour`.
     - Enforces a 20-hour idempotency cooldown (`LastTriggeredAt == null || LastTriggeredAt <= utcNow.AddHours(-20)`) so channels are never dispatched more than once per scheduled window.
     - Evaluates channels with real-time alert triggers (`NotifyOnOverdueLoans`, `NotifyOnMaintenanceDue`, `NotifyOnExpiringWarranties`, `NotifyOnLowStock`) when matching alerts exist and the channel has not been triggered within the last 20 hours.
     - Preserves strict `IsPrivate` isolation: shared household channels (`IsSharedHouseholdChannel == true`) strip private items and private containers from outbound payloads.
   - Registers `WeeklyDigestBackgroundService : BackgroundService` in `WhereHouse.API/Hosting/WeeklyDigestBackgroundService.cs` to periodically evaluate scheduled channels in production.

3. **Desktop Split-Pane Data Table, Multi-Select Bulk Action Bar, Location Tree Drag-and-Drop & Mobile Bottom Navigation (`WhereHouse.Client`, PRD Section 5):**
   - **Card Grid vs. Data Table Toggle (`'grid' | 'table'`):** Adds a view switcher in the `DashboardComponent` workspace toolbar to toggle between the visual `"X-Ray" Card Grid` and a dense, filterable **Data Table View** with multi-select checkboxes (`Select All` + per-row checkboxes).
   - **Contextual Bulk Actions Toolbar:** Appears when 1 or more items are selected (`selectedItemIds().size > 0`), offering 1-click **Bulk Move to Location**, **Bulk Add/Remove Tags**, **Bulk Set Category**, **Bulk Print QR Labels** (launching `LabelGeneratorDialogComponent` pre-populated with selected items), and **Bulk Add to Project Cart**.
   - **Location Tree Drag-and-Drop Reparenting:** Enables dragging any location/container node in the left sidebar tree and dropping it onto another tree node (or root drop zone) to reparent via `locationService.moveNode(draggedId, { newParentId })`.
   - **Mobile Bottom Navigation Bar & Slide-Over Location Tree Drawer (`<= 768px`):**
     - Converts `.location-tree-sidebar` on mobile viewports from `display: none` into an accessible slide-over drawer with a backdrop overlay when `sidebarOpen()` is toggled.
     - Adds a fixed **Mobile Bottom Navigation Bar** with 5 thumb-friendly buttons: **Locations**, **Rapid Intake**, a prominent raised center **Scan QR / Barcode** button, **Project Cart** (with live count badge), and **Action Center** (with live alert badge).

---

## 2. Domain, Infrastructure & Database Design (`WhereHouse.Core`, `WhereHouse.Data`, `WhereHouse.API`)

### 2.1 No Schema Migration Required
- Existing `InventoryItem`, `LocationNode`, `NotificationChannel`, and `NotificationDeliveryLog` tables already contain all columns needed (`HomeLocationId`, `Tags`, `CategoryId`, `LastTouchedAt`, `EnableWeeklyDigest`, `DigestDayOfWeek`, `DigestHourUtc`, `LastTriggeredAt`, `LastDeliverySuccess`, `LastDeliveryError`).

---

### 2.2 Bulk Item Contracts (`WhereHouse.Core/Items/ItemModels.cs` & `IItemService.cs`)

1. **Update `WhereHouse.Core/Items/ItemModels.cs`** — append the following records:
   ```csharp
   public sealed record BulkUpdateItemsRequest(
       [Required, MinLength(1)] IReadOnlyList<Guid> ItemIds,
       bool UpdateHomeLocation = false,
       Guid? TargetHomeLocationId = null,
       bool UpdateCategory = false,
       Guid? TargetCategoryId = null,
       IReadOnlyList<string>? AddTags = null,
       IReadOnlyList<string>? RemoveTags = null
   );

   public sealed record BulkUpdateItemsResultDto(
       int UpdatedCount,
       IReadOnlyList<ItemDto> UpdatedItems
   );
   ```

2. **Update `WhereHouse.Core/Items/IItemService.cs`** — add method signature:
   ```csharp
   Task<BulkUpdateItemsResultDto> BulkUpdateItemsAsync(
       Guid userId,
       BulkUpdateItemsRequest request,
       CancellationToken cancellationToken = default
   );
   ```

---

### 2.3 Scheduled Notification Contracts (`WhereHouse.Core/ActionCenter/IActionCenterService.cs`)

1. **Update `WhereHouse.Core/ActionCenter/IActionCenterService.cs`** — add method signature:
   ```csharp
   Task<NotificationDispatchResultDto> ProcessScheduledNotificationsAsync(
       DateTimeOffset utcNow,
       CancellationToken cancellationToken = default
   );
   ```

---

### 2.4 Service Business Logic & Privacy Invariants (`WhereHouse.Data/Services/`)

#### A. `ItemService.BulkUpdateItemsAsync` (`WhereHouse.Data/Services/ItemService.cs`)
- Validate `request.ItemIds` is non-null and contains at least 1 distinct `Guid`; otherwise throw `ArgumentException("At least one item ID must be provided.")`.
- Load `allLocations` dictionary (`AsNoTracking()`).
- If `request.UpdateHomeLocation` is `true` and `request.TargetHomeLocationId.HasValue`:
  - Verify target location exists in `allLocations`; if not, throw `NotFoundException("Target home location not found.")`.
  - Verify `IsLocationAccessible(targetLoc, userId, allLocations)`; if not, throw `ForbiddenException()`.
- If `request.UpdateCategory` is `true` and `request.TargetCategoryId.HasValue`:
  - Verify category exists in `dbContext.Categories`; if not, throw `NotFoundException("Target category not found.")`.
- Load all matching `InventoryItem` entities (`Include` navigation properties needed for `MapToDto`) where `distinctIds.Contains(i.Id)`.
- If `items.Count != distinctIds.Count`, throw `NotFoundException("One or more selected items were not found.")`.
- Verify every loaded item satisfies `IsItemAccessible(item, userId, allLocations)`; if any item is private to another user, throw `ForbiddenException()`.
- For each item:
  - If `request.UpdateHomeLocation`: set `item.HomeLocationId = request.TargetHomeLocationId`.
  - If `request.UpdateCategory`: set `item.CategoryId = request.TargetCategoryId`.
  - If `request.AddTags is { Count: > 0 }` or `request.RemoveTags is { Count: > 0 }`:
    - Parse existing `item.Tags` (comma-separated string) into a case-insensitive list.
    - Add trimmed non-empty tags from `request.AddTags` if not already present (case-insensitive).
    - Remove any tags matching `request.RemoveTags` (case-insensitive).
    - Set `item.Tags = updatedTags.Count > 0 ? string.Join(", ", updatedTags) : null`.
  - Update `item.LastTouchedAt = DateTimeOffset.UtcNow`.
- Save changes (`await dbContext.SaveChangesAsync(cancellationToken)`), reload/resolve navigation names if needed, and return `new BulkUpdateItemsResultDto(items.Count, updatedDtos)`.

#### B. `ActionCenterService.ProcessScheduledNotificationsAsync` (`WhereHouse.Data/Services/ActionCenterService.cs`)
- Query all enabled `NotificationChannel`s (`Where(c => c.IsEnabled)`).
- Filter to channels eligible for scheduled dispatch at `utcNow`:
  - Cooldown check: `!c.LastTriggeredAt.HasValue || c.LastTriggeredAt.Value <= utcNow.AddHours(-20)`.
  - Schedule/Trigger match:
    - Either `isWeeklyScheduleMatch`: `c.EnableWeeklyDigest && c.DigestDayOfWeek == utcNow.DayOfWeek && c.DigestHourUtc == utcNow.Hour`
    - Or `hasRealTimeTrigger`: `c.NotifyOnOverdueLoans || c.NotifyOnMaintenanceDue || c.NotifyOnExpiringWarranties || c.NotifyOnLowStock`
- For each eligible channel:
  - Build the channel owner's `ActionCenterOverviewDto` (for `c.IsSharedHouseholdChannel == true`, filter out `IsPrivate` items and private locations using the same shared-channel privacy helper used in `SendDigestAsync`).
  - Determine if the channel should fire:
    - If `isWeeklyScheduleMatch` and `overview.TotalAlertsCount > 0`, dispatch with `NotificationEventType.WeeklyDigest`.
    - Else if `!isWeeklyScheduleMatch` and any enabled real-time trigger has matching alerts (`(c.NotifyOnOverdueLoans && overview.OverdueLoansCount > 0) || (c.NotifyOnMaintenanceDue && overview.MaintenanceDueCount > 0) || (c.NotifyOnExpiringWarranties && overview.ExpiringCoverageCount > 0) || (c.NotifyOnLowStock && overview.LowStockCount > 0)`), dispatch with the corresponding primary `NotificationEventType` (`OverdueLoanAlert`, `MaintenanceDueAlert`, `ExpiringCoverageAlert`, or `LowStockAlert`).
  - Record `NotificationDeliveryLog` and update `c.LastTriggeredAt = utcNow`, `c.LastDeliverySuccess`, and `c.LastDeliveryError`.
- Save changes and return `NotificationDispatchResultDto`.

#### C. `WeeklyDigestBackgroundService` (`WhereHouse.API/Hosting/WeeklyDigestBackgroundService.cs`)
- Inherits from `BackgroundService`.
- Injects `IServiceScopeFactory` and `ILogger<WeeklyDigestBackgroundService>`.
- Uses a `PeriodicTimer(TimeSpan.FromMinutes(15))` loop inside `ExecuteAsync(CancellationToken stoppingToken)` to create a scope, resolve `IActionCenterService`, and invoke `ProcessScheduledNotificationsAsync(DateTimeOffset.UtcNow, stoppingToken)`.
- Catches `OperationCanceledException` cleanly on shutdown and logs any unexpected exceptions without crashing the host.
- Register `builder.Services.AddHostedService<WeeklyDigestBackgroundService>();` in `WhereHouse.API/Program.cs`.

---

## 3. API Endpoints (`WhereHouse.API/Controllers/`)

| Controller | Verb | Route (`/api/...`) | Request Body / Query | Response (`200`) | Error Cases (`400`/`403`/`404`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ItemsController` | `POST` | `/items/bulk-update` | `BulkUpdateItemsRequest` | `200 OK` (`BulkUpdateItemsResultDto`) | `400` if `ItemIds` empty, `403` if private item/location owned by another user, `404` if item/location/category not found |
| `ActionCenterController` | `POST` | `/action-center/digest/process-scheduled` | `[FromQuery] DateTimeOffset? asOfUtc = null` | `200 OK` (`NotificationDispatchResultDto`) | `401` if unauthenticated |

---

## 4. Angular Frontend Design (`WhereHouse.Client`)

### 4.1 Models & Services (`src/app/core/`)

1. **Update `src/app/core/models/item.models.ts`:**
   - Add `BulkUpdateItemsRequest` and `BulkUpdateItemsResultDto`:
     ```typescript
     export interface BulkUpdateItemsRequest {
       itemIds: string[];
       updateHomeLocation?: boolean;
       targetHomeLocationId?: string | null;
       updateCategory?: boolean;
       targetCategoryId?: string | null;
       addTags?: string[] | null;
       removeTags?: string[] | null;
     }

     export interface BulkUpdateItemsResultDto {
       updatedCount: number;
       updatedItems: ItemDto[];
     }
     ```

2. **Update `src/app/core/services/item/item.service.ts` (& `.spec.ts`):**
   - Add `bulkUpdateItems(request: BulkUpdateItemsRequest): Observable<BulkUpdateItemsResultDto>` calling `POST /api/items/bulk-update` and invalidating the item cache.

---

### 4.2 Dashboard Split-Pane Table, Bulk Actions, Tree Drag-and-Drop & Mobile Nav (`src/app/features/dashboard/`)

1. **Update `DashboardComponent` (`dashboard.component.ts`, `.html`, `.scss`, `.spec.ts`):**
   - **Signals & State:**
     - `readonly itemViewMode = signal<'grid' | 'table'>('grid');`
     - `readonly selectedItemIds = signal<Set<string>>(new Set());`
     - `readonly selectedItemsCount = computed(() => this.selectedItemIds().size);`
     - `readonly allDisplayedItemsSelected = computed(() => { const displayed = this.displayedItems(); const selected = this.selectedItemIds(); return displayed.length > 0 && displayed.every((i) => selected.has(i.id)); });`
     - `readonly draggedNodeId = signal<string | null>(null);`
     - `readonly dragOverNodeId = signal<string | null>(null);`
     - `readonly bulkTagInput = signal<string>('');`
     - `readonly showBulkTagBar = signal<boolean>(false);`
     - `readonly showBulkMoveBar = signal<boolean>(false);`
     - `readonly bulkTargetLocationId = signal<string | null>(null);`
   - **View Mode Switcher & Multi-Select Table (`dashboard.component.html`):**
     - In `.section-toolbar`, add a view toggle button group (`grid_view` Card Grid vs `table_rows` Data Table).
     - When `itemViewMode() === 'table'`, render `<div class="items-table-container"><table class="items-data-table">`:
       - Columns: Checkbox (`Select All`), `Short Code`, `Name & Brand/Model`, `Type / Qty`, `Home Location`, `Category`, `Status`, `Tags`, and `Actions` (`Checkout/Return`, `Add to Cart`, `Edit`, `Print Label`).
     - In Card Grid mode (`itemViewMode() === 'grid'`), also include a subtle selection checkbox on each item card so bulk actions work in both Grid and Table views.
   - **Contextual Bulk Actions Bar (`.bulk-actions-bar`):**
     - Visible whenever `selectedItemsCount() > 0`:
       - Shows `"{{ selectedItemsCount() }} item(s) selected"` + **"Select All Visible"** / **"Clear Selection"**.
       - **"Bulk Move"** button (`drive_file_move` icon): toggles inline location selector (`bulkTargetLocationId`) + **"Apply Move"** button calling `executeBulkMove()`.
       - **"Bulk Tag"** button (`label` icon): toggles inline tag input (`bulkTagInput`) with **"Add Tag"** and **"Remove Tag"** buttons calling `executeBulkTag(mode)`.
       - **"Bulk Print Labels"** button (`print` icon): calls `bulkPrintSelectedItemLabels()` to open `LabelGeneratorDialogComponent` with all selected items mapped to `PrintableLabelItem[]`.
       - **"Bulk Add to Cart"** button (`add_shopping_cart` icon): calls `bulkAddSelectedToCart()`.
   - **Location Tree Drag-and-Drop Reparenting (`#treeNodeTemplate`):**
     - Add `draggable="true"`, `(dragstart)="onTreeNodeDragStart($event, node)"`, `(dragover)="onTreeNodeDragOver($event, node)"`, `(dragleave)="onTreeNodeDragLeave($event, node)"`, `(drop)="onTreeNodeDrop($event, node)"`, and `(dragend)="onTreeNodeDragEnd()"` on `.tree-node-row`.
     - Add drop support on the `"All Root Locations"` button to allow dragging a nested node back to the root (`newParentId: null`).
     - `dropNodeOnTarget(draggedId: string, targetParentId: string | null)` validates `draggedId !== targetParentId` and invokes `locationService.moveNode(draggedId, { newParentId: targetParentId })`, refreshing the tree and showing a confirmation snackbar.
   - **Mobile Bottom Navigation Bar & Slide-Over Drawer (`<= 768px`):**
     - Replace `.location-tree-sidebar { display: none; }` in `@media (max-width: 768px)` with a fixed slide-over drawer (`position: fixed; top: 56px; bottom: 64px; left: 0; width: 280px; z-index: 200`) and a clickable `.mobile-sidebar-backdrop` when `sidebarOpen()` is true on mobile.
     - Add `<nav class="mobile-bottom-nav" aria-label="Mobile Primary Navigation">` at the bottom of `.dashboard-layout`:
       1. **Locations** (`account_tree` icon) — toggles `sidebarOpen()`.
       2. **Rapid Intake** (`bolt` icon) — opens `openRapidIntakeDialog(selectedNodeId() ?? undefined)`.
       3. **Scan QR** (`qr_code_scanner` icon, prominent center `.scan-fab-btn`) — opens `openScannerDialog()`.
       4. **Cart & Loadouts** (`shopping_cart` icon + `cartCount()` badge) — opens `openLoadoutsDialog('cart')`.
       5. **Action Center** (`notifications_active` icon + `actionCenterAlertCount()` badge) — opens `openActionCenterDialog()`.

---

## 5. Step-by-Step Execution Checklist (For Implementation Agent)

- [x] **Task 1: Backend Core, Data Services & Background Worker (`WhereHouse.Core`, `WhereHouse.Data`, `WhereHouse.API`)**
  - Update `WhereHouse.Core/Items/ItemModels.cs` and `WhereHouse.Core/Items/IItemService.cs` with `BulkUpdateItemsRequest`, `BulkUpdateItemsResultDto`, and `BulkUpdateItemsAsync`.
  - Implement `BulkUpdateItemsAsync` in `WhereHouse.Data/Services/ItemService.cs` with `IsPrivate` ownership enforcement and `LastTouchedAt` updates.
  - Update `WhereHouse.Core/ActionCenter/IActionCenterService.cs` and `WhereHouse.Data/Services/ActionCenterService.cs` with `ProcessScheduledNotificationsAsync(DateTimeOffset utcNow, CancellationToken cancellationToken = default)`.
  - Create `WhereHouse.API/Hosting/WeeklyDigestBackgroundService.cs` and register `builder.Services.AddHostedService<WeeklyDigestBackgroundService>();` in `WhereHouse.API/Program.cs`.
  - Run unit tests:
    ```powershell
    dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
    dotnet test --project Tests/WhereHouse.Infrastructure.UnitTests/WhereHouse.Infrastructure.UnitTests.csproj
    ```

- [x] **Task 2: API Endpoints & Integration Tests (`WhereHouse.API` & `Tests/WhereHouse.API.IntegrationTests`)**
  - Add `POST /api/items/bulk-update` to `WhereHouse.API/Controllers/ItemsController.cs`.
  - Add `POST /api/action-center/digest/process-scheduled` to `WhereHouse.API/Controllers/ActionCenterController.cs`.
  - Create `Tests/WhereHouse.API.IntegrationTests/Phase10BulkActionsAndScheduledDigestsIntegrationTests.cs` covering:
    1. **Bulk Item Move, Tagging & Category Assignment (`PRD Section 5`):** Creating multiple items, invoking `POST /api/items/bulk-update` to move them to a new bin, add/remove tags, and assign a category, and verifying all items reflect the updated location path, tags, category, and `LastTouchedAt`.
    2. **Bulk Update Privacy Isolation (`PRD 4.8.2`):** Verifying User B receives `403 Forbidden` when attempting to bulk-update User A's private item or bulk-move items into User A's private container.
    3. **Scheduled Weekly Digest & Real-Time Trigger Automation (`PRD 4.8.3`):** Creating a channel configured for `DigestDayOfWeek = DayOfWeek.Sunday, DigestHourUtc = 9`, invoking `POST /api/action-center/digest/process-scheduled?asOfUtc=2026-10-18T09:15:00Z`, verifying the digest dispatches and logs once, and verifying a second call within 20 hours (`2026-10-18T09:45:00Z`) skips duplicate delivery (idempotency guard).
  - Run integration tests until 100% green:
    ```powershell
    dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj
    ```

- [x] **Task 3: Angular Client & Unit Tests (`WhereHouse.Client`)**
  - Update `src/app/core/models/item.models.ts` and `src/app/core/services/item/item.service.ts` (& `.spec.ts`) with `bulkUpdateItems`.
  - Update `DashboardComponent` (`dashboard.component.ts`, `.html`, `.scss`, `.spec.ts`) with:
    - Grid vs. Table view mode switcher (`itemViewMode`) and sortable/selectable Data Table.
    - Multi-select Bulk Actions bar (Bulk Move, Bulk Tag, Bulk Print Labels, Bulk Add to Cart).
    - Sidebar Location Tree drag-and-drop reparenting (`dropNodeOnTarget`).
    - Mobile bottom navigation bar (`.mobile-bottom-nav`) and mobile slide-over location tree drawer.
  - Run frontend lint, build, and unit tests in `WhereHouse.Client` until 100% green:
    ```powershell
    npm run lint
    npm run build
    npm test -- --watch=false
    ```

- [x] **Task 4: E2E Verification & Final Formatting**
  - Run E2E test suite to verify zero regressions:
    ```powershell
    dotnet test --project Tests/WhereHouse.Client.E2ETests/WhereHouse.Client.E2ETests.csproj
    ```
  - Format all backend and frontend files:
    ```powershell
    dotnet csharpier format .
    # In WhereHouse.Client:
    npm run format
    npm run lint:fix
    ```
  - Update `docs/plans/phase-10-responsive-ux-bulk-actions-and-scheduled-digests.md` status to `[x] Completed`.
