using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.ActionCenter;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Checkouts;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.Maintenance;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class Phase09ActionCenterAndNotificationsIntegrationTests
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
    public async Task ActionCenterOverview_Aggregates_AllFiveAlertCategories()
    {
        await RegisterAndAuthenticateAsync(_client, "action-center-agg@example.com", "actionagg");

        // Create Location
        var locResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Utility Room", LocationNodeType.FixedLocation)
        );
        Assert.AreEqual(HttpStatusCode.Created, locResp.StatusCode);
        var loc = await locResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(loc);

        // 1. Out of Place Item (InUse)
        var item1Resp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Cordless Drill", HomeLocationId: loc.Id)
        );
        Assert.AreEqual(HttpStatusCode.Created, item1Resp.StatusCode);
        var item1 = await item1Resp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item1);

        var checkout1Resp = await _client.PostAsJsonAsync(
            $"/api/checkouts/items/{item1.Id}/checkout",
            new CheckoutItemRequest(IsExternalLoan: false, ProjectOrNote: "Fixing fence")
        );
        Assert.AreEqual(HttpStatusCode.OK, checkout1Resp.StatusCode);

        // 2. Overdue External Loan Item (LoanedOut)
        var item2Resp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Pressure Washer", HomeLocationId: loc.Id)
        );
        Assert.AreEqual(HttpStatusCode.Created, item2Resp.StatusCode);
        var item2 = await item2Resp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item2);

        var checkout2Resp = await _client.PostAsJsonAsync(
            $"/api/checkouts/items/{item2.Id}/checkout",
            new CheckoutItemRequest(
                IsExternalLoan: true,
                BorrowerName: "Dave",
                BorrowerContact: "dave@example.com",
                ExpectedReturnAt: DateTimeOffset.UtcNow.AddDays(-3)
            )
        );
        Assert.AreEqual(HttpStatusCode.OK, checkout2Resp.StatusCode);

        // 3. Maintenance Due Item (Overdue schedule)
        var item3Resp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Lawn Mower", HomeLocationId: loc.Id)
        );
        Assert.AreEqual(HttpStatusCode.Created, item3Resp.StatusCode);
        var item3 = await item3Resp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item3);

        var scheduleResp = await _client.PostAsJsonAsync(
            $"/api/maintenance/items/{item3.Id}/schedules",
            new CreateMaintenanceScheduleRequest(
                "Change Engine Oil",
                IntervalValue: 30,
                IntervalUnit: MaintenanceIntervalUnit.Days,
                FirstDueAt: DateTimeOffset.UtcNow.AddDays(-2)
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, scheduleResp.StatusCode);

        // 4. Expiring Coverage Item (Return Window and Warranty)
        var item4Resp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Espresso Machine",
                HomeLocationId: loc.Id,
                Brand: "Breville",
                PurchasePrice: 699.99m,
                ReturnWindowEndDate: DateTimeOffset.UtcNow.AddDays(5),
                WarrantyExpirationDate: DateTimeOffset.UtcNow.AddDays(25),
                WarrantyNotes: "2-year manufacturer coverage"
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, item4Resp.StatusCode);
        var item4 = await item4Resp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item4);

        // 5. Low Stock Item
        var item5Resp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Descaling Tablets",
                ItemType: ItemType.Quantity,
                HomeLocationId: loc.Id,
                CurrentQuantity: 1m,
                MinQuantity: 4m,
                Unit: "tablets"
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, item5Resp.StatusCode);
        var item5 = await item5Resp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item5);

        // Fetch Action Center Overview
        var overviewResp = await _client.GetAsync("/api/action-center?coverageWindowDays=30");
        Assert.AreEqual(HttpStatusCode.OK, overviewResp.StatusCode);

        var overview = await overviewResp.Content.ReadFromJsonAsync<ActionCenterOverviewDto>();
        Assert.IsNotNull(overview);

        Assert.IsGreaterThanOrEqualTo(6, overview.TotalAlertsCount); // 1 out-of-place + 1 loan + 1 maintenance + 2 coverages + 1 low stock

        // 1. Out of Place checks
        Assert.IsGreaterThanOrEqualTo(1, overview.OutOfPlaceCount);
        var outOfPlace = overview.OutOfPlaceItems.FirstOrDefault(i => i.ItemId == item1.Id);
        Assert.IsNotNull(outOfPlace);
        Assert.AreEqual("Cordless Drill", outOfPlace.Name);
        Assert.AreEqual("Fixing fence", outOfPlace.CheckoutNote);

        // 2. Loan checks
        Assert.IsGreaterThanOrEqualTo(1, overview.ActiveLoansCount);
        Assert.IsGreaterThanOrEqualTo(1, overview.OverdueLoansCount);
        var loan = overview.ExternalLoans.FirstOrDefault(l => l.ItemId == item2.Id);
        Assert.IsNotNull(loan);
        Assert.IsTrue(loan.IsOverdue);
        Assert.AreEqual("Dave", loan.BorrowerName);

        // 3. Maintenance checks
        Assert.IsGreaterThanOrEqualTo(1, overview.MaintenanceDueCount);
        Assert.IsGreaterThanOrEqualTo(1, overview.MaintenanceOverdueCount);
        var maint = overview.DueMaintenanceSchedules.FirstOrDefault(s => s.ItemId == item3.Id);
        Assert.IsNotNull(maint);
        Assert.AreEqual("Change Engine Oil", maint.Title);
        Assert.AreEqual(MaintenanceDueStatus.Overdue, maint.DueStatus);

        // 4. Coverage checks
        Assert.IsGreaterThanOrEqualTo(2, overview.ExpiringCoverageCount);
        var retAlert = overview.ExpiringCoverages.FirstOrDefault(c =>
            c.ItemId == item4.Id && c.AlertType == WarrantyOrReturnAlertType.ReturnWindow
        );
        Assert.IsNotNull(retAlert);
        Assert.IsFalse(retAlert.IsExpired);
        Assert.IsTrue(retAlert.DaysRemaining is >= 0 and <= 7);

        var warAlert = overview.ExpiringCoverages.FirstOrDefault(c =>
            c.ItemId == item4.Id && c.AlertType == WarrantyOrReturnAlertType.WarrantyExpiration
        );
        Assert.IsNotNull(warAlert);
        Assert.IsFalse(warAlert.IsExpired);
        Assert.IsTrue(warAlert.DaysRemaining is > 7 and <= 30);

        // 5. Low stock checks
        Assert.IsGreaterThanOrEqualTo(1, overview.LowStockCount);
        var stock = overview.LowStockItems.FirstOrDefault(s => s.ItemId == item5.Id);
        Assert.IsNotNull(stock);
        Assert.AreEqual(1m, stock.CurrentQuantity);
        Assert.AreEqual(4m, stock.MinQuantity);
    }

    [TestMethod]
    public async Task NotificationChannel_Crud_And_TestDispatch()
    {
        await RegisterAndAuthenticateAsync(_client, "channel-crud@example.com", "channelcrud");

        // 1. Create Ntfy Channel
        var createReq = new CreateNotificationChannelRequest(
            Name: "Household Ntfy",
            ChannelType: NotificationChannelType.Ntfy,
            EndpointUrl: "https://test.mock.local/wherehouse",
            AccessTokenOrKey: "my-secret-token",
            NotifyOnOverdueLoans: true,
            NotifyOnMaintenanceDue: true,
            EnableWeeklyDigest: true
        );

        var createResp = await _client.PostAsJsonAsync("/api/action-center/channels", createReq);
        Assert.AreEqual(HttpStatusCode.Created, createResp.StatusCode);

        var channel = await createResp.Content.ReadFromJsonAsync<NotificationChannelDto>();
        Assert.IsNotNull(channel);
        Assert.AreEqual("Household Ntfy", channel.Name);
        Assert.AreEqual(NotificationChannelType.Ntfy, channel.ChannelType);
        Assert.IsTrue(channel.HasAccessTokenOrKey);

        // 2. Get Channel by Id
        var getResp = await _client.GetAsync($"/api/action-center/channels/{channel.Id}");
        Assert.AreEqual(HttpStatusCode.OK, getResp.StatusCode);

        // 3. Update Channel
        var updateReq = new UpdateNotificationChannelRequest(
            Name: "Household Ntfy Updated",
            ChannelType: NotificationChannelType.Ntfy,
            EndpointUrl: "https://test.mock.local/wherehouse",
            NotifyOnOverdueLoans: false,
            NotifyOnMaintenanceDue: true
        );

        var updateResp = await _client.PutAsJsonAsync(
            $"/api/action-center/channels/{channel.Id}",
            updateReq
        );
        Assert.AreEqual(HttpStatusCode.OK, updateResp.StatusCode);
        var updated = await updateResp.Content.ReadFromJsonAsync<NotificationChannelDto>();
        Assert.IsNotNull(updated);
        Assert.AreEqual("Household Ntfy Updated", updated.Name);
        Assert.IsFalse(updated.NotifyOnOverdueLoans);

        // 4. Test Dispatch
        var testResp = await _client.PostAsync(
            $"/api/action-center/channels/{channel.Id}/test",
            null
        );
        Assert.AreEqual(HttpStatusCode.OK, testResp.StatusCode);
        var testLog = await testResp.Content.ReadFromJsonAsync<NotificationDeliveryLogDto>();
        Assert.IsNotNull(testLog);
        Assert.IsTrue(testLog.Success);
        StringAssert.Contains(testLog.ResponseSummary, "Simulated 200 OK");

        // 5. Query Deliveries Log
        var deliveriesResp = await _client.GetAsync("/api/action-center/deliveries");
        Assert.AreEqual(HttpStatusCode.OK, deliveriesResp.StatusCode);
        var deliveries = await deliveriesResp.Content.ReadFromJsonAsync<
            List<NotificationDeliveryLogDto>
        >();
        Assert.IsNotNull(deliveries);
        Assert.IsTrue(deliveries.Any(d => d.ChannelId == channel.Id));

        // 6. Delete Channel
        var delResp = await _client.DeleteAsync($"/api/action-center/channels/{channel.Id}");
        Assert.AreEqual(HttpStatusCode.NoContent, delResp.StatusCode);

        var getDeletedResp = await _client.GetAsync($"/api/action-center/channels/{channel.Id}");
        Assert.AreEqual(HttpStatusCode.NotFound, getDeletedResp.StatusCode);
    }

    [TestMethod]
    public async Task WeeklyHouseholdDigest_Generation_And_Dispatch()
    {
        await RegisterAndAuthenticateAsync(_client, "digest-dispatch@example.com", "digestuser");

        // Create a Slack channel pointing to a mock endpoint
        var channelResp = await _client.PostAsJsonAsync(
            "/api/action-center/channels",
            new CreateNotificationChannelRequest(
                "Slack Alerts",
                ChannelType: NotificationChannelType.SlackWebhook,
                EndpointUrl: "https://mock.local/services/slack-webhook",
                NotifyOnOverdueLoans: true,
                NotifyOnMaintenanceDue: true,
                NotifyOnExpiringWarranties: true,
                NotifyOnLowStock: true
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, channelResp.StatusCode);
        var channel = await channelResp.Content.ReadFromJsonAsync<NotificationChannelDto>();
        Assert.IsNotNull(channel);

        // Create an alert item
        await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Spare Batteries",
                ItemType: ItemType.Quantity,
                CurrentQuantity: 2m,
                MinQuantity: 8m,
                Unit: "packs"
            )
        );

        // Trigger Digest Send
        var sendDigestResp = await _client.PostAsJsonAsync(
            "/api/action-center/digest/send",
            new SendNotificationDigestRequest(ChannelId: channel.Id, CoverageWindowDays: 30)
        );
        Assert.AreEqual(HttpStatusCode.OK, sendDigestResp.StatusCode);

        var dispatchResult =
            await sendDigestResp.Content.ReadFromJsonAsync<NotificationDispatchResultDto>();
        Assert.IsNotNull(dispatchResult);
        Assert.AreEqual(1, dispatchResult.ChannelsTargeted);
        Assert.AreEqual(1, dispatchResult.SuccessCount);
        StringAssert.Contains(dispatchResult.DigestSubject, "Household Digest");
        StringAssert.Contains(dispatchResult.DigestBodyPreview, "Low Stock Alerts");
        StringAssert.Contains(dispatchResult.DigestBodyPreview, "Spare Batteries");

        // Verify Delivery Log
        var deliveriesResp = await _client.GetAsync("/api/action-center/deliveries");
        var deliveries = await deliveriesResp.Content.ReadFromJsonAsync<
            List<NotificationDeliveryLogDto>
        >();
        Assert.IsNotNull(deliveries);
        var digestLog = deliveries.FirstOrDefault(d =>
            d.EventType == NotificationEventType.WeeklyDigest
        );
        Assert.IsNotNull(digestLog);
        Assert.IsTrue(digestLog.Success);
    }

    [TestMethod]
    public async Task ActionCenter_And_Notifications_PrivacyIsolation()
    {
        // 1. User A sets up private item and personal notification channel
        using var clientA = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(clientA, "user-a-secret@example.com", "userAsecret");

        var privItemResp = await clientA.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Secret Birthday Gift Watch",
                PurchasePrice: 350m,
                ReturnWindowEndDate: DateTimeOffset.UtcNow.AddDays(10),
                IsPrivate: true
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, privItemResp.StatusCode);
        var privItem = await privItemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(privItem);

        var personalChanResp = await clientA.PostAsJsonAsync(
            "/api/action-center/channels",
            new CreateNotificationChannelRequest(
                "User A Personal Ntfy",
                ChannelType: NotificationChannelType.Ntfy,
                EndpointUrl: "https://mock.local/usera-private",
                IsSharedHouseholdChannel: false
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, personalChanResp.StatusCode);
        var personalChan =
            await personalChanResp.Content.ReadFromJsonAsync<NotificationChannelDto>();
        Assert.IsNotNull(personalChan);

        // 2. User B logs in
        using var clientB = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(clientB, "user-b-guest@example.com", "userBguest");

        // User B's action center overview must NOT contain User A's private item
        var overviewBResp = await clientB.GetAsync("/api/action-center");
        Assert.AreEqual(HttpStatusCode.OK, overviewBResp.StatusCode);
        var overviewB = await overviewBResp.Content.ReadFromJsonAsync<ActionCenterOverviewDto>();
        Assert.IsNotNull(overviewB);
        Assert.IsFalse(overviewB.ExpiringCoverages.Any(c => c.ItemId == privItem.Id));

        // User B cannot get, edit, delete, or test User A's personal channel
        var getChanResp = await clientB.GetAsync($"/api/action-center/channels/{personalChan.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, getChanResp.StatusCode);

        var editChanResp = await clientB.PutAsJsonAsync(
            $"/api/action-center/channels/{personalChan.Id}",
            new UpdateNotificationChannelRequest(
                "Hacked Name",
                NotificationChannelType.Ntfy,
                EndpointUrl: "https://mock.local/hacked"
            )
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, editChanResp.StatusCode);

        var delChanResp = await clientB.DeleteAsync(
            $"/api/action-center/channels/{personalChan.Id}"
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, delChanResp.StatusCode);

        var testChanResp = await clientB.PostAsync(
            $"/api/action-center/channels/{personalChan.Id}/test",
            null
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, testChanResp.StatusCode);

        // 3. User A creates a SHARED Household Channel
        var sharedChanResp = await clientA.PostAsJsonAsync(
            "/api/action-center/channels",
            new CreateNotificationChannelRequest(
                "Living Room Wall Tablet Slack",
                ChannelType: NotificationChannelType.SlackWebhook,
                EndpointUrl: "https://mock.local/living-room-slack",
                IsSharedHouseholdChannel: true
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, sharedChanResp.StatusCode);
        var sharedChan = await sharedChanResp.Content.ReadFromJsonAsync<NotificationChannelDto>();
        Assert.IsNotNull(sharedChan);

        // User B CAN see the shared channel in channel list
        var userBChannelsResp = await clientB.GetAsync("/api/action-center/channels");
        var userBChannels = await userBChannelsResp.Content.ReadFromJsonAsync<
            List<NotificationChannelDto>
        >();
        Assert.IsNotNull(userBChannels);
        Assert.IsTrue(userBChannels.Any(c => c.Id == sharedChan.Id));

        // When a digest is generated for the shared household channel, private items MUST NOT be included
        var digestResp = await clientA.PostAsJsonAsync(
            "/api/action-center/digest/send",
            new SendNotificationDigestRequest(ChannelId: sharedChan.Id, CoverageWindowDays: 30)
        );
        Assert.AreEqual(HttpStatusCode.OK, digestResp.StatusCode);
        var digestResult =
            await digestResp.Content.ReadFromJsonAsync<NotificationDispatchResultDto>();
        Assert.IsNotNull(digestResult);

        // Secret item must NOT appear in the shared household digest!
        StringAssert.DoesNotMatch(
            digestResult.DigestBodyPreview,
            new System.Text.RegularExpressions.Regex("Secret Birthday Gift Watch")
        );
    }
}
