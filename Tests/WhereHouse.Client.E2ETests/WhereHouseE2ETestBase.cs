using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Categories;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.Client.E2ETests;

#pragma warning disable MSTEST0037

public record AuthResponseDto(string Token, string Email, string Username);

public abstract class WhereHouseE2ETestBase : PageTest
{
    private static readonly Lazy<WhereHouseE2EServerFixture> _lazyFixture = new(() =>
    {
        var fixture = new WhereHouseE2EServerFixture();
        _ = fixture.CreateClient();
        return fixture;
    });

    protected static WhereHouseE2EServerFixture Fixture => _lazyFixture.Value;

    public static void BaseClassInit(TestContext context)
    {
        _ = Fixture;
    }

    public static void BaseClassCleanup() { }

    protected async Task<string> AuthenticateAsync(
        IPage page,
        string username = "testuser",
        string email = "test@example.com",
        string password = "Password123!"
    )
    {
        using var client = Fixture.CreateClient();
        var regResp = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email,
                username,
                password,
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
                new { email, password }
            );
            var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponseDto>();
            token = auth!.Token;
        }

        await page.AddInitScriptAsync(
            $$"""
            localStorage.setItem('where-house-token', '{{token}}');
            """
        );

        await page.GotoAsync(Fixture.RootUri);
        await page.WaitForSelectorAsync(".top-bar", new() { Timeout = 15000 });
        return token;
    }

    protected HttpClient CreateAuthenticatedApiClient(string token)
    {
        var client = Fixture.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    protected async Task<LocationNodeDto> CreateLocationViaApiAsync(
        string token,
        string name,
        LocationNodeType type = LocationNodeType.FixedLocation,
        Guid? parentId = null,
        string? primaryColor = null,
        string? accentColor = null,
        string? containerStyle = null
    )
    {
        using var client = CreateAuthenticatedApiClient(token);
        var request = new CreateLocationNodeRequest(
            Name: name,
            NodeType: type,
            ParentId: parentId,
            ContainerStyle: containerStyle,
            PrimaryColor: primaryColor,
            AccentColor: accentColor
        );

        var response = await client.PostAsJsonAsync("/api/locations", request);
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<LocationNodeDto>();
        return created!;
    }

    protected async Task<ItemDto> CreateItemViaApiAsync(
        string token,
        string name,
        ItemType type = ItemType.Unique,
        Guid? locationId = null,
        int quantity = 1,
        bool isPrivate = false,
        IReadOnlyList<Guid>? sharedWithUserIds = null
    )
    {
        using var client = CreateAuthenticatedApiClient(token);
        var request = new CreateItemRequest(
            Name: name,
            ItemType: type,
            HomeLocationId: locationId,
            CurrentQuantity: quantity,
            IsPrivate: isPrivate,
            SharedWithUserIds: sharedWithUserIds
        );

        var response = await client.PostAsJsonAsync("/api/items", request);
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<ItemDto>();
        return created!;
    }

    protected async Task<CategoryDto> CreateCategoryViaApiAsync(
        string token,
        string name,
        string? icon = "category",
        string? color = "#3b82f6"
    )
    {
        using var client = CreateAuthenticatedApiClient(token);
        var request = new CreateCategoryRequest(Name: name, Icon: icon, Color: color);

        var response = await client.PostAsJsonAsync("/api/categories", request);
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<CategoryDto>();
        return created!;
    }

    protected async Task OpenToolsMenuAndSelectAsync(IPage page, string menuItemText)
    {
        var toolsBtn = page.Locator(".tools-vault-btn");
        await toolsBtn.ClickAsync();
        var menuItem = page.Locator("button[role='menuitem']", new() { HasText = menuItemText });
        await menuItem.ClickAsync();
    }

    protected async Task OpenQuickAddAndSelectAsync(IPage page, string menuItemText)
    {
        var addBtn = page.Locator(".quick-add-btn");
        await addBtn.ClickAsync();
        var menuItem = page.Locator("button[role='menuitem']", new() { HasText = menuItemText });
        await menuItem.ClickAsync();
    }

    protected async Task<ILocator> WaitForActiveDialogAsync(IPage page)
    {
        var dialog = page.Locator("mat-dialog-container");
        await Expect(dialog).ToBeVisibleAsync();
        return dialog;
    }

    protected async Task CloseActiveDialogAsync(IPage page)
    {
        var dialog = page.Locator("mat-dialog-container");
        if (await dialog.IsVisibleAsync())
        {
            var closeBtn = dialog.Locator("button", new() { HasText = "Done" }).First;
            if (await closeBtn.IsVisibleAsync())
            {
                await closeBtn.ClickAsync();
                return;
            }

            closeBtn = dialog.Locator("button", new() { HasText = "Close" }).First;
            if (await closeBtn.IsVisibleAsync())
            {
                await closeBtn.ClickAsync();
                return;
            }

            closeBtn = dialog.Locator("button", new() { HasText = "Cancel" }).First;
            if (await closeBtn.IsVisibleAsync())
            {
                await closeBtn.ClickAsync();
                return;
            }

            closeBtn = dialog.Locator("button[aria-label='Close dialog']").First;
            if (await closeBtn.IsVisibleAsync())
            {
                await closeBtn.ClickAsync();
                return;
            }

            await page.Keyboard.PressAsync("Escape");
        }
    }
}
