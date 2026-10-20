# Phase 12: Comprehensive Full-App Playwright E2E Suite

> **Branch:** `feature/phase-12-comprehensive-full-app-e2e-suite`
> **Status:** Planned (`[ ]` Not Started | `[~]` In Progress | `[x]` Completed)
> **PRD Reference:** `docs/prd.md` — Complete Milestones 1–4 & All Functional Specifications
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

Deliver an exhaustive, automated Playwright end-to-end test suite testing **100% of user-facing features, screens, modals, and edge cases** in the WhereHouse application.

### Key Objectives
1. **Full Functional Coverage Across All 16 Domains:**
   - Auth & Session Management (Registration, Login, Validation, Logout, Household Directory)
   - Location & Movable Container Hierarchy (CRUD, Tree Navigation, Style Presets, Color Swatches, Cover Photos, Reparenting, Deletion)
   - Items & Archetypes (Unique, Quantity, Kit/Nested Parts, Secret Gift Mode with Household Sharing, Duplication, Deletion)
   - Attachments & Manuals (Upload, Download, File Previews, Count Badges, Deletion)
   - Smart Search & Command Palette (Ctrl+K, Deep Text Queries, Faceted Filters, OCR Content Search)
   - Barcode & QR Label Generator (Print Queue, Avery 5160/5163 Sheets, Brother Continuous, Offset Spacers, Mint Blank Stickers)
   - Scanner & Physical Audits (ShortCode Lookup, Unassigned Sticker Binding, Bulk Move Audit Scan)
   - Rapid Intake Mode (Locked Location, Barcode Lookup, Fast-Add Session Queue, Quantity Increments)
   - Checkouts, Borrowing & Project Loadouts (Checkout/Return, Overdue Tracking, Ad-Hoc Cart, Named Loadout Deploy & Return)
   - Maintenance & Scheduled Upkeep (Task Recurrence, Quick Presets, Due Task Filters, Completion History)
   - Declutter Graveyard & Dust Collectors (Staged to Sell/Donate, Dust Collectors Idle Filters, Quick-Touch, Graveyard Archive & Restore)
   - Action Center & Household Digest (Live Alerts, In-Dialog Resolution, Instant Digest Trigger)
   - Insurance & Disaster Recovery Vault (Portfolio Valuation, Claim Preview, Full ZIP Export)
   - Data Portability & Import/Export (Full JSON Bundle, CSV Export, Dry-Run CSV Mapping & Import)
   - Categories & Dynamic Attribute Templates (Schema Fields: Text, Number, Enum, Bool; Dynamic Form Rendering & Persistence)
   - Theme Customizer & Responsive Viewport Audits (Light/Dark/System Themes, 375px/768px/1280px/1920px Zero-Overflow Audits)

2. **Performance & Reliability Guarantees:**
   - Execute all tests against the ephemeral in-memory Kestrel server bridge (`WhereHouseE2EServerFixture`), achieving a complete suite execution in under 2.5 minutes without Docker dependencies.
   - Standardize on a shared base test fixture (`WhereHouseE2ETestBase.cs`) with clean helper methods for authentication, entity seeding, and modal lifecycle management.
   - Zero flakiness: all assertions use Playwright auto-waiting (`Expect(locator).ToBeVisibleAsync()`, `Expect(locator).ToHaveCountAsync()`) and deterministic test isolation.

---

## 2. Test Architecture & Helper Infrastructure (`Tests/WhereHouse.Client.E2ETests`)

### 2.1 File Organization

