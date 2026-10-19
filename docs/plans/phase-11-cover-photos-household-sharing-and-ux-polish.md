# Phase 11: Container Cover Photos, Household Sharing, Responsive UX Polish & Full Playwright E2E Suite

## 1. Scope & Milestone Mapping

- **PRD Milestone:** Final PRD Completion Polish across Milestones 1–4 (`PRD Section 2`, `4.1.3`, `4.2.1`, `4.6.2`, `4.8.1`, `4.8.2`) + Comprehensive UI/UX Bugfixes, Responsive Viewport Optimization, Angular Material Datepickers, and Full-App Playwright E2E Test Suite.
- **Included Features & Fixes:**
  1. **Fix Declutter Dialog Infinite API Loop (`GET /api/lifecycle/staged?includeSubtreeLocations=true`) & Filter Chip Re-render Loops:**
     - Fix `DeclutterGraveyardDialogComponent` where `<mat-chip-option [selected]="..." (selectionChange)="...">` inside an `@if (isLoading()) ... @else` block re-emits `selectionChange` every time `isLoading` flips from `true` to `false`, causing an endless HTTP request loop on `/api/lifecycle/staged`, `/api/lifecycle/dust-collectors`, and `/api/lifecycle/graveyard`.
     - Replace `(selectionChange)` on `<mat-chip-option>` with `(click)` handlers and no-op equality guards in `DeclutterGraveyardDialogComponent`, `MaintenanceDialogComponent`, and `SmartSearchDialogComponent`.
  2. **Responsive Top Navbar & Viewport Optimization (Mobile, Tablet, Narrow Desktop & Full Desktop):**
     - Eliminate the horizontal scrollbar caused by 13 side-by-side buttons in `.top-actions` on `DashboardComponent`.
     - Keep primary high-frequency actions directly in `.top-actions` (**Add**, **Rapid Intake**, **Scan QR**, **Cart**, **Action Center**, **Tools & Vault** menu, **Theme**, **User**) and consolidate secondary management/vault dialogs (**Loadouts & Loans**, **Print Labels**, **Categories**, **Declutter & Graveyard**, **Maintenance**, **Insurance Claim**, **Import / Export**) into a clean **Tools & Vault** (`[matMenuTriggerFor]="toolsMenu"`) dropdown menu.
     - Add responsive breakpoints (`1280px`, `1024px`, `768px`) and `overflow-x: clip` / `min-width: 0` rules so no horizontal scrollbar appears at any viewport width (`360px` to `2560px`).
  3. **Fix Oversized Button Icons in Empty States:**
     - Scope `.empty-state > mat-icon` (direct child selector) in `dashboard.component.scss`, `action-center-dialog.component.ts`, and `insurance-export-dialog.component.ts` so `<mat-icon>` inside `.empty-actions` buttons (`"Add Item"`, `"Add Sub-Location"`, `"Add Container"`) renders at standard button icon size (`18px`) instead of `48px`.
  4. **Fix Missing Space Between `"Smart Search"` and `"Ctrl+K"`:**
     - Add `margin-left: 0.45rem` on `.kbd-pill` in `dashboard.component.scss` so `"Smart Search"` and `"Ctrl+K"` have proper visual separation inside `.mdc-button__label`.
  5. **Fix Container Body & Lid Color Swatches Showing Raw Hex Codes (`LocationDialogComponent`):**
     - Remove the unstyled `<span class="visually-hidden">{{ c }}</span>` text inside `.color-swatch-btn` that rendered raw hex strings (`#1f2937`, `#eab308`, etc.) over the 24px circular swatch buttons.
     - Use named color swatch metadata (`{ hex, name }`) with `matTooltip`, `aria-label`, a clean selected `<mat-icon class="swatch-check">check</mat-icon>`, and a native `<input type="color">` custom color picker button + clear button.
  6. **Convert Date Inputs to Angular Material Datepicker (`MatDatepickerModule`):**
     - Register `provideNativeDateAdapter()` in `app.config.ts`.
     - Convert all `<input matInput type="date">` fields in `ItemDialogComponent` (`purchaseDate`, `returnWindowEndDate`, `warrantyExpirationDate`) and `CheckoutReturnDialogComponent` (`expectedReturnDate`) to `<input matInput [matDatepicker]="..." />` with `<mat-datepicker-toggle matIconSuffix>` and `<mat-datepicker>`.
  7. **Fix Overly Wide Dialogs (`CategoryManagerDialogComponent` & `LabelGeneratorDialogComponent`):**
     - **`CategoryManagerDialogComponent`:** Reduce dialog width to `680px` (`maxWidth: '95vw'`), tighten `.manager-layout` (`200px minmax(0, 1fr)`), and set `min-width: 0` on flex/grid form fields in `.template-item-row` so 3-field attribute template rows fit cleanly without stretching or overflowing.
     - **`LabelGeneratorDialogComponent`:** Reduce dialog width from `1080px` to `860px` (`maxWidth: '95vw'`), remove `width: 100vw; max-width: 1200px` from `.label-generator-container`, narrow `.controls-panel` to `310px`, and scale the on-screen preview sheet (`zoom: 0.65` in `@media screen`) while preserving exact physical inch dimensions in `@media print`.
  8. **Container & Location Cover Photos (`PRD 4.1.3`):**
     - Expose `CoverAttachmentId` on `LocationNodeDto`, add location photo upload/management from the dashboard (`LocationAttachmentsDialogComponent`), and render cover photo thumbnails on container/location cards and the selected location header.
  9. **Household User Directory & Multi-User Shared "Secret / Gift Mode" (`PRD Section 2 & 4.8.2`):**
     - Add `GET /api/auth/users` returning `IReadOnlyList<UserSummaryDto>`.
     - Add `SharedWithUserIdsJson` on `Item` (`SharedWithUserIds` on `ItemDto`, `CreateItemRequest`, `UpdateItemRequest`) + EF migration `AddItemSharedWithUsers` so private items are visible to both their owner and explicitly shared household members across all services, plus a multi-select share picker in `ItemDialogComponent` and an **Owner** faceted filter in `SmartSearchDialogComponent` (`PRD 4.8.1`).
  10. **Return Window & Warranty Quick Presets + Kit/Nested Component Visibility (`PRD 4.2.1 & 4.6.2`):**
      - Add quick-preset buttons (`+14d`, `+30d`, `+60d`, `+90d` and `+1 yr`, `+2 yr`, `+3 yr`, `+5 yr`) in `ItemDialogComponent` and render child component count/chips on `Kit` and `Nested` items in `DashboardComponent`.
  11. **Full-App Playwright E2E Test Suite (`Tests/WhereHouse.Client.E2ETests`):**
      - Build a self-contained Kestrel + SPA Playwright test harness (`WhereHouseE2EServerFixture`) and comprehensive E2E tests covering Auth/Setup, Responsive Viewports (verifying zero horizontal scrollbars), Locations/Containers (color swatches & cover photos), Categories & Items (Material Datepicker, presets, private sharing), Smart Search, Label Generator, and Declutter Dialog (verifying no infinite request loop).
