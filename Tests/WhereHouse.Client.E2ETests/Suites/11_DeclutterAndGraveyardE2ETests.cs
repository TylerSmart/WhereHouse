using Microsoft.Extensions.DependencyInjection;
using Microsoft.Playwright;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Data;

namespace WhereHouse.Client.E2ETests.Suites;

[TestClass]
public class DeclutterAndGraveyardE2ETests : WhereHouseE2ETestBase
{
    [TestMethod]
    public async Task Declutter_StageItemToSellAndDonate_RendersInStagedTab()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"stage_user_{suffix}",
            $"st_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Garage_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Espresso Machine_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".top-bar");

        var itemCard = Page.Locator(".item-card", new() { HasText = item.Name });
        await Expect(itemCard).ToBeVisibleAsync();

        // Open item actions menu -> Stage to Sell / Donate...
        var menuBtn = itemCard.Locator($"button[aria-label='Actions for {item.Name}']");
        await menuBtn.ClickAsync();

        var stageMenuOption = Page.Locator(
            "button[role='menuitem']",
            new() { HasText = "Stage to Sell / Donate..." }
        );
        await stageMenuOption.ClickAsync();

        var dialog = await WaitForActiveDialogAsync(Page);

        // Target price input
        var priceInput = dialog.Locator("input[type='number']");
        await priceInput.FillAsync("45.00");

        // Click Stage to Sell
        var stageBtn = dialog.Locator("button", new() { HasText = "Stage to Sell" });
        await stageBtn.ClickAsync();

        await Page.WaitForSelectorAsync(
            "mat-dialog-container",
            new() { State = WaitForSelectorState.Detached }
        );

        // Open Tools -> Declutter & Graveyard
        await OpenToolsMenuAndSelectAsync(Page, "Declutter & Graveyard");
        var declutterDialog = await WaitForActiveDialogAsync(Page);

        // Filter chips -> Staged to Sell
        var sellChip = declutterDialog.Locator(
            "mat-chip-option",
            new() { HasText = "Staged to Sell" }
        );
        await sellChip.ClickAsync();

        // Assert item row appears with price
        var itemRow = declutterDialog.Locator(".item-card-row", new() { HasText = item.Name });
        await Expect(itemRow).ToBeVisibleAsync();
        await Expect(itemRow).ToContainTextAsync("$45");

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Declutter_BulkUnstage_RestoresActiveStatus()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"unstage_user_{suffix}",
            $"un_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Attic_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Old Monitor_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".top-bar");

        var itemCard = Page.Locator(".item-card", new() { HasText = item.Name });
        await Expect(itemCard).ToBeVisibleAsync();

        // Open item actions menu -> Stage to Sell / Donate...
        var menuBtn = itemCard.Locator($"button[aria-label='Actions for {item.Name}']");
        await menuBtn.ClickAsync();
        await Page.Locator(
                "button[role='menuitem']",
                new() { HasText = "Stage to Sell / Donate..." }
            )
            .ClickAsync();

        var dialog = await WaitForActiveDialogAsync(Page);
        await dialog.Locator("button", new() { HasText = "Stage to Sell" }).ClickAsync();
        await Page.WaitForSelectorAsync(
            "mat-dialog-container",
            new() { State = WaitForSelectorState.Detached }
        );

        // Open Tools -> Declutter & Graveyard
        await OpenToolsMenuAndSelectAsync(Page, "Declutter & Graveyard");
        var declutterDialog = await WaitForActiveDialogAsync(Page);

        var itemRow = declutterDialog.Locator(".item-card-row", new() { HasText = item.Name });
        await Expect(itemRow).ToBeVisibleAsync();

        // Select checkbox for this item
        var chk = itemRow.Locator("input[type='checkbox']");
        await chk.ClickAsync();

        // Unstage (Keep) button appears in bulk actions bar
        var bulkUnstageBtn = declutterDialog.Locator(
            ".bulk-actions-bar button",
            new() { HasText = "Unstage (Keep)" }
        );
        await bulkUnstageBtn.ClickAsync();