```
Tests/WhereHouse.Client.E2ETests/
├── WhereHouseE2EServerFixture.cs                 # Kestrel loopback proxy to ASP.NET Core TestServer + Angular SPA webroot
├── MSTestSettings.cs                             # Class-level parallelization configuration
├── WhereHouseE2ETestBase.cs                      # Shared base class: server fixture lifecycle, authentication, seeding helpers
└── Suites/
    ├── 01_AuthAndUserDirectoryE2ETests.cs        # Auth registration, login, logout, validation, user directory
    ├── 02_LocationsAndContainersE2ETests.cs      # Location tree, movable containers, swatches, cover photos, move, delete
    ├── 03_ItemsAndArchetypesE2ETests.cs          # Unique, quantity steppers, kits/components, secret mode + household sharing, clone
    ├── 04_ItemAttachmentsE2ETests.cs             # File upload, download, attachments badge, deletion
    ├── 05_SmartSearchAndCommandPaletteE2ETests.cs # Ctrl+K command palette, faceted filters (archetype, category, owner, condition)
    ├── 06_BarcodeAndQrGenerationE2ETests.cs      # Avery sheets, continuous rolls, partial sheet offsets, blank QR minting
    ├── 07_ScannerAndAuditScanE2ETests.cs         # Scanner lookup, binding unassigned stickers, bulk move audit
    ├── 08_RapidIntakeE2ETests.cs                 # Locked location, UPC auto-fill, session queue, batch quantity increments
    ├── 09_CheckoutsAndLoadoutsE2ETests.cs        # Checkouts, overdue pill, return flow, project cart, loadout templates
    ├── 10_MaintenanceAndUpkeepE2ETests.cs        # Maintenance schedules, presets (+90d, +1yr), due filter, completion log
    ├── 11_DeclutterAndGraveyardE2ETests.cs       # Staging to sell/donate, dust collectors (>180d, >365d), touch idle, archive/restore
    ├── 12_ActionCenterAndAlertsE2ETests.cs       # Action Center badge, alert metrics, quick return/complete, manual digest dispatch
    ├── 13_InsuranceVaultAndExportE2ETests.cs     # Valuation dashboard, claim bundle preview, ZIP archive download
    ├── 14_PortabilityAndImportExportE2ETests.cs  # Full JSON export, CSV export, CSV header auto-matching & dry-run import
    ├── 15_CategoriesAndCustomAttributesE2ETests.cs # Category CRUD, attribute templates (Text, Number, Enum, Bool), dynamic item form
    └── 16_ThemeAndResponsiveViewportsE2ETests.cs # Light/Dark/System modes, responsive viewports (375px, 768px, 1280px, 1920px)
```

### 2.2 Shared Base Class Specification (`WhereHouseE2ETestBase.cs`)

Inherits from `Microsoft.Playwright.MSTest.PageTest`. Provides:
- `static WhereHouseE2EServerFixture Fixture`: lazily initialized per test suite.
- `Task<string> AuthenticateAsync(IPage page, string username, string email, string password = "Password123!")`:
  - Registers user via `POST /api/auth/register` (or falls back to `POST /api/auth/login`).
  - Injects `where-house-token` into browser `localStorage`.
  - Navigates to `Fixture.RootUri` and waits for `.top-bar`.
- `Task<LocationNodeDto> CreateLocationViaApiAsync(string name, LocationNodeType type, Guid? parentId = null, string? primaryColor = null, string? accentColor = null, string? containerStyle = null)`:
  - Seeds a location via backend API client to speed up multi-entity test scenarios.
- `Task<ItemDto> CreateItemViaApiAsync(string name, ItemType type, Guid? locationId, int quantity = 1, bool isPrivate = false, IReadOnlyList<Guid>? sharedWithUserIds = null)`:
  - Seeds an item via backend API client.
- `Task<CategoryDto> CreateCategoryViaApiAsync(string name, string? icon = null, string? color = null)`:
  - Seeds a category via backend API client.
- `Task OpenToolsMenuAndSelectAsync(IPage page, string menuItemText)`:
  - Clicks `.tools-vault-btn` and clicks `button[role='menuitem']` matching `menuItemText`.
- `Task CloseActiveDialogAsync(IPage page)`:
  - Locates `mat-dialog-container` and clicks close/cancel/done button or presses `Escape`.

---

## 3. Comprehensive Test Suite Specifications

### Suite 01: Authentication & User Directory (`01_AuthAndUserDirectoryE2ETests.cs`)
1. **`Auth_RegisterWithValidCredentials_LogsInAndLandsOnDashboard`:**
   - Navigates to `/login`.
   - Switches to Register tab.
   - Fills username, email, password, and confirm password.
   - Submits form; asserts navigation to `/` and visibility of `.top-bar` and greeting.
2. **`Auth_RegisterValidation_ShowsPasswordMismatchAndRequiredErrors`:**
   - Enters mismatching passwords; asserts validation message visible and submit button disabled.
