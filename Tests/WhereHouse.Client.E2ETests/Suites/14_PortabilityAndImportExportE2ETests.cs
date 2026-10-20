using System.Net.Http.Json;
using Microsoft.Playwright;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.Client.E2ETests.Suites;

[TestClass]
public class PortabilityAndImportExportE2ETests : WhereHouseE2ETestBase
{
    [TestMethod]
    public async Task Portability_ExportJsonBundle_TriggersDownload()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"export_json_{suffix}",
            $"json_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Attic_{suffix}",
            LocationNodeType.FixedLocation
        );
        await CreateItemViaApiAsync(token, $"Luggage Set_{suffix}", ItemType.Unique, loc.Id);

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Import / Export CSV & ZIP");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Download JSON Bundle (.json)
        var downloadTask = Page.WaitForDownloadAsync();
        var downloadBtn = dialog.Locator(
            "button",
            new() { HasText = "Download JSON Bundle (.json)" }
        );
        await downloadBtn.ClickAsync();

        var download = await downloadTask;
        Assert.IsTrue(
            download.SuggestedFilename.EndsWith(".json", StringComparison.OrdinalIgnoreCase)
        );

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Portability_ExportCsv_TriggersDownload()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"export_csv_{suffix}",
            $"csv_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Garage_{suffix}",
            LocationNodeType.FixedLocation
        );
        await CreateItemViaApiAsync(token, $"Floor Jack_{suffix}", ItemType.Unique, loc.Id);

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Import / Export CSV & ZIP");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Download Items CSV (.csv)
        var downloadTask = Page.WaitForDownloadAsync();
        var downloadBtn = dialog.Locator("button", new() { HasText = "Download Items CSV (.csv)" });
        await downloadBtn.ClickAsync();

        var download = await downloadTask;
        Assert.IsTrue(
            download.SuggestedFilename.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)
        );

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Portability_ImportCsv_DryRunAndExecute()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        await AuthenticateAsync(Page, $"import_csv_{suffix}", $"imp_{suffix}@example.com");

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Import / Export CSV & ZIP");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Switch to Bulk Import tab
        var importTab = dialog.Locator(".mat-mdc-tab", new() { HasText = "Bulk Import" });
        await importTab.ClickAsync();

        // Paste CSV text
        var csvText =
            $"Name,Brand,ModelNumber\nCordless Drill_{suffix},DeWalt,DCD791\nImpact Driver_{suffix},Milwaukee,2853-20";
        var textarea = dialog.Locator("textarea[placeholder*='Paste CSV rows']");
        await textarea.FillAsync(csvText);

        // Click Run Dry-Run Preview
        var dryRunBtn = dialog.Locator("button", new() { HasText = "Run Dry-Run Preview" });
        await dryRunBtn.ClickAsync();

        // Verify dry-run status banner appears
        var statusBanner = dialog.Locator(".dry-run-status");
        await Expect(statusBanner).ToContainTextAsync("DRY-RUN VALIDATION");

        // Verify table displays 2 processed rows
        var rows = dialog.Locator(".preview-table tbody tr");
        await Expect(rows).ToHaveCountAsync(2);

        // Click Commit Import
        var commitBtn = dialog.Locator("button", new() { HasText = "Commit Import" });
        await commitBtn.ClickAsync();

        // Verify status changes to IMPORT COMMITTED
        await Expect(statusBanner).ToContainTextAsync("IMPORT COMMITTED");

        await CloseActiveDialogAsync(Page);
    }
}