- **Deferred to Future Phases:**
  - None — this completes 100% of `docs/prd.md` Milestones 1–4 and all user-reported polish items.

---

## 2. Database & Entity Changes (`WhereHouse.Data`)

### 2.1 Modify Entity: `WhereHouse.Data/Entities/Item.cs`
Add `SharedWithUserIdsJson` to `Item`:
```csharp
public bool IsPrivate { get; set; }

/// <summary>
/// Optional JSON array of household User IDs (Guid[]) allowed to view this item when IsPrivate is true.
/// </summary>
public string? SharedWithUserIdsJson { get; set; }
```

### 2.2 Modify Configuration: `WhereHouse.Data/Configurations/ItemConfiguration.cs`
Add column configuration for `SharedWithUserIdsJson`:
```csharp
builder.Property(x => x.SharedWithUserIdsJson).HasMaxLength(1000);
```

### 2.3 EF Core Migration
Run from repository root:
```powershell
dotnet ef migrations add AddItemSharedWithUsers --project WhereHouse.Data --startup-project WhereHouse.API
```

---

## 3. Core Contracts & Models (`WhereHouse.Core`)

### 3.1 New DTO: `WhereHouse.Core/Authentication/UserSummaryDto.cs`
```csharp
namespace WhereHouse.Core.Authentication;

public sealed record UserSummaryDto(
    Guid Id,
    string Username,
    string DisplayName
);
```

### 3.2 Update Interface: `WhereHouse.Core/Authentication/IAuthService.cs`
Add household user directory method:
```csharp
Task<IReadOnlyList<UserSummaryDto>> GetHouseholdUsersAsync(
    CancellationToken cancellationToken = default
);
```

### 3.3 Update Location DTO: `WhereHouse.Core/Locations/LocationDtos.cs`
Add `string? CoverAttachmentId = null` to `LocationNodeDto`:
```csharp
public sealed record LocationNodeDto(
    Guid Id,
    string Name,
    string? Description,
    string ShortCode,
    LocationNodeType NodeType,
    string? ContainerStyle,
    string? PrimaryColor,
    string? AccentColor,
    bool IsTransparent,
    Guid? ParentLocationId,
    string FullPath,
    IReadOnlyList<LocationBreadcrumbDto> Breadcrumbs,
    int DirectChildCount,
    int DirectItemCount,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    string? CoverAttachmentId = null
);
```

