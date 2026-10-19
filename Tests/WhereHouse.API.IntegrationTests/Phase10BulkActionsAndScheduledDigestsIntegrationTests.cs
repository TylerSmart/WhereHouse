using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.ActionCenter;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Categories;
using WhereHouse.Core.Checkouts;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class Phase10BulkActionsAndScheduledDigestsIntegrationTests
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
    public async Task BulkUpdate_MovesLocation_UpdatesTags_And_AssignsCategory()
    {
        await RegisterAndAuthenticateAsync(
            _client,
            "bulk-update-user@example.com",
            "bulkupdateuser"
        );

        // 1. Create two locations
        var locAResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Garage Shelf A", LocationNodeType.FixedLocation)
        );
        Assert.AreEqual(HttpStatusCode.Created, locAResp.StatusCode);
        var locA = await locAResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(locA);

        var locBResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Basement Tote B", LocationNodeType.MovableContainer)
        );
        Assert.AreEqual(HttpStatusCode.Created, locBResp.StatusCode);
        var locB = await locBResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(locB);

        // 2. Create category
        var catResp = await _client.PostAsJsonAsync(
            "/api/categories",
            new CreateCategoryRequest("Hand Tools")
        );
        Assert.AreEqual(HttpStatusCode.Created, catResp.StatusCode);
        var cat = await catResp.Content.ReadFromJsonAsync<CategoryDto>();
        Assert.IsNotNull(cat);

        // 3. Create three items on Shelf A
        var item1Resp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Screwdriver Set",
                HomeLocationId: locA.Id,
                Tags: ["tools", "old-tag"]
            )
        );
        var item1 = await item1Resp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item1);

        var item2Resp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Hammer", HomeLocationId: locA.Id, Tags: ["old-tag", "metal"])
        );
        var item2 = await item2Resp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item2);

        var item3Resp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Pliers", HomeLocationId: locA.Id, Tags: ["gripping"])
        );
        var item3 = await item3Resp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item3);

        // 4. Execute Bulk Update
        var bulkReq = new BulkUpdateItemsRequest(
            ItemIds: [item1.Id, item2.Id, item3.Id],
            UpdateHomeLocation: true,
            TargetHomeLocationId: locB.Id,
            UpdateCategory: true,
            TargetCategoryId: cat.Id,
            AddTags: ["workshop", "essential"],
            RemoveTags: ["old-tag"]
        );

        var bulkResp = await _client.PostAsJsonAsync("/api/items/bulk-update", bulkReq);
        Assert.AreEqual(HttpStatusCode.OK, bulkResp.StatusCode);

        var bulkResult = await bulkResp.Content.ReadFromJsonAsync<BulkUpdateItemsResultDto>();
        Assert.IsNotNull(bulkResult);
        Assert.AreEqual(3, bulkResult.UpdatedCount);
        Assert.HasCount(3, bulkResult.UpdatedItems);

        // 5. Verify individual item state
        foreach (var updated in bulkResult.UpdatedItems)
        {
            Assert.AreEqual(locB.Id, updated.HomeLocationId);
            Assert.AreEqual(cat.Id, updated.CategoryId);
            Assert.IsTrue(updated.Tags.Contains("workshop"));
            Assert.IsTrue(updated.Tags.Contains("essential"));
            Assert.IsFalse(updated.Tags.Contains("old-tag"));
        }

        // Verify item1 retained "tools", item2 retained "metal", item3 retained "gripping"
        var verifiedItem1 = await (
            await _client.GetAsync($"/api/items/{item1.Id}")
        ).Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(verifiedItem1);
        Assert.IsTrue(verifiedItem1.Tags.Contains("tools"));
        Assert.IsFalse(verifiedItem1.Tags.Contains("old-tag"));

        var verifiedItem2 = await (
            await _client.GetAsync($"/api/items/{item2.Id}")
        ).Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(verifiedItem2);
        Assert.IsTrue(verifiedItem2.Tags.Contains("metal"));
        Assert.IsFalse(verifiedItem2.Tags.Contains("old-tag"));
    }

    [TestMethod]
    public async Task BulkUpdate_Enforces_PrivacyIsolation_ReturnsForbidden()
    {
        // 1. User A creates private location and private item
        await RegisterAndAuthenticateAsync(_client, "user-a-bulk@example.com", "userabulk");

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

        var privItemResp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Secret Present", HomeLocationId: privLoc.Id, IsPrivate: true)
        );
        var privItem = await privItemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(privItem);

        // 2. User B tries to bulk-update User A's private item -> Forbidden
        using var clientB = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(clientB, "user-b-bulk@example.com", "userbbulk");

        var bOwnLocResp = await clientB.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("User B Room", LocationNodeType.FixedLocation)
        );
        var bOwnLoc = await bOwnLocResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(bOwnLoc);

        var bOwnItemResp = await clientB.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("User B Item", HomeLocationId: bOwnLoc.Id)
        );
        var bOwnItem = await bOwnItemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(bOwnItem);

        // B tries to update User A's item
        var forbiddenUpdateResp = await clientB.PostAsJsonAsync(
            "/api/items/bulk-update",
            new BulkUpdateItemsRequest(ItemIds: [privItem.Id], AddTags: ["hacked"])
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, forbiddenUpdateResp.StatusCode);

        // B tries to move B's own item into User A's private location
        var forbiddenMoveResp = await clientB.PostAsJsonAsync(
            "/api/items/bulk-update",
            new BulkUpdateItemsRequest(
                ItemIds: [bOwnItem.Id],
                UpdateHomeLocation: true,
                TargetHomeLocationId: privLoc.Id
            )
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, forbiddenMoveResp.StatusCode);
    }

    [TestMethod]
    public async Task ProcessScheduledNotifications_ExecutesWeeklyDigest_And_EnforcesIdempotency()
    {
        await RegisterAndAuthenticateAsync(
            _client,
            "scheduled-digest-user@example.com",
            "scheduleddigest"
        );

        // Create Location and Out-of-place Item
        var locResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Garage", LocationNodeType.FixedLocation)
        );
        var loc = await locResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(loc);

        var itemResp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Lawn Mower", HomeLocationId: loc.Id)
        );
        var item = await itemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);

        // Check out item so it's in Out of Place
        await _client.PostAsJsonAsync(
            $"/api/checkouts/items/{item.Id}/checkout",
            new CheckoutItemRequest(IsExternalLoan: false, ProjectOrNote: "Front lawn")
        );

        // Create Notification Channel for Sunday 9 UTC
        var channelResp = await _client.PostAsJsonAsync(
            "/api/action-center/channels",
            new CreateNotificationChannelRequest(
                Name: "Weekly Sunday Digest",
                ChannelType: NotificationChannelType.Ntfy,
                EndpointUrl: "https://mock.local/ntfy/sunday-test",
                EnableWeeklyDigest: true,
                DigestDayOfWeek: DayOfWeek.Sunday,
                DigestHourUtc: 9
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, channelResp.StatusCode);
        var channel = await channelResp.Content.ReadFromJsonAsync<NotificationChannelDto>();
        Assert.IsNotNull(channel);

        // 1. Process scheduled notifications at matching time (2026-10-18 is Sunday 09:15 UTC)
        var sunday9Utc = new DateTimeOffset(2026, 10, 18, 9, 15, 0, TimeSpan.Zero);
        var processResp1 = await _client.PostAsync(
            $"/api/action-center/digest/process-scheduled?asOfUtc={Uri.EscapeDataString(sunday9Utc.ToString("o"))}",
            null
        );
        Assert.AreEqual(HttpStatusCode.OK, processResp1.StatusCode);
        var result1 = await processResp1.Content.ReadFromJsonAsync<NotificationDispatchResultDto>();
        Assert.IsNotNull(result1);
        Assert.AreEqual(1, result1.ChannelsTargeted);
        Assert.AreEqual(1, result1.SuccessCount);
        Assert.AreEqual(0, result1.FailureCount);
        Assert.HasCount(1, result1.Deliveries);
        Assert.AreEqual(NotificationEventType.WeeklyDigest, result1.Deliveries[0].EventType);

        // 2. Immediate second call at 09:45 UTC should trigger 0 channels due to 20h cooldown
        var sunday945Utc = new DateTimeOffset(2026, 10, 18, 9, 45, 0, TimeSpan.Zero);
        var processResp2 = await _client.PostAsync(
            $"/api/action-center/digest/process-scheduled?asOfUtc={Uri.EscapeDataString(sunday945Utc.ToString("o"))}",
            null
        );
        Assert.AreEqual(HttpStatusCode.OK, processResp2.StatusCode);
        var result2 = await processResp2.Content.ReadFromJsonAsync<NotificationDispatchResultDto>();
        Assert.IsNotNull(result2);
        Assert.AreEqual(0, result2.ChannelsTargeted);
        Assert.IsEmpty(result2.Deliveries);
    }

    [TestMethod]
    public async Task ProcessScheduledNotifications_ExecutesRealTimeAlerts_ForConfiguredChannels()
    {
        await RegisterAndAuthenticateAsync(
            _client,
            "realtime-alert-user@example.com",
            "realtimeuser"
        );

        // Create Location and Low-Stock Item
        var locResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Pantry", LocationNodeType.FixedLocation)
        );
        var loc = await locResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(loc);

        var itemResp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "AA Batteries",
                ItemType: ItemType.Quantity,
                HomeLocationId: loc.Id,
                CurrentQuantity: 1m,
                MinQuantity: 5m
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, itemResp.StatusCode);

        // Create channel with LowStock trigger enabled, weekly digest disabled
        var channelResp = await _client.PostAsJsonAsync(
            "/api/action-center/channels",
            new CreateNotificationChannelRequest(
                Name: "Low Stock Slack",
                ChannelType: NotificationChannelType.SlackWebhook,
                EndpointUrl: "https://mock.local/slack/low-stock-test",
                EnableWeeklyDigest: false,
                NotifyOnLowStock: true
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, channelResp.StatusCode);

        // Process scheduled notifications
        var processResp = await _client.PostAsync(
            "/api/action-center/digest/process-scheduled",
            null
        );
        Assert.AreEqual(HttpStatusCode.OK, processResp.StatusCode);
        var result = await processResp.Content.ReadFromJsonAsync<NotificationDispatchResultDto>();
        Assert.IsNotNull(result);
        Assert.AreEqual(1, result.ChannelsTargeted);
        Assert.AreEqual(1, result.SuccessCount);
        Assert.AreEqual(NotificationEventType.LowStockAlert, result.Deliveries[0].EventType);
    }
}