3. **`Auth_LoginWithInvalidCredentials_DisplaysErrorMessage`:**
   - Enters incorrect password; submits and asserts error alert appears.
4. **`Auth_Logout_ClearsSessionAndRedirectsToLogin`:**
   - Logs in, clicks user profile avatar in top navbar, clicks Logout.
   - Asserts redirection to `/login` and `localStorage.getItem('where-house-token')` is null.
5. **`Auth_HouseholdUserDirectory_ReturnsActiveUsersForSharing`:**
   - Registers Alice and Bob.
   - Logs in as Alice, opens Add Item dialog, checks "Mark as Private".
   - Opens "Share Privately With" select dropdown; asserts Bob appears in the option list.

### Suite 02: Location & Container Hierarchy (`02_LocationsAndContainersE2ETests.cs`)
1. **`Locations_CreateFixedLocation_AppearsInTreeAndGrid`:**
   - Clicks Quick Add $\rightarrow$ Fixed Location.
   - Enters name `"Workshop"`, selects icon `"home"`, saves.
   - Asserts `"Workshop"` is selected in tree and displayed in breadcrumb and grid.
2. **`Locations_CreateMovableContainer_WithStyleAndColorSwatches_DisplaysVisualTags`:**
   - Clicks Quick Add $\rightarrow$ Movable Container inside `"Workshop"`.
   - Enters name `"Hardware Tote #1"`, clicks style preset `"27-Gal Heavy Duty Tote"`.
   - Clicks black body swatch and yellow lid swatch; verifies no `#` hex codes in swatch labels.
   - Verifies native `<input type="color" class="color-picker-native">` is present.
   - Saves; asserts container card in grid displays style tag and dual-color mini swatches.
3. **`Locations_CoverPhoto_UploadThumbnailAndDeletion_WorksEndToEnd`:**
   - Selects container; clicks "Photos" button in location banner.
   - Uploads synthetic image file; asserts cover photo thumbnail renders in banner and card.
   - Re-opens Photos dialog, deletes cover photo; asserts banner reverts to default icon.
4. **`Locations_Reparenting_MoveLocationToNewParent_UpdatesFullPath`:**
   - Creates root `"Basement"` and root `"Garage"`.
   - Moves `"Basement"` to be child of `"Garage"` via Move dialog.
   - Asserts full path becomes `"Garage / Basement"`.
5. **`Locations_DeleteLocation_WithConfirmation_RemovesFromTree`:**
   - Opens delete location confirmation modal; cancels (verifies node remains).
   - Confirms deletion; asserts node is removed from tree and grid.

### Suite 03: Items, Archetypes & Privacy (`03_ItemsAndArchetypesE2ETests.cs`)
1. **`Items_CreateUniqueAsset_WithWarrantyAndReturnPresets_DisplaysInGrid`:**
   - Opens Add Item dialog; enters brand `"DeWalt"`, model `"DCD791"`, serial `"SN-987654"`.
   - Clicks return window preset `+30d` and warranty preset `+2 yr`.
   - Verifies `mat-datepicker-toggle` is attached to inputs.
   - Saves; asserts item card renders brand, model, and active warranty status.
2. **`Items_QuantityItem_StepperAdjustments_UpdatesStockAndLowStockAlert`:**
   - Creates Quantity item `"AA Batteries"` (quantity: 5, minQuantity: 4, unit: `"pcs"`).
   - Clicks `+` stepper button on card; asserts quantity becomes 6.
   - Clicks `-` twice; asserts quantity becomes 4 and `.low-stock-alert` pill appears.
3. **`Items_KitItem_ChildComponents_NavigatesToComponentItem`:**
   - Creates child item `"Drill Bit Set"`.
   - Creates Kit item `"Cordless Drill Kit"` and associates child item.
   - Asserts Kit card renders archetype badge and clickable component chip.
   - Clicks component chip; asserts edit modal for child item opens directly.
4. **`Items_SecretGiftMode_EnforcesHouseholdPrivacyBoundaries`:**
   - User Alice creates item with Secret/Gift Mode checked, shared only with Bob.
   - Verifies Alice can see the item.
   - Authenticates as Bob in a separate context; verifies Bob can see and search the item.
   - Authenticates as Charlie; verifies Charlie cannot see or search the item.
