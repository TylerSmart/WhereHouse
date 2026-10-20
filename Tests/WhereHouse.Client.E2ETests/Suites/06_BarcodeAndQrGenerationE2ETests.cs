using System;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.Client.E2ETests.Suites;

#pragma warning disable MSTEST0037

[TestClass]
public class BarcodeAndQrGenerationE2ETests : WhereHouseE2ETestBase
{
    [ClassInitialize]
    public static void ClassInit(TestContext context) => BaseClassInit(context);

    [ClassCleanup]
    public static void ClassCleanup() => BaseClassCleanup();

    [TestMethod]
    public async Task Labels_AddEntitiesToPrintQueue_RendersLivePreview()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"lbl_user_{suffix}",
            $"lbl_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Bin_A_{suffix}",
            LocationNodeType.MovableContainer
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Screwdriver_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        // Open Tools -> Print Barcode & QR Labels
        await OpenToolsMenuAndSelectAsync(Page, "Print Barcode & QR Labels");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Add container to queue
        var locSelect = dialog.Locator("mat-select").First;
        await locSelect.ClickAsync(new() { Force = true });
        var locOption = Page.Locator("mat-option", new() { HasText = loc.Name });
        await locOption.ClickAsync();

        // Verify label appears in preview
        var activeLabel = dialog.Locator(".label-cell.active-label", new() { HasText = loc.Name });
        await Expect(activeLabel).ToBeVisibleAsync();
        await Expect(activeLabel.Locator("img.qr-img")).ToBeVisibleAsync();

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Labels_ChangePreset_UpdatesSheetLayoutAndDimensions()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        await AuthenticateAsync(Page, $"preset_user_{suffix}", $"preset_{suffix}@example.com");

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Print Barcode & QR Labels");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Change format preset to Avery 5163
        var presetSelect = dialog.Locator(".settings-group mat-select").First;
        await presetSelect.ClickAsync(new() { Force = true });
        var presetOption = Page.Locator("mat-option", new() { HasText = "Avery 5163" });
        await presetOption.ClickAsync();

        // Verify live preview title reflects new preset
        var previewTitle = dialog.Locator(".preview-title");
        await Expect(previewTitle).ToContainTextAsync("Avery 5163");

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Labels_PartialSheetOffset_InsertsSkippedSpacerCells()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        await AuthenticateAsync(Page, $"offset_user_{suffix}", $"offset_{suffix}@example.com");

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Print Barcode & QR Labels");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Set Start Row = 2, Start Column = 2
        var rowInput = dialog.Locator(".offset-controls input").First;
        await rowInput.FillAsync("2");

        var colInput = dialog.Locator(".offset-controls input").Nth(1);
        await colInput.FillAsync("2");

        // Verify spacer cells are rendered in preview
        var spacerCells = dialog.Locator(".label-cell.spacer-cell");
        await Expect(spacerCells.First).ToBeVisibleAsync();
        await Expect(spacerCells.First.Locator(".spacer-text"))
            .ToContainTextAsync("Skipped (Used)");

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Labels_MintBlankStickers_AddsBatchToPrintQueue()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        await AuthenticateAsync(Page, $"mint_user_{suffix}", $"mint_{suffix}@example.com");

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Print Barcode & QR Labels");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Switch to Mint Blank QR Batch tab
        var mintTab = dialog.Locator("div[role='tab']", new() { HasText = "Mint Blank QR Batch" });
        await mintTab.ClickAsync();

        // Set count to 3
        var countInput = dialog.Locator("mat-tab-body input[type='number']");
        await countInput.FillAsync("3");

        // Click Generate & Queue Stickers
        var generateBtn = dialog.Locator("button", new() { HasText = "Generate & Queue Stickers" });
        await generateBtn.ClickAsync();

        // Verify 3 queued items in queue list
        var queueList = dialog.Locator(".queue-item-row");
        await Expect(queueList).ToHaveCountAsync(3);

        await CloseActiveDialogAsync(Page);
    }
}
