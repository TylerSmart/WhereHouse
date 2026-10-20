using System;
using System.IO;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.Client.E2ETests.Suites;

#pragma warning disable MSTEST0037

[TestClass]
public class ItemsAndArchetypesE2ETests : WhereHouseE2ETestBase
{
    [ClassInitialize]
    public static void ClassInit(TestContext context) => BaseClassInit(context);

    [ClassCleanup]
    public static void ClassCleanup() => BaseClassCleanup();

    [TestMethod]
    public async Task Items_CreateUniqueAsset_WithWarrantyAndReturnPresets_DisplaysInGrid()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var itemName = $"Impact Driver_{suffix}";
        var token = await AuthenticateAsync(
            Page,
            $"item_user_{suffix}",
            $"item_{suffix}@example.com"
        );

        var location = await CreateLocationViaApiAsync(
            token,
            $"Workbench_{suffix}",
            LocationNodeType.FixedLocation
        );
        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={location.Id}");
        await Page.WaitForSelectorAsync(".selected-node-banner");

        // Open Add Item modal
        await Page.Locator(".banner-actions button", new() { HasText = "Add Item" }).ClickAsync();
        var dialog = await WaitForActiveDialogAsync(Page);

        await dialog.Locator("input[formControlName='name']").FillAsync(itemName);
        await dialog.Locator("input[formControlName='brand']").FillAsync("DeWalt");
        await dialog.Locator("input[formControlName='modelNumber']").FillAsync("DCF887");
        await dialog.Locator("input[formControlName='serialNumber']").FillAsync($"SN-{suffix}");

        // Use return window preset (+30d) and warranty preset (+1 yr)
        var returnPreset = dialog.Locator(".preset-chip-btn", new() { HasText = "+30d" });
        await returnPreset.ClickAsync();

        var warrantyPreset = dialog.Locator(".preset-chip-btn", new() { HasText = "+1 yr" });
        await warrantyPreset.ClickAsync();

        // Submit form
        await dialog.Locator("button", new() { HasText = "Create Item" }).ClickAsync();