5. **`Items_CloneItem_AppendsCopyAndDuplicatesMetadata`:**
   - Opens item action menu $\rightarrow$ Clone / Duplicate.
   - Asserts name defaults to `"<Original Name> (Copy)"` and preserves brand/attributes.
   - Saves; asserts both items exist in location.

### Suite 04: Item Attachments & Manuals (`04_ItemAttachmentsE2ETests.cs`)
1. **`Attachments_UploadDocumentAndPhoto_IncrementsBadgeCount`:**
   - Clicks paperclip button on item card to open Attachments modal.
   - Uploads synthetic document file (`user-manual.pdf`).
   - Asserts file appears in uploaded list with formatted file size.
   - Closes modal; asserts attachment count badge on card updates to `1`.
2. **`Attachments_DownloadFile_ServesOriginalStream`:**
   - Opens attachments modal, triggers file download, asserts HTTP 200 stream response.
3. **`Attachments_DeleteAttachment_DecrementsBadgeCount`:**
   - Deletes attachment with confirmation; asserts file removed from modal list and badge cleared.

### Suite 05: Smart Search & Command Palette (`05_SmartSearchAndCommandPaletteE2ETests.cs`)
1. **`SmartSearch_CtrlKShortcut_OpensCommandPalette`:**
   - Presses `Ctrl+K`; asserts Smart Search dialog opens and search input is focused.
2. **`SmartSearch_TextQuery_FiltersAcrossBrandModelAndNotes`:**
   - Seeds items with unique terms in brand, model, and description.
   - Types query; asserts matching items appear instantly in search results list.
3. **`SmartSearch_FacetedFiltering_FiltersByArchetypeCategoryAndOwner`:**
   - Toggles archetype chip (e.g. `Kit`); asserts only kit items render.
   - Selects Category dropdown; asserts filtered results.
   - Selects Owner filter dropdown; asserts items filtered by owner.
4. **`SmartSearch_SelectResult_NavigatesDirectlyToTarget`:**
   - Clicks search result; asserts modal closes and dashboard selects target item/location.

### Suite 06: Barcode & QR Label Generator (`06_BarcodeAndQrGenerationE2ETests.cs`)
1. **`Labels_AddEntitiesToPrintQueue_RendersLivePreview`:**
   - Opens Tools $\rightarrow$ "Print Barcode & QR Labels".
   - Adds a location and an item to queue; asserts live canvas renders QR stickers.
2. **`Labels_ChangePreset_UpdatesSheetLayoutAndDimensions`:**
   - Switches preset from Avery 5160 (30-up) to Avery 5163 (10-up).
   - Asserts grid layout classes and dimension CSS variables update.
3. **`Labels_PartialSheetOffset_InsertsSkippedSpacerCells`:**
   - Sets Start Row: 2, Start Column: 2.
   - Asserts `.spacer-cell` elements render ahead of queued labels with text "Skipped (Used)".
4. **`Labels_MintBlankStickers_AddsBatchToPrintQueue`:**
   - Switches to "Mint Blank QR" tab, sets quantity 5, clicks Mint Batch.
   - Asserts 5 newly minted `STK-xxx` labels are added directly to the print queue.

### Suite 07: Scanner & Physical Audits (`07_ScannerAndAuditScanE2ETests.cs`)
1. **`Scanner_ManualShortCodeLookup_NavigatesToEntity`:**
   - Opens Scanner modal from top bar.
   - Enters known shortCode `"LOC-001"` in manual input; clicks Lookup.
   - Asserts entity details card renders with name and "Navigate to Location" button.
2. **`Scanner_BindUnassignedSticker_BindsToItem`:**
   - Mints blank sticker code `"STK-999"`.
   - Scans `"STK-999"` in scanner; clicks "Bind Sticker".
   - Selects unassigned item from dropdown; confirms bind.
   - Verifies item shortCode becomes `"STK-999"`.
3. **`Scanner_BulkMoveAuditScan_VerifiesContainerContents`:**
   - Selects target container; scans 3 items into container.
   - Asserts audit log shows 3 successful movements and updates location count.