### 3.4 Update Item DTOs: `WhereHouse.Core/Items/ItemDtos.cs`
1. Add `IReadOnlyList<Guid>? SharedWithUserIds = null` as an optional trailing parameter on `ItemDto`:
```csharp
public sealed record ItemDto(
    Guid Id,
    string Name,
    string? Description,
    string ShortCode,
    ItemType ItemType,
    ItemStatus Status,
    Guid? CategoryId,
    string? CategoryName,
    string? CategoryIcon,
    string? CategoryColor,
    Guid HomeLocationId,
    string HomeLocationName,
    string HomeLocationFullPath,
    Guid? CurrentLocationId,
    string? CurrentLocationName,
    string? CurrentLocationFullPath,
    bool IsOutOfPlace,
    Guid? ParentItemId,
    string? ParentItemName,
    decimal CurrentQuantity,
    decimal? MinQuantity,
    string? Unit,
    bool IsLowStock,
    string? Brand,
    string? ModelNumber,
    string? SerialNumber,
    string? BarcodeUpc,
    DateTimeOffset? PurchaseDate,
    decimal? PurchasePrice,
    decimal? EstimatedReplacementValue,
    string? Retailer,
    DateTimeOffset? ReturnWindowEndDate,
    DateTimeOffset? WarrantyExpirationDate,
    ItemCondition Condition,
    string? Notes,
    bool IsPrivate,
    Guid? OwnerUserId,
    string? OwnerDisplayName,
    IReadOnlyList<string> Tags,
    IReadOnlyDictionary<string, string?> CustomAttributes,
    string? CoverAttachmentId,
    int AttachmentCount,
    string? ActiveBorrowerName,
    DateTimeOffset? ActiveCheckoutExpectedReturnUtc,
    DateTimeOffset? ActiveCheckedOutAtUtc,
    DateTimeOffset? StagedAtUtc,
    decimal? SuggestedListingPrice,
    string? StagingNotes,
    ArchiveReason? ArchiveReason,
    DateTimeOffset? ArchivedAtUtc,
    string? ArchiveNotes,
    DateTimeOffset? LastUsedAtUtc,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    IReadOnlyList<Guid>? SharedWithUserIds = null
);
```
2. Add `IReadOnlyList<Guid>? SharedWithUserIds = null` to `CreateItemRequest` and `UpdateItemRequest`.

---

## 4. Backend Services & Controllers (`WhereHouse.Data` & `WhereHouse.API`)

### 4.1 `WhereHouse.Data/Services/AuthService.cs` & `WhereHouse.API/Controllers/AuthController.cs`
- Implement `GetHouseholdUsersAsync` in `AuthService`:
  - Query `_dbContext.Users.AsNoTracking().Where(u => u.IsActive).OrderBy(u => u.DisplayName).Select(u => new UserSummaryDto(u.Id, u.Username, u.DisplayName)).ToListAsync(cancellationToken)`.
- Add `GET /api/auth/users` in `AuthController`:
  ```csharp
  [Authorize]
  [HttpGet("users")]
  [ProducesResponseType<IReadOnlyList<UserSummaryDto>>(StatusCodes.Status200OK)]
  public async Task<ActionResult<IReadOnlyList<UserSummaryDto>>> GetUsers(
      CancellationToken cancellationToken
  )
  {
      var users = await _authService.GetHouseholdUsersAsync(cancellationToken);
      return Ok(users);
  }
  ```

### 4.2 `WhereHouse.Data/Services/LocationService.cs`
- In `GetTreeAsync`, `GetByIdAsync`, `GetByShortCodeAsync`, `CreateAsync`, `UpdateAsync`, and `MoveAsync`:
  - Query non-deleted attachments (`_dbContext.Attachments.AsNoTracking()`) where `LocationId` is in the loaded location IDs, ordered by `AttachmentType == AttachmentType.Photo ? 0 : 1`, then `CreatedAtUtc`.
  - Populate `CoverAttachmentId` (`Guid.ToString()`) on `LocationNodeDto`.

