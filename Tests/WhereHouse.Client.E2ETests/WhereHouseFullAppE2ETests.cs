using System;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace WhereHouse.Client.E2ETests;

#pragma warning disable MSTEST0037

[TestClass]
public class WhereHouseFullAppE2ETests : PageTest
{
    private static WhereHouseE2EServerFixture? _fixture;

    [ClassInitialize]
    public static void ClassInit(TestContext context)
    {
        _fixture = new WhereHouseE2EServerFixture();
        // Force server creation and start Kestrel
        _ = _fixture.CreateClient();
    }

    [ClassCleanup]
    public static void ClassCleanup()
    {
        _fixture?.Dispose();
    }

    private async Task<string> AuthenticateAsync(
        IPage page,
        string username = "testuser",
        string email = "test@example.com"
    )
    {
        using var client = _fixture!.CreateClient();
        var regResp = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email,
                username,
                password = "Password123!",
            }
        );

        string token;
        if (regResp.IsSuccessStatusCode)
        {
            var auth = await regResp.Content.ReadFromJsonAsync<AuthResponseDto>();
            token = auth!.Token;
        }
        else
        {
            var loginResp = await client.PostAsJsonAsync(
                "/api/auth/login",
                new { email, password = "Password123!" }
            );
            var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponseDto>();
            token = auth!.Token;
        }

        await page.AddInitScriptAsync(
            $$"""
            localStorage.setItem('where-house-token', '{{token}}');
            """
        );

        await page.GotoAsync(_fixture.RootUri);
        await page.WaitForSelectorAsync(".top-bar", new() { Timeout = 15000 });
        return token;
    }

    [TestMethod]
    public async Task SetupAndAuth_ResponsiveViewport_EliminatesHorizontalScrollbars()
    {
        await AuthenticateAsync(Page, "resp_user", "resp_user@example.com");

        var viewports = new (int Width, int Height)[]
        {
            (1920, 1080), // Desktop
            (1280, 800), // Narrow Desktop / Laptop
            (768, 1024), // Tablet
            (375, 812), // Mobile Phone
        };

        foreach (var (width, height) in viewports)
        {
            await Page.SetViewportSizeAsync(width, height);
            await Page.WaitForTimeoutAsync(300);

            var hasHorizontalScroll = await Page.EvaluateAsync<bool>(
                "() => document.documentElement.scrollWidth > window.innerWidth"
            );

            Assert.IsFalse(
                hasHorizontalScroll,
                $"Horizontal scrollbar detected at viewport {width}x{height} (scrollWidth: "
                    + await Page.EvaluateAsync<int>("() => document.documentElement.scrollWidth")
                    + $" vs innerWidth: {width})"
            );
        }
    }

    [TestMethod]
    public async Task TopNavbar_SmartSearchAndKbdPill_HasSpacing()
    {
        await AuthenticateAsync(Page, "search_user", "search_user@example.com");

        var trigger = Page.Locator(".smart-search-shortcut-btn");
        await Expect(trigger).ToBeVisibleAsync();

        var kbdPill = Page.Locator(".kbd-pill");
        await Expect(kbdPill).ToBeVisibleAsync();

        var marginLeft = await kbdPill.EvaluateAsync<string>(
            "el => window.getComputedStyle(el).marginLeft"
        );
        Assert.AreNotEqual(
            "0px",
            marginLeft,
            "Expected margin-left on .kbd-pill to provide spacing"
        );
    }

    [TestMethod]
    public async Task EmptyState_Actions_HaveProperIconSizes()
    {
        await AuthenticateAsync(Page, "empty_user", "empty_user@example.com");

        var emptyActions = Page.Locator(".empty-actions button");
        var count = await emptyActions.CountAsync();
        Assert.IsTrue(count > 0, "Expected empty state action buttons to be visible");

        for (var i = 0; i < count; i++)
        {
            var btnIcon = emptyActions.Nth(i).Locator("mat-icon");
            var iconHeight = await btnIcon.EvaluateAsync<int>("el => el.clientHeight");
            Assert.IsTrue(
                iconHeight <= 28,
                $"Expected empty state action button icon height <= 28px, but was {iconHeight}px"
            );
        }
    }

    [TestMethod]
    public async Task ContainerDialog_ColorSwatches_DoNotDisplayRawHexCodes()
    {
        await AuthenticateAsync(Page, "color_user", "color_user@example.com");

        // Open Add Container dialog
        var addBtn = Page.Locator("button", new() { HasText = "Add Container" }).First;
        if (!await addBtn.IsVisibleAsync())
        {
            await Page.Locator(".quick-add-btn").ClickAsync();
            addBtn = Page.Locator(
                "button[role='menuitem']",
                new() { HasText = "Movable Container" }
            );
        }
        await addBtn.ClickAsync();

        var dialog = Page.Locator("mat-dialog-container");
        await Expect(dialog).ToBeVisibleAsync();

        // Switch to Movable Container if not already selected
        var containerRadio = dialog.Locator(
            "mat-radio-button",
            new() { HasText = "Movable Container" }
        );
        if (await containerRadio.IsVisibleAsync())
        {
            await containerRadio.ClickAsync();
        }

        // Check color swatches
        var swatchBtns = dialog.Locator(".color-swatch-btn");
        var swatchCount = await swatchBtns.CountAsync();
        Assert.IsTrue(swatchCount > 0, "Expected preset color swatches to be rendered");

        for (var i = 0; i < swatchCount; i++)
        {
            var text = await swatchBtns.Nth(i).InnerTextAsync();
            Assert.IsFalse(
                text.Contains('#'),
                $"Swatch button should not display raw hex code, but got text: '{text}'"
            );
        }

        // Check custom native color picker
        var nativeColorPicker = dialog.Locator("input[type='color'].color-picker-native");
        await Expect(nativeColorPicker.First).ToBeVisibleAsync();

        // Close dialog
        await dialog.Locator("button", new() { HasText = "Cancel" }).ClickAsync();
    }

    [TestMethod]
    public async Task ItemDialog_MaterialDatepicker_AndQuickPresets()
    {
        await AuthenticateAsync(Page, "item_user", "item_user@example.com");

        // Open Add Item dialog
        var addItemBtn = Page.Locator("button", new() { HasText = "Add Item" }).First;
        if (!await addItemBtn.IsVisibleAsync())
        {
            await Page.Locator(".quick-add-btn").ClickAsync();
            addItemBtn = Page.Locator(
                "button[role='menuitem']",
                new() { HasText = "Inventory Item" }
            );
        }
        await addItemBtn.ClickAsync();

        var dialog = Page.Locator("mat-dialog-container");
        await Expect(dialog).ToBeVisibleAsync();

        // Verify MatDatepicker toggles exist (at least 3: purchaseDate, returnWindowEndDate, warrantyExpirationDate)
        var datepickerToggles = dialog.Locator("mat-datepicker-toggle");
        var toggleCount = await datepickerToggles.CountAsync();
        Assert.IsTrue(
            toggleCount >= 3,
            $"Expected at least 3 mat-datepicker-toggle components, found {toggleCount}"
        );

        // Verify Quick Presets are rendered
        var preset14d = dialog.Locator(".preset-chip-btn", new() { HasText = "+14d" });
        await Expect(preset14d).ToBeVisibleAsync();

        var preset1yr = dialog.Locator(".preset-chip-btn", new() { HasText = "+1 yr" });
        await Expect(preset1yr).ToBeVisibleAsync();

        // Click preset +14d and verify return window input is populated
        await preset14d.ClickAsync();
        var returnDateInput = dialog.Locator("input[formControlName='returnWindowEndDate']");
        var returnVal = await returnDateInput.InputValueAsync();
        Assert.IsFalse(
            string.IsNullOrWhiteSpace(returnVal),
            "Expected return window input to be populated after clicking preset"
        );

        // Check Secret / Gift Mode toggle shows household sharing select
        var privateToggle = dialog.Locator("mat-slide-toggle[formControlName='isPrivate']");
        await privateToggle.ClickAsync();

        var householdSelect = dialog.Locator("mat-select[formControlName='sharedWithUserIds']");
        await Expect(householdSelect).ToBeVisibleAsync();

        // Close dialog
        await dialog.Locator("button", new() { HasText = "Cancel" }).ClickAsync();
    }

    [TestMethod]
    public async Task Dialogs_MaxWidth_DoNotExceedBudget()
    {
        await AuthenticateAsync(Page, "diag_user", "diag_user@example.com");

        // Open Category Manager via Tools & Vault menu
        await Page.Locator(".tools-vault-btn").ClickAsync();
        await Page.Locator(
                "button[role='menuitem']",
                new() { HasText = "Manage Categories & Templates" }
            )
            .ClickAsync();

        var catDialog = Page.Locator("mat-dialog-container");
        await Expect(catDialog).ToBeVisibleAsync();
        var catWidth = await catDialog.EvaluateAsync<int>("el => el.clientWidth");
        Assert.IsTrue(
            catWidth <= 720,
            $"Expected Category Manager dialog clientWidth <= 720px, but was {catWidth}px"
        );
        await catDialog.Locator("button", new() { HasText = "Done" }).ClickAsync();
        await Page.WaitForTimeoutAsync(300);

        // Open Label Generator via Tools & Vault menu
        await Page.Locator(".tools-vault-btn").ClickAsync();
        await Page.Locator(
                "button[role='menuitem']",
                new() { HasText = "Print Barcode & QR Labels" }
            )
            .ClickAsync();

        var labelDialog = Page.Locator("mat-dialog-container");
        await Expect(labelDialog).ToBeVisibleAsync();
        var labelWidth = await labelDialog.EvaluateAsync<int>("el => el.clientWidth");
        Assert.IsTrue(
            labelWidth <= 900,
            $"Expected Label Generator dialog clientWidth <= 900px, but was {labelWidth}px"
        );
        await labelDialog.Locator("button[aria-label='Close dialog']").ClickAsync();
    }

    [TestMethod]
    public async Task DeclutterGraveyard_InfiniteLoop_Eliminated()
    {
        await AuthenticateAsync(Page, "declutter_user", "declutter_user@example.com");

        var stagedCallCount = 0;
        Page.Request += (_, req) =>
        {
            if (req.Url.Contains("/api/lifecycle/staged"))
            {
                stagedCallCount++;
            }
        };

        // Open Declutter & Graveyard via Tools & Vault menu
        await Page.Locator(".tools-vault-btn").ClickAsync();
        await Page.Locator("button[role='menuitem']", new() { HasText = "Declutter & Graveyard" })
            .ClickAsync();

        var dialog = Page.Locator("mat-dialog-container");
        await Expect(dialog).ToBeVisibleAsync();

        // Wait 2.5 seconds to observe if an infinite loop re-triggers the call
        await Page.WaitForTimeoutAsync(2500);

        Assert.IsTrue(
            stagedCallCount <= 1,
            $"Expected at most 1 network call to /api/lifecycle/staged upon opening dialog, but got {stagedCallCount} calls!"
        );

        await dialog.Locator("button", new() { HasText = "Close" }).ClickAsync();
    }
}