### Suite 08: Rapid Intake Mode (`08_RapidIntakeE2ETests.cs`)
1. **`RapidIntake_LockLocationAndAddMultipleItems_WithoutLeavingModal`:**
   - Opens Rapid Intake dialog; selects container `"Storage Tote A"`.
   - Enters item name `"Screwdriver"`, clicks Add.
   - Enters second item `"Pliers"`, clicks Add.
   - Asserts both items appear in the session intake list at the bottom.
2. **`RapidIntake_BarcodeLookup_PreFillsRetailData`:**
   - Enters mock UPC code; clicks lookup button.
   - Asserts name and brand fields auto-populate.
3. **`RapidIntake_SessionQueueActions_AdjustQuantityAndRemove`:**
   - Uses `+` button in session list to increment quantity to 3.
   - Closes dialog; asserts `"Storage Tote A"` contains both items with correct counts.

### Suite 09: Checkouts, Loans & Project Loadouts (`09_CheckoutsAndLoadoutsE2ETests.cs`)
1. **`Checkouts_LoanItemToBorrower_DisplaysInUseBannerAndOverdueStatus`:**
   - Opens item menu $\rightarrow$ Check Out / Loan.
   - Enters borrower `"Neighbor Dave"`, expected return date (yesterday).
   - Submits; asserts card displays checkout banner `"Loaned to Neighbor Dave"` with `OVERDUE` badge.
2. **`Checkouts_ReturnItem_RestoresInPlaceStatus`:**
   - Opens checkout menu $\rightarrow$ Return Item; selects condition `"Good"`.
   - Submits; asserts status reverts to `"In Place"`.
3. **`Checkouts_ProjectCart_BatchCheckout`:**
   - Selects 2 items via checkboxes on dashboard.
   - Clicks top bar "Cart"; asserts cart count badge shows `2`.
   - Clicks "Check Out Entire Cart" to `"Job Site A"`; asserts both items checked out simultaneously.
4. **`Checkouts_LoadoutTemplates_CreateDeployAndReturn`:**
   - Opens Tools $\rightarrow$ "Loadouts & Loans" $\rightarrow$ "New Loadout".
   - Names loadout `"Camping Essentials"` and assigns 3 items.
   - Clicks "Deploy Loadout"; asserts all 3 items change status to `"In Use (Loadout: Camping Essentials)"`.
   - Clicks "Return Loadout"; asserts all 3 items returned in place.

### Suite 10: Maintenance Schedules & Upkeep (`10_MaintenanceAndUpkeepE2ETests.cs`)
1. **`Maintenance_CreateSchedule_WithQuickPresets_AppearsInList`:**
   - Opens Tools $\rightarrow$ "Maintenance & Upkeep".
   - Clicks "Add Schedule", enters title `"Clean Air Filters"`, clicks preset `+90d`.
   - Saves; asserts task appears in upcoming maintenance schedule.
2. **`Maintenance_DueOnlyFilter_FiltersTasksByDueDate`:**
   - Toggles "Due Only" filter; asserts only tasks with due dates in past or today render.
3. **`Maintenance_CompleteTask_LogsHistoryAndRollsDueDate`:**
   - Clicks "Mark Completed"; enters completion notes.
   - Asserts task moves out of due status and next due date rolls forward by 90 days.

### Suite 11: Declutter Graveyard & Dust Collectors (`11_DeclutterAndGraveyardE2ETests.cs`)
1. **`Declutter_StageItemToSellAndDonate_RendersInStagedTab`:**
   - Opens item menu $\rightarrow$ Stage / Archive.
   - Selects "Stage to Sell", enters estimated price `"$45.00"`.
   - Opens Tools $\rightarrow$ "Declutter & Graveyard"; asserts item appears under "Staged (Sell)" tab.
2. **`Declutter_BulkUnstage_RestoresActiveStatus`:**
   - Selects staged items; clicks "Bulk Unstage".
   - Asserts items disappear from staged list and return to active inventory.
3. **`Declutter_DustCollectors_QuickTouchResetsIdleTimer`:**
   - Switches to "Dust Collectors" tab with threshold `>180d`.
   - Clicks "Quick Touch" icon on an idle item; asserts item removed from dust list.