### 4.3 Shared Private Item Access Helper & `ItemService` (`WhereHouse.Data/Services/ItemService.cs`)
- Add static helpers in `ItemService`:
  - `SerializeSharedUserIds(IReadOnlyList<Guid>? userIds, bool isPrivate)`: returns `null` if `!isPrivate` or empty; otherwise serializes distinct non-empty `Guid`s as lowercase strings in JSON (`["guid1","guid2"]`).
  - `DeserializeSharedUserIds(string? json)`: deserializes `Guid` list safely (returns `[]` on null/invalid).
  - `CanUserAccessItem(Item item, Guid? currentUserId)`: returns `true` if `!item.IsPrivate`, OR `currentUserId.HasValue` and (`item.OwnerUserId == currentUserId.Value` || ` (item.SharedWithUserIdsJson != null && item.SharedWithUserIdsJson.Contains(currentUserId.Value.ToString(), StringComparison.OrdinalIgnoreCase))`).
- Update `ApplyPrivacyFilter(IQueryable<Item> query)` in `ItemService`, `SearchService`, `LifecycleService`, `MaintenanceService`, `InsuranceExportService`, `ActionCenterService`, `CheckoutService`, `LoadoutService`, and `DataPortabilityService`:
  ```csharp
  if (_userContext.UserId is { } currentUserId)
  {
      var userIdToken = $"\"{currentUserId.ToString().ToLowerInvariant()}\"";
      query = query.Where(i =>
          !i.IsPrivate
          || i.OwnerUserId == currentUserId
          || (i.SharedWithUserIdsJson != null && i.SharedWithUserIdsJson.Contains(userIdToken))
      );
  }
  else
  {
      query = query.Where(i => !i.IsPrivate);
  }
  ```
- In `ItemService.CreateAsync`, `UpdateAsync`, and `DuplicateAsync`:
  - Persist `SharedWithUserIdsJson = SerializeSharedUserIds(request.SharedWithUserIds, request.IsPrivate)`.
  - Map `SharedWithUserIds: DeserializeSharedUserIds(item.SharedWithUserIdsJson)` in `MapToDto`.

---

## 5. Frontend Implementation (`WhereHouse.Client`)

### 5.1 Fix Declutter Dialog Infinite API Loop & Chip Selection Loops
1. **`WhereHouse.Client/src/app/features/dashboard/declutter-graveyard-dialog/declutter-graveyard-dialog.component.ts`:**
   - Remove `(selectionChange)` from all `<mat-chip-option>` elements across Tab 1 (`Staged`), Tab 2 (`Dust Collector`), and Tab 3 (`Graveyard`), replacing them with `(click)` handlers:
     - Tab 1 (`staged`): `(click)="setStagedStatusFilter(null)"`, `(click)="setStagedStatusFilter(ItemStatuses.StagedToSell)"`, `(click)="setStagedStatusFilter(ItemStatuses.StagedToDonate)"`.
     - Tab 2 (`dust`): `(click)="setDustThreshold(90)"`, `(click)="setDustThreshold(180)"`, `(click)="setDustThreshold(365)"`, `(click)="setDustThreshold(730)"`.
     - Tab 3 (`graveyard`): `(click)="setGyReasonFilter(null)"`, `(click)="setGyReasonFilter(ArchiveReasons.Sold)"`, `(click)="setGyReasonFilter(ArchiveReasons.Donated)"`, `(click)="setGyReasonFilter(ArchiveReasons.Trashed)"`, `(click)="setGyReasonFilter(ArchiveReasons.Recycled)"`, `(click)="setGyReasonFilter(ArchiveReasons.Lost)"`, `(click)="setGyReasonFilter(ArchiveReasons.Consumed)"`.
   - Add equality guards at the top of `setStagedStatusFilter`, `setDustThreshold`, and `setGyReasonFilter`:
     ```ts
     setStagedStatusFilter(status: ItemStatus | null): void {
       if (this.stagedStatusFilter() === status) return;
       this.stagedStatusFilter.set(status);
       this.loadStaged();
     }

     setDustThreshold(days: number): void {
       if (this.dustThresholdDays() === days) return;
       this.dustThresholdDays.set(days);
       this.loadDustCollectors();
     }

     setGyReasonFilter(reason: ArchiveReason | null): void {
       if (this.gyReasonFilter() === reason) return;
       this.gyReasonFilter.set(reason);
       this.loadGraveyard();
     }
     ```
2. **`WhereHouse.Client/src/app/features/dashboard/maintenance-dialog/maintenance-dialog.component.ts`:**
   - Replace `(selectionChange)="dueOnlyFilter.set($event.selected); loadData()"` on `<mat-chip-option>` with `(click)="toggleDueOnlyFilter()"` where `toggleDueOnlyFilter()` flips `dueOnlyFilter` and calls `loadData()`.
