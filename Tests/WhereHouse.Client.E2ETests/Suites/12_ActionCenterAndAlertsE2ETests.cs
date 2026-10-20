using System.Net.Http.Json;
using Microsoft.Playwright;
using WhereHouse.Core.Checkouts;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.Maintenance;

namespace WhereHouse.Client.E2ETests.Suites;

[TestClass]
public class ActionCenterAndAlertsE2ETests : WhereHouseE2ETestBase
{
    [TestMethod]
    public async Task ActionCenter_AlertBadge_DisplaysTotalActionCount()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(Page, $"ac_user_{suffix}", $"ac_{suffix}@example.com");

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Garage_{suffix}",
            LocationNodeType.FixedLocation
        );

        using var client = CreateAuthenticatedApiClient(token);

        // 1. Overdue loan item
        var item1 = await CreateItemViaApiAsync(
            token,
            $"Power Drill_{suffix}",
            ItemType.Unique,
            loc.Id
        );
        var checkoutReq = new CheckoutItemRequest(
            IsExternalLoan: true,
            BorrowerName: "Dave",
            ExpectedReturnAt: DateTimeOffset.UtcNow.AddDays(-2),
            ProjectOrNote: "Fence repair"
        );
        var resp1 = await client.PostAsJsonAsync(
            $"/api/checkouts/items/{item1.Id}/checkout",
            checkoutReq
        );
        resp1.EnsureSuccessStatusCode();

        // 2. Due maintenance task
        var item2 = await CreateItemViaApiAsync(
            token,
            $"Lawn Mower_{suffix}",
            ItemType.Unique,
            loc.Id
        );
        var maintReq = new CreateMaintenanceScheduleRequest(
            Title: $"Blade Sharpening_{suffix}",
            IntervalValue: 30,
            IntervalUnit: MaintenanceIntervalUnit.Days,
            FirstDueAt: DateTimeOffset.UtcNow.AddDays(-3)
        );
        var resp2 = await client.PostAsJsonAsync(
            $"/api/maintenance/items/{item2.Id}/schedules",
            maintReq
        );
        resp2.EnsureSuccessStatusCode();

        // 3. Low stock item
        var lowStockReq = new CreateItemRequest(
            Name: $"Drywall Anchors_{suffix}",
            ItemType: ItemType.Quantity,
            CurrentQuantity: 2m,
            MinQuantity: 10m,
            HomeLocationId: loc.Id
        );
        var resp3 = await client.PostAsJsonAsync("/api/items", lowStockReq);
        resp3.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        // Verify Action Center button badge displays alerts
        var badge = Page.Locator(".action-center-btn .alert-pill-badge");
        await Expect(badge).ToBeVisibleAsync();
        await Expect(badge).Not.ToHaveTextAsync("0");
    }

    [TestMethod]
    public async Task ActionCenter_OpenDialog_DisplaysCategorizedMetrics()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"kpi_user_{suffix}",
            $"kpi_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Basement_{suffix}",
            LocationNodeType.FixedLocation
        );

        using var client = CreateAuthenticatedApiClient(token);

        // Seed 1 overdue loan
        var item1 = await CreateItemViaApiAsync(
            token,
            $"Extension Cord_{suffix}",
            ItemType.Unique,
            loc.Id
        );
        var checkoutReq = new CheckoutItemRequest(
            IsExternalLoan: true,
            BorrowerName: "Sarah",
            ExpectedReturnAt: DateTimeOffset.UtcNow.AddDays(-1)
        );
        var resp1 = await client.PostAsJsonAsync(
            $"/api/checkouts/items/{item1.Id}/checkout",
            checkoutReq
        );
        resp1.EnsureSuccessStatusCode();

        // Seed 1 due maintenance
        var item2 = await CreateItemViaApiAsync(
            token,
            $"Air Compressor_{suffix}",
            ItemType.Unique,
            loc.Id
        );
        var maintReq = new CreateMaintenanceScheduleRequest(
            Title: $"Drain Tank_{suffix}",
            IntervalValue: 30,
            IntervalUnit: MaintenanceIntervalUnit.Days,
            FirstDueAt: DateTimeOffset.UtcNow.AddDays(-1)
        );
        var resp2 = await client.PostAsJsonAsync(
            $"/api/maintenance/items/{item2.Id}/schedules",
            maintReq
        );
        resp2.EnsureSuccessStatusCode();

        // Seed 1 low stock item
        var item3Req = new CreateItemRequest(
            Name: $"AA Batteries_{suffix}",
            ItemType: ItemType.Quantity,
            CurrentQuantity: 1m,
            MinQuantity: 8m,
            HomeLocationId: loc.Id
        );
        var resp3 = await client.PostAsJsonAsync("/api/items", item3Req);
        resp3.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        // Open Action Center
        await Page.Locator(".action-center-btn").ClickAsync();
        var dialog = await WaitForActiveDialogAsync(Page);

        // Assert categorized metric chips are visible and non-zero
        var loansVal = dialog.Locator(".kpi-chip.loans .kpi-val");
        await Expect(loansVal).Not.ToHaveTextAsync("0");

        var maintVal = dialog.Locator(".kpi-chip.maintenance .kpi-val");
        await Expect(maintVal).Not.ToHaveTextAsync("0");

        var stockVal = dialog.Locator(".kpi-chip.low-stock .kpi-val");
        await Expect(stockVal).Not.ToHaveTextAsync("0");

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task ActionCenter_QuickResolveAction_UpdatesCountsInPlace()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"resolve_user_{suffix}",
            $"res_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Shed_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Pressure Washer_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        using var client = CreateAuthenticatedApiClient(token);
        var checkoutReq = new CheckoutItemRequest(
            IsExternalLoan: true,
            BorrowerName: "Mark",
            ExpectedReturnAt: DateTimeOffset.UtcNow.AddDays(-3)
        );
        var resp = await client.PostAsJsonAsync(
            $"/api/checkouts/items/{item.Id}/checkout",
            checkoutReq
        );
        resp.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        // Open Action Center
        await Page.Locator(".action-center-btn").ClickAsync();
        var dialog = await WaitForActiveDialogAsync(Page);

        // Find loan card
        var loanCard = dialog.Locator(".loan-card", new() { HasText = item.Name });
        await Expect(loanCard).ToBeVisibleAsync();

        // Click Mark Returned
        var returnBtn = loanCard.Locator("button", new() { HasText = "Mark Returned" });
        await returnBtn.ClickAsync();

        // Loan card disappears
        await Expect(loanCard).ToBeHiddenAsync();

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task ActionCenter_SendDigestNow_DispatchesImmediateNotification()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        await AuthenticateAsync(Page, $"digest_user_{suffix}", $"dig_{suffix}@example.com");

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        // Open Action Center
        await Page.Locator(".action-center-btn").ClickAsync();
        var dialog = await WaitForActiveDialogAsync(Page);

        // Click Send Digest Now
        var sendDigestBtn = dialog.Locator("button.send-digest-btn");
        await sendDigestBtn.ClickAsync();

        // Assert snackbar appears
        var snackbar = Page.Locator("mat-snack-bar-container, .mdc-snackbar");
        await Expect(snackbar).ToContainTextAsync("Digest sent!");

        await CloseActiveDialogAsync(Page);
    }
}
