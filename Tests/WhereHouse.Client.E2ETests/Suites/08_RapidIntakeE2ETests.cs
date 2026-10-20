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
public class RapidIntakeE2ETests : WhereHouseE2ETestBase
{
    [ClassInitialize]
    public static void ClassInit(TestContext context) => BaseClassInit(context);

    [ClassCleanup]
    public static void ClassCleanup() => BaseClassCleanup();

    [TestMethod]
    public async Task RapidIntake_LockLocationAndAddMultipleItems_WithoutLeavingModal()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"rapid_user_{suffix}",
            $"rapid_{suffix}@example.com"
        );

        var bin = await CreateLocationViaApiAsync(
            token,
            $"Storage Tote_{suffix}",
            LocationNodeType.MovableContainer
        );

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        // Open Rapid Intake
        await OpenQuickAddAndSelectAsync(Page, "Rapid Intake");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Lock Location to Storage Tote
        var locField = dialog.Locator(".context-controls mat-form-field").First;
        await locField.ClickAsync();
        var locOption = Page.Locator("mat-option", new() { HasText = bin.Name });
        await locOption.ClickAsync();

        // Add first item: Screwdriver
        var nameInput = dialog.Locator("input[formControlName='name']");
        await nameInput.FillAsync($"Screwdriver_{suffix}");
        var submitBtn = dialog.Locator("button.submit-button");
        await submitBtn.ClickAsync();

        // Verify Screwdriver is in session feed
        var item1Feed = dialog.Locator(
            ".feed-item-card",
            new() { HasText = $"Screwdriver_{suffix}" }
        );
        await Expect(item1Feed).ToBeVisibleAsync();

        // Add second item: Pliers
        await nameInput.FillAsync($"Pliers_{suffix}");
        await submitBtn.ClickAsync();

        // Verify both items in session feed
        var item2Feed = dialog.Locator(".feed-item-card", new() { HasText = $"Pliers_{suffix}" });
        await Expect(item2Feed).ToBeVisibleAsync();

        // Close dialog
        await dialog.Locator("button", new() { HasText = "Done" }).ClickAsync();
    }

    [TestMethod]
    public async Task RapidIntake_BarcodeLookup_PreFillsRetailData()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"upc_user_{suffix}",
            $"upc_{suffix}@example.com"
        );

        var barcode = $"088591{Random.Shared.Next(100000, 999999)}";
        // Seed item with barcode into household catalog
        using var client = CreateAuthenticatedApiClient(token);
        var seedReq = new CreateItemRequest(
            Name: $"Hammer Drill_{suffix}",
            Brand: "DeWalt",
            BarcodeNumber: barcode
        );
        var resp = await client.PostAsJsonAsync("/api/items", seedReq);
        resp.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenQuickAddAndSelectAsync(Page, "Rapid Intake");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Enter Barcode in rapid intake
        var barcodeInput = dialog.Locator("input[formControlName='barcodeNumber']");
        await barcodeInput.FillAsync(barcode);

        // Click lookup button
        var lookupBtn = dialog.Locator(".barcode-field button");
        await lookupBtn.ClickAsync();

        // Assert auto-populated name and brand
        var nameInput = dialog.Locator("input[formControlName='name']");
        await Expect(nameInput).ToHaveValueAsync($"Hammer Drill_{suffix}");

        var brandInput = dialog.Locator("input[formControlName='brand']");
        await Expect(brandInput).ToHaveValueAsync("DeWalt");

        await dialog.Locator("button", new() { HasText = "Done" }).ClickAsync();
    }

    [TestMethod]
    public async Task RapidIntake_SessionQueueActions_AdjustQuantityAndRemove()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"qty_rapid_{suffix}",
            $"qty_rapid_{suffix}@example.com"
        );

        var bin = await CreateLocationViaApiAsync(
            token,
            $"Hardware Box_{suffix}",
            LocationNodeType.MovableContainer
        );

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenQuickAddAndSelectAsync(Page, "Rapid Intake");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Lock Location
        var locField = dialog.Locator(".context-controls mat-form-field").First;
        await locField.ClickAsync();
        var locOption = Page.Locator("mat-option", new() { HasText = bin.Name });
        await locOption.ClickAsync();

        // Switch Default Type to Quantity / Bulk
        var typeField = dialog.Locator(".context-field-sm");
        await typeField.ClickAsync();
        var qtyOption = Page.Locator("mat-option", new() { HasText = "Quantity / Bulk" });
        await qtyOption.ClickAsync();

        // Add item
        var nameInput = dialog.Locator("input[formControlName='name']");
        await nameInput.FillAsync($"Drywall Screws_{suffix}");
        var submitBtn = dialog.Locator("button.submit-button");
        await submitBtn.ClickAsync();

        var feedItem = dialog.Locator(
            ".feed-item-card",
            new() { HasText = $"Drywall Screws_{suffix}" }
        );
        await Expect(feedItem).ToBeVisibleAsync();

        // Increment quantity in session stepper
        var plusBtn = feedItem.Locator(".qty-stepper button:has(mat-icon:text('add'))");
        await plusBtn.ClickAsync();

        // Verify quantity display becomes 2
        var qtyDisplay = feedItem.Locator(".qty-display");
        await Expect(qtyDisplay).ToContainTextAsync("2");

        await dialog.Locator("button", new() { HasText = "Done" }).ClickAsync();
    }
}