3. **`WhereHouse.Client/src/app/features/dashboard/smart-search-dialog/smart-search-dialog.component.ts`:**
   - Replace `(selectionChange)` on `<mat-chip-option>` (lines 161, 169, 177, 185) with `(click)` toggle handlers (`toggleFilterLowStock()`, `toggleFilterOutOfPlace()`, `toggleFilterWarrantyExpiring()`, `toggleFilterIncludeArchived()`) so chip state initialization never fires duplicate search requests.

### 5.2 Responsive Top Navbar & Viewport Layout (`dashboard.component.html` & `dashboard.component.scss`)
1. **`WhereHouse.Client/src/app/features/dashboard/dashboard.component.html`:**
   - Reorganize `.top-actions` so it never overflows horizontal viewports:
     - Keep direct top-bar buttons:
       1. `+ Add` (`[matMenuTriggerFor]="addMenu"`)
       2. `Rapid Intake` (`openRapidIntakeDialog()`)
       3. `Scan QR` (`openScannerDialog()`)
       4. `Cart` (`openLoadoutsDialog('cart')` with cart badge)
       5. `Action Center` (`openActionCenterDialog()` with alert badge)
       6. `Tools & Vault` (`[matMenuTriggerFor]="toolsMenu"`, icon `apps` or `handyman`, label `Tools & Vault`)
       7. `Theme` toggle icon button
       8. `User` menu button
     - Create `<mat-menu #toolsMenu="matMenu">` containing:
       - `Loadouts & Loans` (`backpack` — `openLoadoutsDialog('loadouts')`)
       - `Print Barcode & QR Labels` (`qr_code_2` — `openLabelGeneratorDialog()`)
       - `Manage Categories & Templates` (`category` — `openCategoryManagerDialog()`)
       - `Declutter & Graveyard` (`cleaning_services` — `openDeclutterGraveyardDialog()`)
       - `Maintenance & Upkeep` (`build_circle` — `openMaintenanceDialog()`)
       - `Insurance & Disaster Vault` (`shield` — `openInsuranceExportDialog()`)
       - `Import / Export CSV & ZIP` (`import_export` — `openImportExportDialog()`)
2. **`WhereHouse.Client/src/app/features/dashboard/dashboard.component.scss`:**
   - Add `overflow-x: clip;` on `.dashboard-layout` and `.top-bar`.
   - Ensure `.top-search-area` has `flex: 1 1 200px; min-width: 0; max-width: 560px;`.
   - Add `margin-left: 0.45rem;` to `.kbd-pill` so `"Smart Search"` and `"Ctrl+K"` have clear horizontal spacing.
   - Change `.empty-state { mat-icon { ... } }` to `.empty-state { > mat-icon { ... } }` so buttons inside `.empty-actions` (`"Add Item"`, `"Add Sub-Location"`, `"Add Container"`) do not inherit `48px` icons.
   - Add responsive breakpoints:
     - `@media (max-width: 1280px)`: hide `.btn-label-collapsible` on secondary `.top-actions` buttons (`Rapid Intake`, `Scan QR`, `Cart`, `Action Center`) or tighten button padding (`0 0.5rem`) so `.top-bar` fits cleanly on `1024px–1280px` screens without any horizontal scrollbar.
     - `@media (max-width: 960px)`: collapse sidebar to drawer mode or narrower `240px` pane and keep `.top-bar` compact.
     - `@media (max-width: 768px)`: mobile layout with drawer toggle, compact search, and zero horizontal overflow.
3. **Also fix `.empty-state > mat-icon` in:**
   - `WhereHouse.Client/src/app/features/dashboard/action-center-dialog/action-center-dialog.component.ts`
   - `WhereHouse.Client/src/app/features/dashboard/insurance-export-dialog/insurance-export-dialog.component.ts`

### 5.3 Fix Container Color Swatches (`LocationDialogComponent`)
- **File:** `WhereHouse.Client/src/app/features/dashboard/location-dialog/location-dialog.component.ts`
- Replace `commonColors: string[]` with `commonColors: { hex: string; name: string }[]`:
  ```ts
  protected readonly commonColors = [
    { hex: '#1f2937', name: 'Black / Dark Slate' },
    { hex: '#eab308', name: 'Yellow' },
    { hex: '#dc2626', name: 'Red' },
    { hex: '#2563eb', name: 'Blue' },
    { hex: '#16a34a', name: 'Green' },
    { hex: '#f97316', name: 'Orange' },
    { hex: '#9ca3af', name: 'Gray' },
    { hex: '#ffffff', name: 'White / Clear' },
  ];
  ```
