using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.Playwright;
using WhereHouse.Core.Checkouts;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.Client.E2ETests.Suites;

[TestClass]
public class CheckoutsAndLoadoutsE2ETests : WhereHouseE2ETestBase
{
    [TestMethod]
    public async Task Checkouts_LoanItemToBorrower_DisplaysInUseBannerAndOverdueStatus()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"loan_user_{suffix}",
            $"loan_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Garage_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Lawn Mower_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".top-bar");

        var itemCard = Page.Locator(".item-card", new() { HasText = item.Name });
        await Expect(itemCard).ToBeVisibleAsync();

        // Open item actions menu
        var menuBtn = itemCard.Locator($"button[aria-label='Actions for {item.Name}']");
        await menuBtn.ClickAsync();

        // Select Check Out / Loan...
        var checkoutMenuOption = Page.Locator(
            "button[role='menuitem']",
            new() { HasText = "Check Out / Loan..." }
        );
        await checkoutMenuOption.ClickAsync();

        var dialog = await WaitForActiveDialogAsync(Page);

        // Select External Loan
        var loanRadio = dialog.Locator("mat-radio-button[value='loan']");
        await loanRadio.ClickAsync();

        // Fill borrower name
        var borrowerInput = dialog.Locator("input[placeholder='e.g. Dave Miller']");
        await borrowerInput.FillAsync("Neighbor Dave");

        // Fill expected return date (yesterday = overdue)
        var returnDateInput = dialog.Locator("input[placeholder='Choose return date']");
        await returnDateInput.FillAsync(DateTime.UtcNow.AddDays(-2).ToString("MM/dd/yyyy"));

        // Submit checkout
        var submitBtn = dialog.Locator("button", new() { HasText = "Check Out" });
        await submitBtn.ClickAsync();