4. **`Declutter_ArchiveToGraveyardAndRestore_RoundTrips`:**
   - Archives item to Graveyard with reason `"Sold"` and final proceeds `"$40.00"`.
   - Switches to "Graveyard Archive" tab; asserts item appears with `"Sold: $40.00"`.
   - Clicks "Restore"; selects target location; asserts item restored to active inventory.

### Suite 12: Action Center & Household Digest (`12_ActionCenterAndAlertsE2ETests.cs`)
1. **`ActionCenter_AlertBadge_DisplaysTotalActionCount`:**
   - Seeds 1 overdue loan, 1 due maintenance task, and 1 low stock item.
   - Asserts top bar Action Center button shows badge count `3`.
2. **`ActionCenter_OpenDialog_DisplaysCategorizedMetrics`:**
   - Clicks Action Center button; asserts metric cards for Loans, Maintenance, and Stock are visible.
3. **`ActionCenter_QuickResolveAction_UpdatesCountsInPlace`:**
   - Clicks "Quick Return" on the loan alert card; asserts loan resolved and badge decrements.
4. **`ActionCenter_SendDigestNow_DispatchesImmediateNotification`:**
   - Clicks "Send Household Digest Now"; asserts confirmation snackbar appears.

### Suite 13: Insurance & Disaster Recovery Vault (`13_InsuranceVaultAndExportE2ETests.cs`)
1. **`Insurance_ValuationDashboard_RendersSummaryMetrics`:**
   - Opens Tools $\rightarrow$ "Insurance & Disaster Vault".
   - Asserts total asset count, total portfolio valuation, and category breakdown charts render.
2. **`Insurance_ClaimBundlePreview_FiltersHighValueItems`:**
   - Switches to Claim Bundle tab; filters by location `"Garage"`.
   - Asserts valuation total reflects only Garage assets.
3. **`Insurance_ExportZip_TriggersDownload`:**
   - Clicks "Download Insurance Package (.ZIP)"; asserts ZIP download event triggered.

### Suite 14: Data Portability, Import & Export (`14_PortabilityAndImportExportE2ETests.cs`)
1. **`Portability_ExportJsonBundle_TriggersDownload`:**
   - Opens Tools $\rightarrow$ "Import / Export CSV & ZIP".
   - Selects JSON Bundle; clicks Export; asserts JSON file download triggered.
2. **`Portability_ExportCsv_TriggersDownload`:**
   - Selects CSV format; clicks Export; asserts CSV file download triggered.
3. **`Portability_ImportCsv_DryRunAndExecute`:**
   - Uploads synthetic CSV text; asserts auto-column header matcher binds fields.
   - Clicks "Dry Run Preview"; asserts validation passes with 0 errors.
   - Clicks "Execute Import"; asserts items imported into database.

### Suite 15: Categories & Dynamic Custom Attributes (`15_CategoriesAndCustomAttributesE2ETests.cs`)
1. **`Categories_CreateCategoryWithSchemaTemplates_PersistsInDatabase`:**
   - Opens Tools $\rightarrow$ "Manage Categories & Templates".
   - Creates `"Photography Gear"`, icon `"photo_camera"`.
   - Adds 4 attribute templates:
     - Text: `"Mount Type"`
     - Number: `"Focal Length"` (unit: `"mm"`)
     - Enum: `"Sensor Format"` (options: `"Full Frame, APS-C"`)
     - Boolean: `"Weather Sealed"`
   - Saves category.
2. **`Categories_AddItemInCategory_RendersDynamicFormFieldsAndPersists`:**
   - Opens Add Item dialog; selects category `"Photography Gear"`.
   - Asserts 4 dynamic input fields render.
   - Enters Mount: `"Sony E"`, Focal: `50`, Sensor: `"Full Frame"`, Weather: checked.
   - Saves; asserts item card displays category chip and custom attribute metadata.

### Suite 16: Theme Customizer & Responsive Viewport Audits (`16_ThemeAndResponsiveViewportsE2ETests.cs`)
1. **`Theme_SwitchModeAndColor_AppliesToDom`:**
   - Clicks theme palette button in top navbar.
   - Switches mode to Dark; asserts `document.documentElement` receives dark theme class.
   - Switches accent scheme to Purple; asserts primary color CSS variable updates.