- In both **Primary Color (Body)** and **Accent Color (Lid / latches)**:
  - Remove `<span class="visually-hidden">{{ c }}</span>` from `.color-swatch-btn`.
  - Render `<button type="button" class="color-swatch-btn" [style.background-color]="c.hex" [class.selected-swatch]="form.get('primaryColor')?.value === c.hex" (click)="selectPrimaryColor(c.hex)" [matTooltip]="c.name" [attr.aria-label]="'Body color ' + c.name"> @if (form.get('primaryColor')?.value === c.hex) { <mat-icon class="swatch-check" [class.dark-check]="c.hex === '#ffffff' || c.hex === '#eab308'">check</mat-icon> } </button>`.
  - Replace `<input class="color-hex-input" ...>` with a clean native `<input type="color" class="color-picker-native" [value]="form.get('primaryColor')?.value || '#2563eb'" (input)="selectPrimaryColor($any($event.target).value)" matTooltip="Custom color" aria-label="Custom body color" />` and a small clear button (`@if (form.get('primaryColor')?.value) { <button type="button" class="clear-color-btn" (click)="selectPrimaryColor('')" matTooltip="Clear color" aria-label="Clear body color"><mat-icon>close</mat-icon></button> }`).

### 5.4 Convert Date Inputs to Angular Material Datepicker (`MatDatepickerModule`)
1. **`WhereHouse.Client/src/app/app.config.ts`:**
   - Import and register `provideNativeDateAdapter()` from `@angular/material/core`.
2. **`WhereHouse.Client/src/app/features/dashboard/item-dialog/item-dialog.component.ts`:**
   - Import `MatDatepickerModule` from `@angular/material/datepicker` and `provideNativeDateAdapter` from `@angular/material/core` (in component `providers: [provideNativeDateAdapter()]` so standalone component unit tests also work out-of-the-box without needing global config).
   - Convert `purchaseDate`, `returnWindowEndDate`, and `warrantyExpirationDate` fields to use `<input matInput [matDatepicker]="..." formControlName="..." />` + `<mat-datepicker-toggle matIconSuffix [for]="..."></mat-datepicker-toggle><mat-datepicker #...></mat-datepicker>`.
   - Update `toDateInputString` $\rightarrow$ `toDateObject(iso?: string | null): Date | null` and `toIsoOrNull(val?: Date | string | null): string | null` so `MatDatepicker` `Date` instances serialize cleanly to ISO strings.
   - Add Return Window quick presets (`+14d`, `+30d`, `+60d`, `+90d`) and Warranty Expiration quick presets (`+1 yr`, `+2 yr`, `+3 yr`, `+5 yr`) that set `Date` objects on `returnWindowEndDate` / `warrantyExpirationDate`.
3. **`WhereHouse.Client/src/app/features/dashboard/checkout-return-dialog/checkout-return-dialog.component.ts`:**
   - Import `MatDatepickerModule` and add `providers: [provideNativeDateAdapter()]`.
   - Convert `expectedReturnDate` from `<input matInput type="date">` to `<input matInput [matDatepicker]="expectedReturnPicker" [(ngModel)]="expectedReturnDate" name="expectedReturnDate" />` + `<mat-datepicker-toggle matIconSuffix [for]="expectedReturnPicker"></mat-datepicker-toggle><mat-datepicker #expectedReturnPicker></mat-datepicker>`.
   - Update `expectedReturnDate` model to accept `Date | string | null` and convert to ISO string on submit.

### 5.5 Fix Overly Wide Dialogs (`CategoryManagerDialogComponent` & `LabelGeneratorDialogComponent`)
1. **`WhereHouse.Client/src/app/features/dashboard/category-manager-dialog/category-manager-dialog.component.ts` & `dashboard.component.ts`:**
   - In `dashboard.component.ts`: open `CategoryManagerDialogComponent` with `{ width: '680px', maxWidth: '95vw' }`.
   - In `category-manager-dialog.component.ts`:
     - Update `.manager-layout` to `grid-template-columns: 190px minmax(0, 1fr); gap: 1rem; min-height: 400px;`.
     - Add `min-width: 0;` on `.category-form-pane`, `.half-width`, `.field-name-input`, `.field-type-select`, `.field-unit-input`, and `.field-options-input`.
     - Override MDC form-field infix min-width inside `.category-form-pane` (`::ng-deep .mat-mdc-form-field-infix { width: auto !important; min-width: 0 !important; }`) so 2-column and 3-column rows shrink gracefully inside the `680px` dialog without horizontal overflow.
