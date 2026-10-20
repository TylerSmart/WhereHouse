using System.Net.Http.Json;
using Microsoft.Playwright;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.Client.E2ETests.Suites;

[TestClass]
public class InsuranceVaultAndExportE2ETests : WhereHouseE2ETestBase
{
    [TestMethod]
    public async Task Insurance_ValuationDashboard_RendersSummaryMetrics()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"ins_user_{suffix}",
            $"ins_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Living Room_{suffix}",
            LocationNodeType.FixedLocation
        );

        using var client = CreateAuthenticatedApiClient(token);
        var itemReq = new CreateItemRequest(
            Name: $"OLED TV 65_{suffix}",
            Brand: "LG",
            ModelNumber: "C3",
            PurchasePrice: 1500m,
            EstimatedReplacementValue: 1800m,
            HomeLocationId: loc.Id
        );
        var resp = await client.PostAsJsonAsync("/api/items", itemReq);
        resp.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Insurance & Disaster Vault");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Verify summary banner metrics
        var totalValBox = dialog.Locator(".metric-box.total-val .metric-number");
        await Expect(totalValBox).ToBeVisibleAsync();
        await Expect(totalValBox).Not.ToHaveTextAsync("$0.00");

        // Verify item is present in table with its valuation
        var table = dialog.Locator("table.items-table");
        await Expect(table).ToBeVisibleAsync();
        var row = table.Locator("tr", new() { HasText = $"OLED TV 65_{suffix}" });
        await Expect(row).ToBeVisibleAsync();
        await Expect(row).ToContainTextAsync("$1,800");

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Insurance_ClaimBundlePreview_FiltersHighValueItems()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"filter_ins_{suffix}",
            $"f_ins_{suffix}@example.com"
        );

        var locGarage = await CreateLocationViaApiAsync(
            token,
            $"Garage_{suffix}",
            LocationNodeType.FixedLocation
        );
        var locOffice = await CreateLocationViaApiAsync(
            token,
            $"Office_{suffix}",
            LocationNodeType.FixedLocation
        );

        using var client = CreateAuthenticatedApiClient(token);

        // Item 1 in Garage
        var item1Req = new CreateItemRequest(
            Name: $"Miter Saw_{suffix}",
            Brand: "DeWalt",
            EstimatedReplacementValue: 400m,
            HomeLocationId: locGarage.Id
        );
        var resp1 = await client.PostAsJsonAsync("/api/items", item1Req);
        resp1.EnsureSuccessStatusCode();

        // Item 2 in Office
        var item2Req = new CreateItemRequest(
            Name: $"MacBook Pro_{suffix}",
            Brand: "Apple",
            EstimatedReplacementValue: 2500m,
            HomeLocationId: locOffice.Id
        );
        var resp2 = await client.PostAsJsonAsync("/api/items", item2Req);
        resp2.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Insurance & Disaster Vault");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Filter location scope to Garage
        var locSelect = dialog.Locator(".loc-field mat-select");
        await locSelect.ClickAsync();
        await Page.Locator("mat-option", new() { HasText = locGarage.Name }).ClickAsync();

        // Table should show Garage item but NOT Office item
        var sawRow = dialog.Locator(
            "table.items-table tr",
            new() { HasText = $"Miter Saw_{suffix}" }
        );
        var macRow = dialog.Locator(
            "table.items-table tr",
            new() { HasText = $"MacBook Pro_{suffix}" }
        );
        await Expect(sawRow).ToBeVisibleAsync();
        await Expect(macRow).ToBeHiddenAsync();

        // Reset location scope to All Household Locations
        await Page.WaitForTimeoutAsync(150);
        await locSelect.ClickAsync();
        var allLocOption = Page.Locator(
            "mat-option",
            new() { HasText = "All Household Locations" }
        );
        await allLocOption.WaitForAsync(new() { State = WaitForSelectorState.Visible });
        await allLocOption.ClickAsync();

        // Filter by Min Value: 1000
        var minValInput = dialog.Locator(".min-field input");
        await minValInput.FillAsync("1000");

        // Now MacBook Pro should be visible, Miter Saw should be hidden
        await Expect(macRow).ToBeVisibleAsync();
        await Expect(sawRow).ToBeHiddenAsync();

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Insurance_ExportZip_TriggersDownload()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"zip_user_{suffix}",
            $"zip_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Den_{suffix}",
            LocationNodeType.FixedLocation
        );

        using var client = CreateAuthenticatedApiClient(token);
        var itemReq = new CreateItemRequest(
            Name: $"Acoustic Guitar_{suffix}",
            Brand: "Taylor",
            EstimatedReplacementValue: 1200m,
            HomeLocationId: loc.Id
        );
        var resp = await client.PostAsJsonAsync("/api/items", itemReq);
        resp.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Insurance & Disaster Vault");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Trigger ZIP Download
        var downloadTask = Page.WaitForDownloadAsync();
        var downloadBtn = dialog.Locator(
            "button",
            new() { HasText = "Download Claim Package (.ZIP)" }
        );
        await downloadBtn.ClickAsync();

        var download = await downloadTask;
        Assert.IsTrue(
            download.SuggestedFilename.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)
        );

        await CloseActiveDialogAsync(Page);
    }
}