        // Item should disappear from staged list
        await Expect(itemRow).ToBeHiddenAsync();

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Declutter_DustCollectors_QuickTouchResetsIdleTimer()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"dust_user_{suffix}",
            $"dust_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Closet_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Vintage Camera_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        // Update LastTouchedAt directly in database to simulate 200 days idle
        using (var scope = Fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WhereHouseDbContext>();
            var entity = await db.InventoryItems.FindAsync(item.Id);
            if (entity != null)
            {
                entity.LastTouchedAt = DateTimeOffset.UtcNow.AddDays(-200);
                await db.SaveChangesAsync();
            }
        }

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Declutter & Graveyard");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Switch to Dust Collectors tab
        var dustTabBtn = dialog.Locator("button.tab-btn", new() { HasText = "Dust Collectors" });
        await dustTabBtn.ClickAsync();

        // Select threshold > 6 Months (180d)
        var chip180 = dialog.Locator("mat-chip-option", new() { HasText = "> 6 Months (180d)" });
        await chip180.ClickAsync();

        // Item row should be visible
        var dustRow = dialog.Locator(".dust-item-row", new() { HasText = item.Name });
        await Expect(dustRow).ToBeVisibleAsync();

        // Click Quick Touch button to reset idle timer
        var touchBtn = dustRow.Locator("button[matTooltip*='Still using']");
        await touchBtn.ClickAsync();

        // Verify item is removed from dust list
        await Expect(dustRow).ToBeHiddenAsync();

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Declutter_ArchiveToGraveyardAndRestore_RoundTrips()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(Page, $"gy_user_{suffix}", $"gy_{suffix}@example.com");

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Study_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Old Laptop_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".top-bar");

        var itemCard = Page.Locator(".item-card", new() { HasText = item.Name });
        await Expect(itemCard).ToBeVisibleAsync();

        // Open menu -> Archive to Graveyard...
        var menuBtn = itemCard.Locator($"button[aria-label='Actions for {item.Name}']");
        await menuBtn.ClickAsync();
        await Page.Locator("button[role='menuitem']", new() { HasText = "Archive to Graveyard..." })
            .ClickAsync();

        var dialog = await WaitForActiveDialogAsync(Page);

        // Select disposition reason "Sold"
        var reasonSelect = dialog.Locator("mat-select");
        await reasonSelect.ClickAsync();
        await Page.Locator("mat-option", new() { HasText = "Sold" }).ClickAsync();

        // Fill sale price
        var priceInput = dialog.Locator("input[type='number']");
        await priceInput.FillAsync("40.00");

        // Fill note
        var noteInput = dialog.Locator("textarea");
        await noteInput.FillAsync("Sold on Craigslist");

        // Click Confirm Archive
        var confirmBtn = dialog.Locator("button", new() { HasText = "Confirm Archive" });
        await confirmBtn.ClickAsync();

        await Page.WaitForSelectorAsync(
            "mat-dialog-container",
            new() { State = WaitForSelectorState.Detached }
        );

        // Open Tools -> Declutter & Graveyard
        await OpenToolsMenuAndSelectAsync(Page, "Declutter & Graveyard");
        var declutterDialog = await WaitForActiveDialogAsync(Page);

        // Switch to Graveyard Archive tab
        var gyTabBtn = declutterDialog.Locator(
            "button.tab-btn",
            new() { HasText = "Graveyard Archive" }
        );
        await gyTabBtn.ClickAsync();

        // Assert item appears in archived list
        var archivedRow = declutterDialog.Locator(".archived-row", new() { HasText = item.Name });
        await Expect(archivedRow).ToBeVisibleAsync();
        await Expect(archivedRow).ToContainTextAsync("$40");

        // Click Restore
        var restoreBtn = archivedRow.Locator("button", new() { HasText = "Restore" });
        await restoreBtn.ClickAsync();

        // Verify row is removed from graveyard
        await Expect(archivedRow).ToBeHiddenAsync();

        await CloseActiveDialogAsync(Page);
    }
}