2. **`WhereHouse.Client/src/app/features/dashboard/label-generator-dialog/label-generator-dialog.component.ts` & `dashboard.component.ts`:**
   - In `dashboard.component.ts`: change `openLabelGeneratorDialog` width from `'1080px'` to `'860px'`, `maxWidth: '95vw'`, `maxHeight: '90vh'`.
   - In `label-generator-dialog.component.ts`:
     - Change `.label-generator-container` from `width: 100vw; max-width: 1200px; height: 90vh;` to `width: 100%; max-width: 100%; height: min(82vh, 720px); box-sizing: border-box;`.
     - Change `.controls-panel` width from `380px` to `300px` (`flex-shrink: 0`) with `min-width: 0` on `.inline-fields mat-form-field`.
     - Add `zoom: 0.65;` on `.preview-canvas-wrapper .printable-sheet-grid` inside `@media screen` so the 8.5"x11" label sheet preview fits neatly inside the right-hand preview pane without forcing a huge dialog or horizontal scrollbar, while `@media print` renders at `zoom: 1`.
     - Add `@media (max-width: 768px)` rule stacking `.generator-body` vertically.

### 5.6 Container Cover Photos, Household Sharing & Kit/Nested Chips
1. **New Component:** `WhereHouse.Client/src/app/features/dashboard/location-attachments-dialog/location-attachments-dialog.component.ts`
   - Standalone dialog to view, upload (`AttachmentService.uploadLocationAttachment`), and delete attachments for any `LocationNodeDto`.
2. **Update `DashboardComponent`:**
   - Render cover photo thumbnails on sub-location/container cards (`loc.coverAttachmentId`) and the selected location header, plus a `"Photos & Files"` (`add_a_photo`) button opening `LocationAttachmentsDialogComponent`.
   - Render child component count and clickable component chips (`childItemsByParentId()`) on `Kit` and `Nested` items.
3. **Update `AuthService`, `ItemDialogComponent`, and `SmartSearchDialogComponent`:**
   - Add `getUsers(): Observable<UserSummaryDto[]>` to `AuthService`.
   - Add `sharedWithUserIds` multi-select in `ItemDialogComponent` when `isPrivate` is checked.
   - Add **Owner** `<mat-select>` filter in `SmartSearchDialogComponent`.

---

## 6. Verification & Full Playwright E2E Test Plan

### 6.1 Unit Tests (`Tests/WhereHouse.Core.UnitTests` & `WhereHouse.Client`)
- Update Angular unit tests in `dashboard.component.spec.ts`, `declutter-graveyard-dialog.component.spec.ts`, and `item-dialog.component.spec.ts` to verify:
  - `DeclutterGraveyardDialogComponent` calls `getStagedItems` only **once** on initialization (no infinite loop).
  - `LocationNodeDto.coverAttachmentId` renders container cover thumbnails and opens `LocationAttachmentsDialogComponent`.
  - `ItemDialogComponent` Return Window / Warranty presets populate `Date` values and `sharedWithUserIds` submits properly.
  - `DashboardComponent` renders `Kit` / `Nested` child component chips.

### 6.2 API Integration Tests (`Tests/WhereHouse.API.IntegrationTests`)
- Create `Tests/WhereHouse.API.IntegrationTests/Phase11CoverPhotosAndHouseholdSharingIntegrationTests.cs`:
  1. `GetHouseholdUsers_ReturnsActiveUsersSortedByDisplayName` (`GET /api/auth/users`).
  2. `PrivateItem_SharedWithHouseholdUser_IsVisibleToSharedUserAndHiddenFromUnsharedUser`.
  3. `LocationAttachment_UploadPhoto_PopulatesLocationCoverAttachmentIdInTreeAndDetail`.