2. **`Responsive_ViewportAudits_ZeroHorizontalOverflowAtAllBreakpoints`:**
   - Tests viewports:
     - Mobile: `375x812` (iPhone SE/mini)
     - Tablet: `768x1024` (iPad)
     - Narrow Desktop: `1280x800` (MacBook / standard laptop)
     - Full Desktop: `1920x1080`
   - In each viewport, asserts `document.documentElement.scrollWidth <= window.innerWidth`.
   - Verifies top bar actions, location tree drawer, and item card grid adapt without horizontal scrollbars.

---

## 4. Execution Plan & Sequential Checklist

- [ ] **Task 1: Shared E2E Infrastructure & Base Fixture**
  - Create `Tests/WhereHouse.Client.E2ETests/WhereHouseE2ETestBase.cs` with authentication, API seeding, and dialog helpers.
  - Verify base fixture runs cleanly and boots Kestrel in under 2 seconds.
  - Test command:
    ```powershell
    dotnet test Tests/WhereHouse.Client.E2ETests/WhereHouse.Client.E2ETests.csproj
    ```

- [ ] **Task 2: Core Workflows (Auth, Locations, Items & Attachments)**
  - Implement `Suites/01_AuthAndUserDirectoryE2ETests.cs` (5 tests).
  - Implement `Suites/02_LocationsAndContainersE2ETests.cs` (5 tests).
  - Implement `Suites/03_ItemsAndArchetypesE2ETests.cs` (5 tests).
  - Implement `Suites/04_ItemAttachmentsE2ETests.cs` (3 tests).
  - Run test suite:
    ```powershell
    dotnet test Tests/WhereHouse.Client.E2ETests/WhereHouse.Client.E2ETests.csproj
    ```

- [ ] **Task 3: Search, Barcodes, Scanner & Rapid Intake**
  - Implement `Suites/05_SmartSearchAndCommandPaletteE2ETests.cs` (4 tests).
  - Implement `Suites/06_BarcodeAndQrGenerationE2ETests.cs` (4 tests).
  - Implement `Suites/07_ScannerAndAuditScanE2ETests.cs` (3 tests).
  - Implement `Suites/08_RapidIntakeE2ETests.cs` (3 tests).
  - Run test suite:
    ```powershell
    dotnet test Tests/WhereHouse.Client.E2ETests/WhereHouse.Client.E2ETests.csproj
    ```

- [ ] **Task 4: Operations, Lifecycle, Vault & Responsive Polish**
  - Implement `Suites/09_CheckoutsAndLoadoutsE2ETests.cs` (4 tests).
  - Implement `Suites/10_MaintenanceAndUpkeepE2ETests.cs` (3 tests).
  - Implement `Suites/11_DeclutterAndGraveyardE2ETests.cs` (4 tests).
  - Implement `Suites/12_ActionCenterAndAlertsE2ETests.cs` (4 tests).
  - Implement `Suites/13_InsuranceVaultAndExportE2ETests.cs` (3 tests).
  - Implement `Suites/14_PortabilityAndImportExportE2ETests.cs` (3 tests).
  - Implement `Suites/15_CategoriesAndCustomAttributesE2ETests.cs` (2 tests).
  - Implement `Suites/16_ThemeAndResponsiveViewportsE2ETests.cs` (2 tests).
  - Run test suite:
    ```powershell
    dotnet test Tests/WhereHouse.Client.E2ETests/WhereHouse.Client.E2ETests.csproj
    ```

- [ ] **Task 5: Full Repository Verification & Formatting**
  - Run all .NET test suites (`Core`, `Infrastructure`, `API.IntegrationTests`, `Client.E2ETests`):
    ```powershell
    dotnet test
    ```
  - Run Angular unit tests & build:
    ```powershell
    cd WhereHouse.Client
    npm run lint
    npm run build
    npm test -- --watch=false
    cd ..
    ```
  - Format code:
    ```powershell
    dotnet csharpier format .
    ```
  - Mark plan status as `[x] Completed`.
