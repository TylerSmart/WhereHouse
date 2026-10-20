using Microsoft.Playwright;
using WhereHouse.Core.Locations;

namespace WhereHouse.Client.E2ETests.Suites;

[TestClass]
public class ThemeAndResponsiveViewportsE2ETests : WhereHouseE2ETestBase
{
    [TestMethod]
    public async Task Theme_SwitchModeAndColor_AppliesToDom()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        await AuthenticateAsync(Page, $"theme_user_{suffix}", $"theme_{suffix}@example.com");

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        // 1. Toggle Theme Mode to Dark via top-bar menu
        var themeBtn = Page.Locator("button[aria-label*='Theme:']");
        await themeBtn.ClickAsync();

        var darkOption = Page.Locator("button[mat-menu-item]", new() { HasText = "Dark" });
        await darkOption.ClickAsync();

        // Verify HTML element attributes & CSS color-scheme
        var dataTheme = await Page.EvaluateAsync<string>(
            "() => document.documentElement.getAttribute('data-theme')"
        );
        Assert.AreEqual("dark", dataTheme);

        var colorScheme = await Page.EvaluateAsync<string>(
            "() => document.documentElement.style.colorScheme"
        );
        Assert.AreEqual("dark", colorScheme);

        // 2. Open Customize Theme Dialog
        await themeBtn.ClickAsync();
        var customizeOption = Page.Locator(
            "button[mat-menu-item]",
            new() { HasText = "Customize Theme..." }
        );
        await customizeOption.ClickAsync();

        var dialog = await WaitForActiveDialogAsync(Page);
        await Expect(dialog.Locator(".dialog-title")).ToContainTextAsync("Theme & Appearance");

        // Record initial primary color
        var initialPrimary = await Page.EvaluateAsync<string>(
            "() => document.documentElement.style.getPropertyValue('--mat-sys-primary').trim()"
        );

        // Select a different primary palette swatch
        var swatches = dialog.Locator(".swatches-grid button.swatch-btn");
        var swatchCount = await swatches.CountAsync();
        Assert.IsGreaterThanOrEqualTo(
            2,
            swatchCount,
            "Expected at least 2 swatches in theme customizer dialog."
        );

        // Click the second swatch
        await swatches.Nth(1).ClickAsync();

        // Verify primary CSS variable changed
        var updatedPrimary = await Page.EvaluateAsync<string>(
            "() => document.documentElement.style.getPropertyValue('--mat-sys-primary').trim()"
        );
        Assert.AreNotEqual(
            initialPrimary,
            updatedPrimary,
            "Primary palette color variable should have changed after selecting a new swatch."
        );

        // Close theme dialog
        var closeBtn = dialog.Locator("button[aria-label='Close theme settings']");
        await closeBtn.ClickAsync();
        await Page.WaitForSelectorAsync(
            "mat-dialog-container",
            new() { State = WaitForSelectorState.Detached }
        );
    }

    [TestMethod]
    public async Task Responsive_ViewportAudits_ZeroHorizontalOverflowAtAllBreakpoints()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"resp_user_{suffix}",
            $"resp_{suffix}@example.com"
        );

        // Seed location and items via API so the dashboard contains rich spatial content
        var loc = await CreateLocationViaApiAsync(
            token,
            $"Warehouse_{suffix}",
            LocationNodeType.FixedLocation
        );
        await CreateItemViaApiAsync(token, $"Item Alpha_{suffix}", locationId: loc.Id);
        await CreateItemViaApiAsync(token, $"Item Beta_{suffix}", locationId: loc.Id);

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        var viewports = new (int Width, int Height, string Label)[]
        {
            (375, 812, "Mobile (375x812)"),
            (768, 1024, "Tablet (768x1024)"),
            (1280, 800, "Laptop (1280x800)"),
            (1920, 1080, "Desktop (1920x1080)"),
        };

        foreach (var (width, height, label) in viewports)
        {
            await Page.SetViewportSizeAsync(width, height);
            await Page.WaitForTimeoutAsync(300);

            // Verify top bar is visible
            await Expect(Page.Locator(".top-bar")).ToBeVisibleAsync();

            // Verify main spatial explorer area is visible
            await Expect(Page.Locator("main.main-content")).ToBeVisibleAsync();

            // Strict audit: Ensure document scrollWidth does NOT exceed viewport innerWidth
            var isOverflowing = await Page.EvaluateAsync<bool>(
                "() => document.documentElement.scrollWidth > window.innerWidth"
            );

            Assert.IsFalse(
                isOverflowing,
                $"Horizontal scrollbar/overflow detected at {label}! document.scrollWidth exceeded window.innerWidth."
            );
        }
    }
}
