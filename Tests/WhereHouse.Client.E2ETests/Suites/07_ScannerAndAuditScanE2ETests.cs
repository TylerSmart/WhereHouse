using System;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.QrCodes;

namespace WhereHouse.Client.E2ETests.Suites;

#pragma warning disable MSTEST0037

[TestClass]
public class ScannerAndAuditScanE2ETests : WhereHouseE2ETestBase
{
    [ClassInitialize]
    public static void ClassInit(TestContext context) => BaseClassInit(context);

    [ClassCleanup]
    public static void ClassCleanup() => BaseClassCleanup();

    [TestMethod]
    public async Task Scanner_ManualShortCodeLookup_NavigatesToEntity()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"scan_user_{suffix}",
            $"scan_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Pantry_{suffix}",
            LocationNodeType.FixedLocation
        );

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        // Open Scanner dialog from top bar
        var scanBtn = Page.Locator(".top-bar button:has(mat-icon:text('qr_code_scanner'))");
        await scanBtn.ClickAsync();
        var dialog = await WaitForActiveDialogAsync(Page);

        // Enter known location short code
        var input = dialog.Locator("input.scan-text-input").First;
        await input.FillAsync(loc.ShortCode);

        var scanActionBtn = dialog.Locator(".scan-bar button", new() { HasText = "Scan" });
        await scanActionBtn.ClickAsync();

        // Verify resolution card renders location name
        var resCard = dialog.Locator(".resolution-card.location-card");
        await Expect(resCard).ToBeVisibleAsync();
        await Expect(resCard.Locator(".entity-name")).ToContainTextAsync(loc.Name);

        // Click Open in Tree button
        var openBtn = resCard.Locator("button", new() { HasText = "Open in Tree" });
        await openBtn.ClickAsync();

        // Verify dashboard selected banner shows location
        var bannerHeading = Page.Locator(".title-with-shortcode h2");
        await Expect(bannerHeading).ToContainTextAsync(loc.Name);
    }

    [TestMethod]
    public async Task Scanner_BindUnassignedSticker_BindsToItem()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"bind_user_{suffix}",
            $"bind_{suffix}@example.com"
        );

        var item = await CreateItemViaApiAsync(token, $"Wrench_{suffix}", ItemType.Unique);

        // Mint a blank QR code via API
        using var client = CreateAuthenticatedApiClient(token);
        var mintReq = new GenerateQrCodeBatchRequest(
            Count: 1,
            Prefix: "QR",
            LabelNote: "Test Sticker"
        );
        var mintResp = await client.PostAsJsonAsync("/api/qrcodes/batch", mintReq);
        mintResp.EnsureSuccessStatusCode();
        var qrs = await mintResp.Content.ReadFromJsonAsync<QrCodeDto[]>();
        var blankToken = qrs![0].Token;

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");
        var itemCard = Page.Locator(".item-card", new() { HasText = item.Name });
        await Expect(itemCard).ToBeVisibleAsync();

        var scanBtn = Page.Locator(".top-bar button:has(mat-icon:text('qr_code_scanner'))");
        await scanBtn.ClickAsync();
        var dialog = await WaitForActiveDialogAsync(Page);

        // Scan the blank sticker token
        var input = dialog.Locator("input.scan-text-input").First;
        await input.FillAsync(blankToken);
        var scanActionBtn = dialog.Locator(".scan-bar button", new() { HasText = "Scan" });
        await scanActionBtn.ClickAsync();

        // Verify unassigned card is shown
        var unassignedCard = dialog.Locator(".resolution-card.unassigned-card");
        await Expect(unassignedCard).ToBeVisibleAsync();

        // Select Target Type = Inventory Item
        var typeSelect = unassignedCard.Locator("mat-select").First;
        await typeSelect.ClickAsync(new() { Force = true });
        var itemTypeOption = Page.Locator("mat-option", new() { HasText = "Inventory Item" });
        await itemTypeOption.ClickAsync();

        // Select the item
        var itemSelect = unassignedCard
            .Locator("mat-form-field", new() { HasText = "Select Item" })
            .Locator("mat-select");
        await Expect(itemSelect).ToBeVisibleAsync();
        await itemSelect.ClickAsync(new() { Force = true });
        var itemOption = Page.Locator("mat-option", new() { HasText = item.Name });
        await itemOption.ClickAsync();

        // Click Bind Sticker button
        var bindBtn = unassignedCard.Locator(
            "button",
            new() { HasText = "Bind Sticker to Selected Entity" }
        );
        await bindBtn.ClickAsync();

        // Verify binding success (resolution changes to resolved item)
        await Expect(dialog.Locator(".resolution-card.item-card")).ToBeVisibleAsync();

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Scanner_BulkMoveAuditScan_VerifiesContainerContents()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"audit_user_{suffix}",
            $"audit_{suffix}@example.com"
        );

        var destination = await CreateLocationViaApiAsync(
            token,
            $"Bin_Dest_{suffix}",
            LocationNodeType.MovableContainer
        );
        var item1 = await CreateItemViaApiAsync(token, $"Item1_{suffix}", ItemType.Unique);

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");
        var itemCard = Page.Locator(".item-card", new() { HasText = item1.Name });
        await Expect(itemCard).ToBeVisibleAsync();

        var scanBtn = Page.Locator(".top-bar button:has(mat-icon:text('qr_code_scanner'))");
        await scanBtn.ClickAsync();
        var dialog = await WaitForActiveDialogAsync(Page);

        // Switch to Scan-to-Audit / Move tab
        var auditTab = dialog.Locator(
            "div[role='tab']",
            new() { HasText = "Scan-to-Audit / Move" }
        );
        await auditTab.ClickAsync();

        // Select destination location
        var destSelect = dialog.Locator(".dest-selector mat-select");
        await destSelect.ClickAsync(new() { Force = true });
        var destOption = Page.Locator("mat-option", new() { HasText = destination.Name });
        await destOption.ClickAsync();

        // Scan item into destination
        var auditInput = dialog.Locator(".audit-tab input.scan-text-input");
        await auditInput.FillAsync(item1.ShortCode);

        var auditMoveBtn = dialog.Locator(".audit-tab button", new() { HasText = "Audit Move" });
        await auditMoveBtn.ClickAsync();

        // Verify stat counter updates
        var movedCounter = dialog.Locator(".stat-item.moved .stat-count");
        await Expect(movedCounter).ToContainTextAsync("1");

        await CloseActiveDialogAsync(Page);
    }
}
