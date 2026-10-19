using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Categories;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class CategoryAndItemIntegrationTests
{
    private WhereHouseWebApplicationFactory _factory = null!;
    private HttpClient _client = null!;

    [TestInitialize]
    public void Setup()
    {
        _factory = new WhereHouseWebApplicationFactory();
        _client = _factory.CreateClient();
    }

    [TestCleanup]
    public void Cleanup()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private static async Task<AuthResponse> RegisterAndAuthenticateAsync(
        HttpClient client,
        string email,
        string username
    )
    {
        var register = new RegisterRequest(email, username, "Password123!");
        var response = await client.PostAsJsonAsync("/api/auth/register", register);
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.IsNotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            auth.Token
        );
        return auth;
    }

    [TestMethod]
    public async Task CreateCategoryWithAttributeTemplates_AndCreateItemWithCustomAttributes()
    {
        await RegisterAndAuthenticateAsync(_client, "catitem1@example.com", "catitem1");

        // 1. Create Category with AttributeTemplates
        var catReq = new CreateCategoryRequest(
            "Cables & Adapters",
            Description: "Audio, video, data cables",
            Icon: "cable",
            AttributeTemplates:
            [
                new UpsertCategoryAttributeTemplateRequest(
                    null,
                    "Connector A",
                    AttributeFieldType.Enum,
                    Options: ["USB-C", "HDMI", "DisplayPort"]
                ),
                new UpsertCategoryAttributeTemplateRequest(
                    null,
                    "Length",
                    AttributeFieldType.Number,
                    Unit: "ft"
                ),
            ]
        );

        var catResp = await _client.PostAsJsonAsync("/api/categories", catReq);
        Assert.AreEqual(HttpStatusCode.Created, catResp.StatusCode);
        var cat = await catResp.Content.ReadFromJsonAsync<CategoryDto>();
        Assert.IsNotNull(cat);
        Assert.AreEqual("Cables & Adapters", cat.Name);
        Assert.HasCount(2, cat.AttributeTemplates);

        // 2. Create Location
        var locResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Office Closet", LocationNodeType.FixedLocation)
        );
        var loc = await locResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(loc);

        // 3. Create Item with AttributeValues
        var itemReq = new CreateItemRequest(
            "Anker 6ft USB-C Cable",
            ItemType: ItemType.Unique,
            HomeLocationId: loc.Id,
            CategoryId: cat.Id,
            Brand: "Anker",
            Condition: ItemCondition.New,
            PurchasePrice: 15.99m,
            AttributeValues:
            [
                new UpsertItemAttributeValueRequest(
                    cat.AttributeTemplates[0].Id,
                    "Connector A",
                    AttributeFieldType.Enum,
                    Value: "USB-C"
                ),
                new UpsertItemAttributeValueRequest(
                    cat.AttributeTemplates[1].Id,
                    "Length",
                    AttributeFieldType.Number,
                    Unit: "ft",
                    Value: "6"
                ),
            ]
        );

        var itemResp = await _client.PostAsJsonAsync("/api/items", itemReq);
        Assert.AreEqual(HttpStatusCode.Created, itemResp.StatusCode);
        var item = await itemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);
        Assert.AreEqual("ITM-001", item.ShortCode);
        Assert.AreEqual("Anker 6ft USB-C Cable", item.Name);
        Assert.AreEqual("Office Closet", item.HomeLocationName);
        Assert.AreEqual("Cables & Adapters", item.CategoryName);
        Assert.HasCount(2, item.AttributeValues);

        // Verify LocationNodeDto includes item count
        var getLocResp = await _client.GetAsync($"/api/locations/{loc.Id}");
        var updatedLoc = await getLocResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(updatedLoc);
        Assert.AreEqual(1, updatedLoc.ItemCount);
    }

    [TestMethod]
    public async Task QuantityItem_LowStockAndQuantityAdjustments()
    {
        await RegisterAndAuthenticateAsync(_client, "qty@example.com", "qtyuser");

        var itemReq = new CreateItemRequest(
            "AA Batteries",
            ItemType: ItemType.Quantity,
            CurrentQuantity: 10m,
            Unit: "pack",
            MinQuantity: 4m
        );

        var createResp = await _client.PostAsJsonAsync("/api/items", itemReq);
        var item = await createResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);
        Assert.IsFalse(item.IsLowStock);

        // Adjust quantity down by 7 (Delta: -7 => CurrentQuantity = 3)
        var adjResp = await _client.PatchAsJsonAsync(
            $"/api/items/{item.Id}/quantity",
            new AdjustItemQuantityRequest(Delta: -7m)
        );
        Assert.AreEqual(HttpStatusCode.OK, adjResp.StatusCode);
        var updatedItem = await adjResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(updatedItem);
        Assert.AreEqual(3m, updatedItem.CurrentQuantity);
        Assert.IsTrue(updatedItem.IsLowStock);

        // Verify low stock filter
        var lowStockListResp = await _client.GetAsync("/api/items?lowStockOnly=true");
        var lowStockList = await lowStockListResp.Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.IsNotNull(lowStockList);
        Assert.HasCount(1, lowStockList);
        Assert.AreEqual(item.Id, lowStockList[0].Id);
    }

    [TestMethod]
    public async Task KitItem_DetectsIncompleteKitWhenMemberIsBrokenOrLoaned()
    {
        await RegisterAndAuthenticateAsync(_client, "kit@example.com", "kituser");

        // 1. Create Parent Kit
        var kitResp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Electronics Soldering Kit", ItemType: ItemType.Kit)
        );
        var kit = await kitResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(kit);

        // 2. Add Member Item 1: Soldering Iron (Good)
        await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Soldering Iron",
                ItemType: ItemType.Unique,
                ParentItemId: kit.Id,
                Condition: ItemCondition.Good
            )
        );

        // 3. Add Member Item 2: Wire Cutters (Broken)
        await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Wire Cutters",
                ItemType: ItemType.Unique,
                ParentItemId: kit.Id,
                Condition: ItemCondition.Broken
            )
        );

        // 4. Fetch Kit by ID and verify IncompleteKit detection
        var getKitResp = await _client.GetAsync($"/api/items/{kit.Id}");
        var verifiedKit = await getKitResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(verifiedKit);
        Assert.IsTrue(verifiedKit.IsIncompleteKit);
        Assert.HasCount(1, verifiedKit.IncompleteKitWarnings);
        StringAssert.Contains(verifiedKit.IncompleteKitWarnings[0], "Broken");
        Assert.HasCount(2, verifiedKit.ChildItems);
    }

    [TestMethod]
    public async Task DuplicateItem_CopiesAttributesAndGeneratesNewShortCode()
    {
        await RegisterAndAuthenticateAsync(_client, "dup@example.com", "dupuser");

        var itemReq = new CreateItemRequest(
            "Ryobi 18V Drill",
            ItemType: ItemType.Unique,
            Brand: "Ryobi",
            ModelNumber: "P208B",
            SerialNumber: "SN-99999",
            Condition: ItemCondition.Excellent,
            Tags: ["tools", "cordless"]
        );

        var createResp = await _client.PostAsJsonAsync("/api/items", itemReq);
        var item = await createResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);
        Assert.AreEqual("ITM-001", item.ShortCode);

        // Duplicate item
        var dupResp = await _client.PostAsync($"/api/items/{item.Id}/duplicate", null);
        Assert.AreEqual(HttpStatusCode.Created, dupResp.StatusCode);
        var duplicate = await dupResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(duplicate);
        Assert.AreEqual("ITM-002", duplicate.ShortCode);
        Assert.AreEqual("Ryobi 18V Drill (Copy)", duplicate.Name);
        Assert.AreEqual("Ryobi", duplicate.Brand);
        Assert.AreEqual("P208B", duplicate.ModelNumber);
        Assert.IsNull(duplicate.SerialNumber); // Serial number cleared on duplicate
        Assert.AreNotEqual(item.Id, duplicate.Id);
    }

    [TestMethod]
    public async Task SecretGiftMode_HidesItemAndItemInsidePrivateLocation()
    {
        await RegisterAndAuthenticateAsync(_client, "owner2@example.com", "owneruser2");

        // Create a public location and a private location
        var pubLocResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Living Room", LocationNodeType.FixedLocation)
        );
        var pubLoc = await pubLocResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(pubLoc);

        var privLocResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Secret Closet",
                LocationNodeType.FixedLocation,
                IsPrivate: true
            )
        );
        var privLoc = await privLocResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(privLoc);

        // 1. Item marked private directly
        var privItemResp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Diamond Ring", HomeLocationId: pubLoc.Id, IsPrivate: true)
        );
        var privItem = await privItemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(privItem);

        // 2. Item in private location
        var itemInPrivLocResp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Gift Watch", HomeLocationId: privLoc.Id, IsPrivate: false)
        );
        var itemInPrivLoc = await itemInPrivLocResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(itemInPrivLoc);

        // Other household user
        using var otherClient = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(otherClient, "other2@example.com", "otheruser2");

        // Verify other user cannot get private item
        var getPrivItemResp = await otherClient.GetAsync($"/api/items/{privItem.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, getPrivItemResp.StatusCode);

        // Verify other user cannot get item in private location
        var getItemInPrivLocResp = await otherClient.GetAsync($"/api/items/{itemInPrivLoc.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, getItemInPrivLocResp.StatusCode);

        // Verify other user list endpoint omits both
        var listResp = await otherClient.GetAsync("/api/items");
        var list = await listResp.Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.IsNotNull(list);
        Assert.IsFalse(list.Any(i => i.Id == privItem.Id || i.Id == itemInPrivLoc.Id));
    }

    [TestMethod]
    public async Task DeleteLocation_FailsWhenLocationHousesItems()
    {
        await RegisterAndAuthenticateAsync(_client, "delloc@example.com", "dellocuser");

        var locResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Tool Shed", LocationNodeType.FixedLocation)
        );
        var loc = await locResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(loc);

        // Put an item inside the location
        await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Lawn Mower", HomeLocationId: loc.Id)
        );

        // Attempting to delete the location should fail with Conflict
        var delLocResp = await _client.DeleteAsync($"/api/locations/{loc.Id}");
        Assert.AreEqual(HttpStatusCode.Conflict, delLocResp.StatusCode);
    }
}