### 6.3 Full Playwright E2E Suite (`Tests/WhereHouse.Client.E2ETests`)
- Update `Tests/WhereHouse.Client.E2ETests/WhereHouse.Client.E2ETests.csproj` to reference `WhereHouse.API` so the API assembly is available, and create:
  - `Tests/WhereHouse.Client.E2ETests/WhereHouseE2EServerFixture.cs`:
    - Ensures `WhereHouse.Client/dist/WhereHouse.Client/browser/index.html` exists (runs `npm run build` in `WhereHouse.Client` if missing).
    - Starts `WhereHouse.API` on a free local TCP loopback port (`http://127.0.0.1:{port}`) with `--environment Testing`, `--webroot {browserDistPath}`, `--UseInMemoryDatabase=true`, and temporary file storage.
  - `Tests/WhereHouse.Client.E2ETests/WhereHouseFullAppE2ETests.cs`:
    1. **`FullApp_SetupAuthAndResponsiveLayout_HasNoHorizontalScrollAndProperButtonSizing`:**
       - Completes initial setup (`/setup`) or logs in, lands on `/dashboard`.
       - Asserts `document.documentElement.scrollWidth <= window.innerWidth` across `1920x1080` (Desktop), `1280x800` (Narrow Desktop), `768x1024` (Tablet), and `375x812` (Mobile).
       - Verifies `"Smart Search"` and `"Ctrl+K"` have positive horizontal spacing (`marginLeft > 0`).
       - Verifies empty-state action button icons (`"Add Item"`, `"Add Sub-Location"`, `"Add Container"`) have bounding box width `<= 24px` (not `48px`).
    2. **`FullApp_CreateLocationsAndContainers_ColorSwatchesAndCoverPhotoWorkCleanly`:**
       - Creates a Fixed Location (`"Main Garage"`) and a Movable Container (`"Heavy Duty Tote"`).
       - Asserts `.color-swatch-btn` inner text does NOT contain `#` hex codes (`#1f2937`, `#eab308`).
       - Selects primary & accent colors and saves the container.
    3. **`FullApp_CategoriesItemsMaterialDatepickerAndPresets_WorkEndToEnd`:**
       - Opens `Tools & Vault` menu $\rightarrow$ `Manage Categories & Templates`, asserts dialog width `<= 720px`, creates a category with a custom attribute field.
       - Opens `Add Item` dialog, uses Angular Material Datepicker toggle (`mat-datepicker-toggle`) and quick-preset buttons (`+30d`, `+1 yr`), creates the item, and verifies it appears in the dashboard grid.
    4. **`FullApp_SmartSearchLabelGeneratorAndDeclutterDialog_NoInfiniteLoopAndCompactDialogs`:**
       - Opens `Barcode & QR Label Generator` from `Tools & Vault`, asserts dialog width `<= 880px`, mints blank QR stickers.
       - Opens `Declutter & Graveyard` from `Tools & Vault`, monitors `/api/lifecycle/staged` network requests over 1,500ms, and asserts the endpoint is called **at most once** on open (zero infinite loop!).

---

## 7. Execution Checklist (For `/execute-phase`)

1. [ ] Update `Item` entity (`SharedWithUserIdsJson`) and `ItemConfiguration`, then generate EF Core migration `AddItemSharedWithUsers`.
2. [ ] Add `UserSummaryDto`, update `IAuthService`, `LocationNodeDto` (`CoverAttachmentId`), and `ItemDto` / `CreateItemRequest` / `UpdateItemRequest` (`SharedWithUserIds`).
3. [ ] Implement `AuthService.GetHouseholdUsersAsync`, `GET /api/auth/users`, `LocationService` `CoverAttachmentId` resolution, and shared private item access across backend services.
4. [ ] Fix the infinite request loop in `DeclutterGraveyardDialogComponent` (and chip `(selectionChange)` in `MaintenanceDialogComponent` & `SmartSearchDialogComponent`).
5. [ ] Refactor `.top-bar` / `.top-actions` in `DashboardComponent` with the `Tools & Vault` menu, responsive breakpoints, `Ctrl+K` spacing fix, and `.empty-state > mat-icon` direct child selector fix.
6. [ ] Fix `LocationDialogComponent` color swatches so raw hex codes are hidden and replaced with tooltips, checkmarks, and a native color picker.
7. [ ] Register `provideNativeDateAdapter()` and convert date inputs in `ItemDialogComponent` and `CheckoutReturnDialogComponent` to `MatDatepickerModule` + add Return/Warranty quick-preset buttons.
8. [ ] Tighten dialog widths and responsive layouts for `CategoryManagerDialogComponent` (`680px`) and `LabelGeneratorDialogComponent` (`860px` + scaled preview).
9. [ ] Implement `LocationAttachmentsDialogComponent`, container cover photo thumbnails, household sharing selector in `ItemDialogComponent`, Owner filter in `SmartSearchDialogComponent`, and `Kit`/`Nested` component chips in `DashboardComponent`.
10. [ ] Add backend integration tests (`Phase11CoverPhotosAndHouseholdSharingIntegrationTests.cs`), Angular unit tests, and the full Playwright E2E suite (`WhereHouseE2EServerFixture.cs` & `WhereHouseFullAppE2ETests.cs`).
11. [ ] Build `WhereHouse.Client` (`npm run build`), run all test suites (`.NET Core`, `.NET Infrastructure`, `.NET API Integration`, `Angular Unit`, and `Playwright E2E`), format (`dotnet csharpier format .` and `npm run lint`), and commit.
