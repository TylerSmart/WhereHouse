using System;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WhereHouse.Client.E2ETests.Suites;

#pragma warning disable MSTEST0037

[TestClass]
public class AuthAndUserDirectoryE2ETests : WhereHouseE2ETestBase
{
    [ClassInitialize]
    public static void ClassInit(TestContext context) => BaseClassInit(context);

    [ClassCleanup]
    public static void ClassCleanup() => BaseClassCleanup();

    [TestMethod]
    public async Task Auth_RegisterWithValidCredentials_LogsInAndLandsOnDashboard()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var username = $"reguser_{suffix}";
        var email = $"reg_{suffix}@example.com";

        await Page.GotoAsync($"{Fixture.RootUri}/login");
        await Page.WaitForSelectorAsync(".auth-card");

        // Switch to "Create Account" tab
        var createAccountTab = Page.Locator(
            "div[role='tab']",
            new() { HasText = "Create Account" }
        );
        await createAccountTab.ClickAsync();

        // Fill registration form
        var form = Page.Locator("form[aria-label='Create account form']");
        await form.Locator("input[formControlName='username']").FillAsync(username);
        await form.Locator("input[formControlName='email']").FillAsync(email);
        await form.Locator("input[formControlName='password']").FillAsync("Password123!");
        await form.Locator("input[formControlName='confirmPassword']").FillAsync("Password123!");

        // Submit
        await form.Locator(".submit-btn").ClickAsync();

        // Verify successful redirection to dashboard
        await Page.WaitForSelectorAsync(".top-bar", new() { Timeout = 15000 });
        var userBtn = Page.Locator(".user-profile-btn");
        await Expect(userBtn).ToContainTextAsync(username);
    }

    [TestMethod]
    public async Task Auth_RegisterValidation_ShowsPasswordMismatch()
    {
        await Page.GotoAsync($"{Fixture.RootUri}/login");
        await Page.WaitForSelectorAsync(".auth-card");

        // Switch to "Create Account" tab
        await Page.Locator("div[role='tab']", new() { HasText = "Create Account" }).ClickAsync();

        var form = Page.Locator("form[aria-label='Create account form']");
        await form.Locator("input[formControlName='username']").FillAsync("mismatch_user");
        await form.Locator("input[formControlName='email']").FillAsync("mismatch@example.com");
        await form.Locator("input[formControlName='password']").FillAsync("Password123!");
        await form.Locator("input[formControlName='confirmPassword']").FillAsync("Different123!");
        await form.Locator("input[formControlName='confirmPassword']").BlurAsync();

        // Submit button should be disabled due to mismatch validator
        await Expect(form.Locator(".submit-btn")).ToBeDisabledAsync();
    }

    [TestMethod]
    public async Task Auth_LoginWithInvalidCredentials_DisplaysErrorMessage()
    {
        await Page.GotoAsync($"{Fixture.RootUri}/login");
        await Page.WaitForSelectorAsync(".auth-card");

        var form = Page.Locator("form[aria-label='Sign in form']");
        await form.Locator("input[formControlName='email']").FillAsync("nonexistent@example.com");
        await form.Locator("input[formControlName='password']").FillAsync("WrongPassword123!");
        await form.Locator(".submit-btn").ClickAsync();

        var errorBanner = Page.Locator(".error-banner");
        await Expect(errorBanner).ToBeVisibleAsync();
    }

    [TestMethod]
    public async Task Auth_Logout_ClearsSessionAndRedirectsToLogin()
    {
        await AuthenticateAsync(Page, "logout_user", "logout@example.com");

        // Click user profile menu
        var userBtn = Page.Locator(".user-profile-btn");
        await userBtn.ClickAsync();

        // Click Log Out
        var logoutItem = Page.Locator("button[role='menuitem']", new() { HasText = "Log Out" });
        await logoutItem.ClickAsync();

        // Verify redirection to login page and token removed
        await Page.WaitForSelectorAsync(".auth-card", new() { Timeout = 10000 });
        var token = await Page.EvaluateAsync<string?>(
            "() => localStorage.getItem('where-house-token')"
        );
        Assert.IsNull(token, "Expected token in localStorage to be cleared after logout");
    }

    [TestMethod]
    public async Task Auth_HouseholdUserDirectory_ReturnsActiveUsersForSharing()
    {
        // Seed Alice and Bob
        await AuthenticateAsync(Page, "alice_share", "alice_share@example.com");
        var client = Fixture.CreateClient();
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = "bob_share@example.com",
                username = "bob_share",
                password = "Password123!",
            }
        );

        // Open Add Item modal
        await OpenQuickAddAndSelectAsync(Page, "Inventory Item");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Toggle Secret / Gift Mode
        var privateToggle = dialog.Locator("mat-slide-toggle[formControlName='isPrivate']");
        await privateToggle.ClickAsync();

        // Open shared users dropdown
        var sharedSelect = dialog.Locator("mat-select[formControlName='sharedWithUserIds']");
        await Expect(sharedSelect).ToBeVisibleAsync();
        await sharedSelect.ClickAsync();

        // Verify bob_share appears in the household user directory options
        var option = Page.Locator("mat-option", new() { HasText = "bob_share" });
        await Expect(option).ToBeVisibleAsync();

        await Page.Keyboard.PressAsync("Escape"); // Close mat-select dropdown
        await CloseActiveDialogAsync(Page);
    }
}
