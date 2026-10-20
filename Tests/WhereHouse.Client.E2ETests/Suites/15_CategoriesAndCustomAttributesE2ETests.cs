using System.Net.Http.Json;
using Microsoft.Playwright;
using WhereHouse.Core.Categories;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.Client.E2ETests.Suites;

[TestClass]
public class CategoriesAndCustomAttributesE2ETests : WhereHouseE2ETestBase
{
    [TestMethod]
    public async Task Categories_CreateCategoryWithSchemaTemplates_PersistsInDatabase()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        await AuthenticateAsync(Page, $"cat_user_{suffix}", $"cat_{suffix}@example.com");

        await Page.GotoAsync($"{Fixture.RootUri}/");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Manage Categories & Templates");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Click Add Category (+) button in left pane
        var addCatBtn = dialog.Locator("button[aria-label='Add Category']");
        await addCatBtn.ClickAsync();
        await Page.WaitForTimeoutAsync(250);

        // Fill category name & icon
        var catNameInput = dialog
            .Locator(".category-form-pane input[formControlName='name']")
            .First;
        await catNameInput.ClickAsync();
        await catNameInput.FillAsync($"Lawn Equipment_{suffix}");

        var iconInput = dialog.Locator("input[formControlName='icon']");
        await iconInput.FillAsync("yard");

        // Add Field 1: Text
        var addFieldBtn = dialog.Locator("button", new() { HasText = "Add Field" });
        await addFieldBtn.ClickAsync();
        var rows = dialog.Locator(".template-item-row");
        await rows.Nth(0).Locator("input[formControlName='name']").FillAsync("Engine Type");

        // Add Field 2: Number
        await addFieldBtn.ClickAsync();
        await rows.Nth(1).Locator("input[formControlName='name']").FillAsync("Deck Width");
        await rows.Nth(1).Locator("mat-select[formControlName='fieldType']").ClickAsync();
        await Page.Locator("mat-option", new() { HasText = "Number" }).ClickAsync();
        await Page.WaitForSelectorAsync(
            "mat-option",
            new() { State = WaitForSelectorState.Hidden }
        );
        await rows.Nth(1).Locator("input[formControlName='unit']").FillAsync("in");

        // Add Field 3: Enum
        await addFieldBtn.ClickAsync();
        await rows.Nth(2).Locator("input[formControlName='name']").FillAsync("Fuel Type");
        await rows.Nth(2).Locator("mat-select[formControlName='fieldType']").ClickAsync();
        await Page.Locator("mat-option", new() { HasText = "Select / Options" }).ClickAsync();
        await Page.WaitForSelectorAsync(
            "mat-option",
            new() { State = WaitForSelectorState.Hidden }
        );
        await rows.Nth(2)
            .Locator("input[formControlName='optionsString']")
            .FillAsync("Gas, Electric, Battery");

        // Click Create Category
        var createBtn = dialog.Locator("button", new() { HasText = "Create Category" });
        await Expect(createBtn).ToBeEnabledAsync();
        await createBtn.ClickAsync();

        // Verify category appears in left pane list with 3 custom fields
        var catListItem = dialog.Locator(
            ".category-list-item",
            new() { HasText = $"Lawn Equipment_{suffix}" }
        );
        await Expect(catListItem).ToBeVisibleAsync();
        await Expect(catListItem).ToContainTextAsync("3 custom fields");

        // Close dialog
        await dialog.Locator("button", new() { HasText = "Done" }).ClickAsync();
    }

    [TestMethod]
    public async Task Categories_AddItemInCategory_RendersDynamicFormFieldsAndPersists()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"dyn_user_{suffix}",
            $"dyn_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Studio_{suffix}",
            LocationNodeType.FixedLocation
        );

        // Seed Category with 4 schema fields via API
        using var client = CreateAuthenticatedApiClient(token);
        var catReq = new CreateCategoryRequest(
            Name: $"Photography Gear_{suffix}",
            Icon: "photo_camera",
            AttributeTemplates: new[]
            {
                new UpsertCategoryAttributeTemplateRequest(
                    null,
                    "Mount Type",
                    AttributeFieldType.Text
                ),
                new UpsertCategoryAttributeTemplateRequest(
                    null,
                    "Focal Length",
                    AttributeFieldType.Number,
                    Unit: "mm"
                ),
                new UpsertCategoryAttributeTemplateRequest(
                    null,
                    "Sensor Format",
                    AttributeFieldType.Enum,
                    Options: new[] { "Full Frame", "APS-C" }
                ),
                new UpsertCategoryAttributeTemplateRequest(
                    null,
                    "Weather Sealed",
                    AttributeFieldType.Boolean
                ),
            }
        );
        var catResp = await client.PostAsJsonAsync("/api/categories", catReq);
        catResp.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".top-bar");

        // Open Add Item dialog
        await OpenQuickAddAndSelectAsync(Page, "Item");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Fill Item Name
        var nameInput = dialog.Locator("input[formControlName='name']");
        await nameInput.FillAsync($"Prime Lens 50mm_{suffix}");

        // Select Category
        var catSelect = dialog.Locator("mat-select[formControlName='categoryId']");
        await catSelect.ClickAsync();
        var catOption = Page.Locator(
            "mat-option",
            new() { HasText = $"Photography Gear_{suffix}" }
        );
        await catOption.ClickAsync();

        // Verify dynamic attribute fields render
        var dynamicContainer = dialog.Locator(".dynamic-attributes-box");
        await Expect(dynamicContainer).ToBeVisibleAsync();

        // Fill Mount Type (Text)
        var mountInput = dynamicContainer
            .Locator("mat-form-field", new() { HasText = "Mount Type" })
            .Locator("input");
        await mountInput.FillAsync("Sony E");

        // Fill Focal Length (Number)
        var focalInput = dynamicContainer
            .Locator("mat-form-field", new() { HasText = "Focal Length" })
            .Locator("input");
        await focalInput.FillAsync("50");

        // Select Sensor Format (Enum)
        var sensorSelect = dynamicContainer
            .Locator("mat-form-field", new() { HasText = "Sensor Format" })
            .Locator("mat-select");
        await sensorSelect.ClickAsync(new() { Force = true });
        await Page.Locator("mat-option", new() { HasText = "Full Frame" }).ClickAsync();

        // Check Weather Sealed (Boolean)
        var weatherCheck = dynamicContainer.Locator(
            "mat-checkbox",
            new() { HasText = "Weather Sealed" }
        );
        await weatherCheck.ClickAsync(new() { Force = true });

        // Create Item
        var saveBtn = dialog.Locator("button", new() { HasText = "Create Item" });
        await saveBtn.ClickAsync();

        await Page.WaitForSelectorAsync(
            "mat-dialog-container",
            new() { State = WaitForSelectorState.Detached }
        );

        // Verify item card on dashboard has category chip and custom attributes
        var itemCard = Page.Locator(".item-card", new() { HasText = $"Prime Lens 50mm_{suffix}" });
        await Expect(itemCard).ToBeVisibleAsync();

        var catPill = itemCard.Locator(".category-chip");
        await Expect(catPill).ToContainTextAsync($"Photography Gear_{suffix}");

        var attrList = itemCard.Locator(".attributes-preview-list");
        await Expect(attrList).ToBeVisibleAsync();
        await Expect(attrList).ToContainTextAsync("Mount Type:Sony E");
        await Expect(attrList).ToContainTextAsync("Focal Length:50 mm");
    }
}
