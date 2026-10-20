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
public class SmartSearchAndCommandPaletteE2ETests : WhereHouseE2ETestBase
{
    [ClassInitialize]
    public static void ClassInit(TestContext context) => BaseClassInit(context);

    [ClassCleanup]
    public static void ClassCleanup() => BaseClassCleanup();

    [TestMethod]
    public async Task SmartSearch_CtrlKShortcut_OpensCommandPalette()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        await AuthenticateAsync(Page, $"search_user_{suffix}", $"search_{suffix}@example.com");

        // Press Ctrl+K
        await Page.Keyboard.PressAsync("Control+k");

        // Verify command palette modal opens
        var dialog = await WaitForActiveDialogAsync(Page);
        var input = dialog.Locator("input.command-input");
        await Expect(input).ToBeVisibleAsync();

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task SmartSearch_TextQuery_FiltersAcrossBrandModelAndNotes()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"query_user_{suffix}",
            $"query_{suffix}@example.com"
        );

        // Seed item with unique brand and model
        var uniqueModel = $"MDL-{suffix}";
        using var client = CreateAuthenticatedApiClient(token);
        var req = new CreateItemRequest(
            Name: $"Cordless Router_{suffix}",
            Brand: "Bosch",
            ModelNumber: uniqueModel
        );
        var resp = await client.PostAsJsonAsync("/api/items", req);
        resp.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        // Open Smart Search
        await Page.Keyboard.PressAsync("Control+k");
        var dialog = await WaitForActiveDialogAsync(Page);

        var searchInput = dialog.Locator("input.command-input");
        await searchInput.FillAsync(uniqueModel);
        await searchInput.PressAsync("Enter");

        // Verify result contains seeded item
        var itemHit = dialog.Locator(
            ".item-result-row",
            new() { HasText = $"Cordless Router_{suffix}" }
        );
        await Expect(itemHit).ToBeVisibleAsync();

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task SmartSearch_FacetedFiltering_FiltersByCategory()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"facet_user_{suffix}",
            $"facet_{suffix}@example.com"
        );

        var catA = await CreateCategoryViaApiAsync(token, $"Woodworking_{suffix}");
        var catB = await CreateCategoryViaApiAsync(token, $"Electronics_{suffix}");

        using var client = CreateAuthenticatedApiClient(token);
        var itemAReq = new CreateItemRequest(Name: $"Chisel_{suffix}", CategoryId: catA.Id);
        await client.PostAsJsonAsync("/api/items", itemAReq);

        var itemBReq = new CreateItemRequest(Name: $"Multimeter_{suffix}", CategoryId: catB.Id);
        await client.PostAsJsonAsync("/api/items", itemBReq);

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        // Open search dialog
        await Page.Keyboard.PressAsync("Control+k");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Open filters panel
        var filterBtn = dialog.Locator("button.filter-toggle-btn");
        await filterBtn.ClickAsync();

        // Select Category A
        var catSelect = dialog.Locator(
            "mat-select",
            new() { Has = dialog.Locator("mat-label", new() { HasText = "Category" }) }
        );
        if (!await catSelect.IsVisibleAsync())
        {
            catSelect = dialog.Locator(".faceted-filter-panel mat-select").Nth(1);
        }
        await catSelect.ClickAsync(new() { Force = true });

        var catOption = Page.Locator("mat-option", new() { HasText = catA.Name });
        await catOption.ClickAsync();

        // Verify only Item A renders in results
        await Expect(dialog.Locator(".item-result-row", new() { HasText = $"Chisel_{suffix}" }))
            .ToBeVisibleAsync();
        await Expect(dialog.Locator(".item-result-row", new() { HasText = $"Multimeter_{suffix}" }))
            .ToHaveCountAsync(0);

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task SmartSearch_SelectResult_NavigatesDirectlyToTarget()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"nav_user_{suffix}",
            $"nav_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Attic_{suffix}",
            LocationNodeType.FixedLocation
        );

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await Page.Keyboard.PressAsync("Control+k");
        var dialog = await WaitForActiveDialogAsync(Page);

        var searchInput = dialog.Locator("input.command-input");
        await searchInput.FillAsync($"Attic_{suffix}");
        await searchInput.PressAsync("Enter");

        // Click location result card
        var locCard = dialog.Locator("button.location-hit-card", new() { HasText = loc.Name });
        await Expect(locCard).ToBeVisibleAsync();
        await locCard.ClickAsync();

        // Verify dashboard selected banner shows location
        var bannerHeading = Page.Locator(".title-with-shortcode h2");
        await Expect(bannerHeading).ToContainTextAsync(loc.Name);
    }
}