        // Verify item card is displayed in grid
        var itemCard = Page.Locator(".item-card", new() { HasText = itemName });
        await Expect(itemCard).ToBeVisibleAsync();
        await Expect(itemCard.Locator(".item-brand-model")).ToContainTextAsync("DeWalt");
    }

    [TestMethod]
    public async Task Items_QuantityItem_StepperAdjustments_UpdatesStockAndLowStockAlert()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"qty_user_{suffix}",
            $"qty_{suffix}@example.com"
        );

        // Seed quantity item: quantity 5, minQuantity 4
        using var client = CreateAuthenticatedApiClient(token);
        var req = new CreateItemRequest(
            Name: $"AA Batteries_{suffix}",
            ItemType: ItemType.Quantity,
            CurrentQuantity: 5,
            MinQuantity: 4,
            Unit: "pack"
        );
        var resp = await client.PostAsJsonAsync("/api/items", req);
        var item = await resp.Content.ReadFromJsonAsync<ItemDto>();

        await Page.GotoAsync($"{Fixture.RootUri}/");
        var itemCard = Page.Locator(".item-card", new() { HasText = item!.Name });
        await Expect(itemCard).ToBeVisibleAsync();

        // Increment quantity via + button
        var plusBtn = itemCard.Locator(".step-btn", new() { HasText = "add" });
        await plusBtn.ClickAsync();
        await Expect(itemCard.Locator(".quantity-value")).ToContainTextAsync("6");

        // Decrement quantity twice to drop to 4 (low-stock threshold)
        var minusBtn = itemCard.Locator(".step-btn", new() { HasText = "remove" });
        await minusBtn.ClickAsync();
        await minusBtn.ClickAsync();
        await Expect(itemCard.Locator(".quantity-value")).ToContainTextAsync("4");

        // Verify low stock alert is visible
        var alert = itemCard.Locator(".low-stock-alert");
        await Expect(alert).ToBeVisibleAsync();
    }

    [TestMethod]
    public async Task Items_KitItem_ChildComponents_NavigatesToComponentItem()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"kit_user_{suffix}",
            $"kit_{suffix}@example.com"
        );

        // Seed child item
        var child = await CreateItemViaApiAsync(token, $"Child Part_{suffix}", ItemType.Unique);

        // Seed Kit item
        var kit = await CreateItemViaApiAsync(token, $"Master Kit_{suffix}", ItemType.Kit);

        // Associate child item with kit
        using var client = CreateAuthenticatedApiClient(token);
        var updateChildReq = new UpdateItemRequest(
            Name: child.Name,
            ItemType: child.ItemType,
            ParentItemId: kit.Id
        );
        var updateResp = await client.PutAsJsonAsync($"/api/items/{child.Id}", updateChildReq);
        updateResp.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/");
        var kitCard = Page.Locator(".item-card", new() { HasText = kit.Name });
        await Expect(kitCard).ToBeVisibleAsync();

        // Verify child component chip is rendered
        var childChip = kitCard.Locator(".child-chip-btn");
        await Expect(childChip).ToContainTextAsync(child.ShortCode);

        // Click component chip to open child item edit dialog
        await childChip.ClickAsync();
        var editDialog = await WaitForActiveDialogAsync(Page);
        await Expect(editDialog.Locator("input[formControlName='name']"))
            .ToHaveValueAsync(child.Name);

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Items_SecretGiftMode_EnforcesHouseholdPrivacyBoundaries()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var tokenAlice = await AuthenticateAsync(
            Page,
            $"alice_{suffix}",
            $"alice_{suffix}@example.com"
        );

        // Register Bob and Charlie
        var client = Fixture.CreateClient();
        var bobResp = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = $"bob_{suffix}@example.com",
                username = $"bob_{suffix}",
                password = "Password123!",
            }
        );
        var bob = await bobResp.Content.ReadFromJsonAsync<AuthResponseDto>();

        var charlieResp = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = $"charlie_{suffix}@example.com",
                username = $"charlie_{suffix}",
                password = "Password123!",
            }
        );

        // Alice creates Secret item shared ONLY with Bob
        var secretItem = await CreateItemViaApiAsync(
            tokenAlice,
            $"Birthday Present_{suffix}",
            ItemType.Unique,
            isPrivate: true,
            sharedWithUserIds: [] // Will retrieve Bob's guid
        );

        // Get Bob's GUID via users list
        using var clientAlice = CreateAuthenticatedApiClient(tokenAlice);
        var users = await clientAlice.GetFromJsonAsync<UserSummaryDto[]>("/api/auth/users");
        var bobSummary = Array.Find(users!, u => u.Username == $"bob_{suffix}");

        // Update item to share with Bob
        var updateReq = new UpdateItemRequest(
            Name: secretItem.Name,
            ItemType: secretItem.ItemType,
            IsPrivate: true,
            SharedWithUserIds: [bobSummary!.Id]
        );
        await clientAlice.PutAsJsonAsync($"/api/items/{secretItem.Id}", updateReq);

        // 1. Alice can see the item
        await Page.GotoAsync($"{Fixture.RootUri}/");
        var aliceCard = Page.Locator(".item-card", new() { HasText = secretItem.Name });
        await Expect(aliceCard).ToBeVisibleAsync();

        // 2. Bob can see the item
        var pageBob = await Browser.NewPageAsync();
        await AuthenticateAsync(pageBob, $"bob_{suffix}", $"bob_{suffix}@example.com");
        var bobCard = pageBob.Locator(".item-card", new() { HasText = secretItem.Name });
        await Expect(bobCard).ToBeVisibleAsync();
        await pageBob.CloseAsync();

        // 3. Charlie CANNOT see the item
        var pageCharlie = await Browser.NewPageAsync();
        await AuthenticateAsync(pageCharlie, $"charlie_{suffix}", $"charlie_{suffix}@example.com");
        var charlieCard = pageCharlie.Locator(".item-card", new() { HasText = secretItem.Name });
        await Expect(charlieCard).ToHaveCountAsync(0);
        await pageCharlie.CloseAsync();
    }

    [TestMethod]
    public async Task Items_CloneItem_AppendsCopyAndDuplicatesMetadata()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"clone_user_{suffix}",
            $"clone_{suffix}@example.com"
        );

        var original = await CreateItemViaApiAsync(token, $"Power Drill_{suffix}", ItemType.Unique);

        await Page.GotoAsync($"{Fixture.RootUri}/");
        var itemCard = Page.Locator(".item-card", new() { HasText = original.Name });
        await Expect(itemCard).ToBeVisibleAsync();

        // Open menu and click Clone & Edit...
        var menuBtn = itemCard.Locator("button", new() { HasText = "more_vert" });
        await menuBtn.ClickAsync();

        var cloneItem = Page.Locator(
            "button[role='menuitem']",
            new() { HasText = "Clone & Edit..." }
        );
        await cloneItem.ClickAsync();

        var dialog = await WaitForActiveDialogAsync(Page);
        var nameInput = dialog.Locator("input[formControlName='name']");
        await Expect(nameInput).ToHaveValueAsync($"{original.Name} (Copy)");

        // Submit cloned item
        await dialog.Locator("button", new() { HasText = "Create Cloned Item" }).ClickAsync();

        // Verify both original and copy are rendered
        var clonedCard = Page.Locator(".item-card", new() { HasText = $"{original.Name} (Copy)" });
        await Expect(clonedCard).ToBeVisibleAsync();
    }
}