        // Verify card displays checkout banner with overdue status
        var banner = itemCard.Locator(".checkout-status-banner");
        await Expect(banner).ToBeVisibleAsync();
        await Expect(banner).ToContainTextAsync("Loaned to Neighbor Dave");
        await Expect(banner).ToHaveClassAsync(new Regex("overdue"));
    }

    [TestMethod]
    public async Task Checkouts_ReturnItem_RestoresInPlaceStatus()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"return_user_{suffix}",
            $"ret_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Shed_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Hedge Trimmer_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        // Check out item via API
        using var client = CreateAuthenticatedApiClient(token);
        var checkoutReq = new CheckoutItemRequest(
            IsExternalLoan: true,
            BorrowerName: "Bob",
            ExpectedReturnAt: DateTimeOffset.UtcNow.AddDays(5),
            ProjectOrNote: "Trimming shrubs"
        );
        var resp = await client.PostAsJsonAsync(
            $"/api/checkouts/items/{item.Id}/checkout",
            checkoutReq
        );
        resp.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".top-bar");

        var itemCard = Page.Locator(".item-card", new() { HasText = item.Name });
        await Expect(itemCard).ToBeVisibleAsync();

        // Verify initially loaned
        var banner = itemCard.Locator(".checkout-status-banner");
        await Expect(banner).ToBeVisibleAsync();

        // Open menu -> Loan / Return Details...
        var menuBtn = itemCard.Locator($"button[aria-label='Actions for {item.Name}']");
        await menuBtn.ClickAsync();

        var detailsOption = Page.Locator(
            "button[role='menuitem']",
            new() { HasText = "Loan / Return Details..." }
        );
        await detailsOption.ClickAsync();

        var dialog = await WaitForActiveDialogAsync(Page);

        // Click Return to Home Bin
        var returnBtn = dialog.Locator("button", new() { HasText = "Return to Home Bin" });
        await returnBtn.ClickAsync();

        // Verify status reverted to In Place (no banner)
        await Expect(banner).ToBeHiddenAsync();
    }

    [TestMethod]
    public async Task Checkouts_ProjectCart_BatchCheckout()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"cart_user_{suffix}",
            $"cart_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Workshop_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item1 = await CreateItemViaApiAsync(
            token,
            $"Tape Measure_{suffix}",
            ItemType.Unique,
            loc.Id
        );
        var item2 = await CreateItemViaApiAsync(
            token,
            $"Speed Square_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".top-bar");

        // Add item1 to cart via card menu
        var item1Card = Page.Locator(".item-card", new() { HasText = item1.Name });
        await Expect(item1Card).ToBeVisibleAsync();
        var menuBtn1 = item1Card.Locator($"button[aria-label='Actions for {item1.Name}']");
        await menuBtn1.ClickAsync();
        await Page.Locator("button[role='menuitem']", new() { HasText = "Add to Project Cart" })
            .ClickAsync();
        await Page.Keyboard.PressAsync("Escape");
        await Page.Locator(".cdk-overlay-backdrop")
            .WaitForAsync(new() { State = WaitForSelectorState.Detached });

        // Add item2 to cart via card menu
        var item2Card = Page.Locator(".item-card", new() { HasText = item2.Name });
        await Expect(item2Card).ToBeVisibleAsync();
        var menuBtn2 = item2Card.Locator($"button[aria-label='Actions for {item2.Name}']");
        await menuBtn2.ClickAsync();
        await Page.Locator("button[role='menuitem']", new() { HasText = "Add to Project Cart" })
            .ClickAsync();
        await Page.Keyboard.PressAsync("Escape");
        await Page.Locator(".cdk-overlay-backdrop")
            .WaitForAsync(new() { State = WaitForSelectorState.Detached });

        // Verify cart badge count is 2
        var cartBadge = Page.Locator(".project-cart-btn .cart-pill-badge");
        await Expect(cartBadge).ToHaveTextAsync("2");

        // Open cart
        await Page.Locator(".project-cart-btn").ClickAsync();
        var dialog = await WaitForActiveDialogAsync(Page);

        // Fill project note
        var noteInput = dialog.Locator("input[placeholder*='Garage cleanup']");
        await noteInput.FillAsync("Deck Framing Project");

        // Click Check Out All Cart Items
        var checkoutAllBtn = dialog.Locator(
            "button",
            new() { HasText = "Check Out All Cart Items" }
        );
        await checkoutAllBtn.ClickAsync();

        // Wait for dialog to close
        await Page.WaitForSelectorAsync(
            "mat-dialog-container",
            new() { State = WaitForSelectorState.Detached }
        );

        // Both items should show checkout banner with note
        var banner1 = item1Card.Locator(".checkout-status-banner");
        await Expect(banner1).ToBeVisibleAsync();
        await Expect(banner1).ToContainTextAsync("Deck Framing Project");

        var banner2 = item2Card.Locator(".checkout-status-banner");
        await Expect(banner2).ToBeVisibleAsync();
        await Expect(banner2).ToContainTextAsync("Deck Framing Project");
    }

    [TestMethod]
    public async Task Checkouts_LoadoutTemplates_CreateDeployAndReturn()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"loadout_user_{suffix}",
            $"lo_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Camp Locker_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item1 = await CreateItemViaApiAsync(
            token,
            $"Sleeping Bag_{suffix}",
            ItemType.Unique,
            loc.Id
        );
        var item2 = await CreateItemViaApiAsync(
            token,
            $"Camp Stove_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".top-bar");

        // Open Loadouts via Tools menu
        await OpenToolsMenuAndSelectAsync(Page, "Loadouts & Loans");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Click New Loadout Template
        var newTemplateBtn = dialog.Locator("button", new() { HasText = "New Loadout Template" });
        await newTemplateBtn.ClickAsync();

        // Fill loadout name
        var nameInput = dialog.Locator("input[placeholder*='Weekend Camping']");
        await nameInput.FillAsync($"Camping Essentials_{suffix}");

        // Select items in dropdown
        var itemSelect = dialog.Locator("mat-select[placeholder='Select items to include']");
        await itemSelect.ClickAsync();

        var opt1 = Page.Locator("mat-option", new() { HasText = item1.Name });
        await opt1.ClickAsync();
        var opt2 = Page.Locator("mat-option", new() { HasText = item2.Name });
        await opt2.ClickAsync();

        // Close select dropdown
        await Page.Keyboard.PressAsync("Escape");

        // Save Template
        var saveBtn = dialog.Locator("button", new() { HasText = "Save Template" });
        await saveBtn.ClickAsync();

        // Verify template card appears
        var loadoutCard = dialog.Locator(
            ".loadout-card",
            new() { HasText = $"Camping Essentials_{suffix}" }
        );
        await Expect(loadoutCard).ToBeVisibleAsync();

        // Deploy / Check out loadout
        var checkoutBtn = loadoutCard.Locator("button", new() { HasText = "Check Out Loadout" });
        await checkoutBtn.ClickAsync();

        // Verify loadout status changes to Active Checkout and Pack-Back button appears
        var packBackBtn = loadoutCard.Locator(
            "button",
            new() { HasText = "Pack-Back & Reconcile" }
        );
        await Expect(packBackBtn).ToBeVisibleAsync();

        // Close dialog
        await CloseActiveDialogAsync(Page);

        // Item cards on dashboard show active loadout
        var item1Card = Page.Locator(".item-card", new() { HasText = item1.Name });
        var banner1 = item1Card.Locator(".checkout-status-banner");
        await Expect(banner1).ToBeVisibleAsync();
        await Expect(banner1).ToContainTextAsync($"Camping Essentials_{suffix}");

        // Return loadout: Re-open Loadouts dialog
        await OpenToolsMenuAndSelectAsync(Page, "Loadouts & Loans");
        dialog = await WaitForActiveDialogAsync(Page);

        loadoutCard = dialog.Locator(
            ".loadout-card",
            new() { HasText = $"Camping Essentials_{suffix}" }
        );
        packBackBtn = loadoutCard.Locator("button", new() { HasText = "Pack-Back & Reconcile" });
        await packBackBtn.ClickAsync();

        var completePackBackBtn = dialog.Locator(
            "button",
            new() { HasText = "Complete Pack-Back" }
        );
        await completePackBackBtn.ClickAsync();

        // Close dialog
        await CloseActiveDialogAsync(Page);

        // Items on dashboard should now be returned
        await Expect(banner1).ToBeHiddenAsync();
    }
}
