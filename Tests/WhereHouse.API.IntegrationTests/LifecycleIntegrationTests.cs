using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Items;
using WhereHouse.Core.Lifecycle;
using WhereHouse.Core.Locations;
using WhereHouse.Core.Search;
using WhereHouse.Data;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class LifecycleIntegrationTests
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
    public async Task StagingToSellAndDonate_ComputesSummary_AndUnstages()
    {
        await RegisterAndAuthenticateAsync(_client, "staging@example.com", "staginguser");

        // Create Home Location
        var locRes = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Garage", LocationNodeType.FixedLocation)
        );
        var location = await locRes.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(location);

        // Create 3 Items
        var itm1Res = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Drill Press", HomeLocationId: location.Id)
        );
        var item1 = await itm1Res.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item1);

        var itm2Res = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Miter Saw", HomeLocationId: location.Id)
        );
        var item2 = await itm2Res.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item2);

        var itm3Res = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Winter Jacket", HomeLocationId: location.Id)
        );
        var item3 = await itm3Res.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item3);

        // Stage Item 1 to Sell
        var stage1Res = await _client.PostAsJsonAsync(
            $"/api/lifecycle/items/{item1.Id}/stage",
            new StageItemRequest(IsToSell: true, TargetPrice: 45m, ListingNotes: "FB Marketplace")
        );
        Assert.AreEqual(HttpStatusCode.OK, stage1Res.StatusCode);
        var staged1 = await stage1Res.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(staged1);
        Assert.AreEqual(ItemStatus.StagedToSell, staged1.Status);
        Assert.AreEqual(45m, staged1.StagingTargetPrice);
        Assert.AreEqual("FB Marketplace", staged1.StagingListingNotes);
        Assert.IsNotNull(staged1.StagedAt);

        // Stage Item 2 to Sell
        var stage2Res = await _client.PostAsJsonAsync(
            $"/api/lifecycle/items/{item2.Id}/stage",
            new StageItemRequest(IsToSell: true, TargetPrice: 120m, ListingNotes: "Craigslist")
        );
        Assert.AreEqual(HttpStatusCode.OK, stage2Res.StatusCode);

        // Stage Item 3 to Donate
        var stage3Res = await _client.PostAsJsonAsync(
            $"/api/lifecycle/items/{item3.Id}/stage",
            new StageItemRequest(IsToSell: false, TargetPrice: 15m, ListingNotes: "Goodwill pile")
        );
        Assert.AreEqual(HttpStatusCode.OK, stage3Res.StatusCode);
        var staged3 = await stage3Res.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(staged3);
        Assert.AreEqual(ItemStatus.StagedToDonate, staged3.Status);

        // Verify GET /api/lifecycle/staged
        var summaryRes = await _client.GetAsync("/api/lifecycle/staged");
        Assert.AreEqual(HttpStatusCode.OK, summaryRes.StatusCode);
        var summary = await summaryRes.Content.ReadFromJsonAsync<DeclutterStagingSummaryDto>();
        Assert.IsNotNull(summary);
        Assert.AreEqual(3, summary.TotalStagedCount);
        Assert.AreEqual(2, summary.StagedToSellCount);
        Assert.AreEqual(1, summary.StagedToDonateCount);
        Assert.AreEqual(165m, summary.TotalTargetResaleValue);
        Assert.AreEqual(15m, summary.TotalEstimatedDonationValue);

        // Unstage Item 1
        var unstageRes = await _client.PostAsync($"/api/lifecycle/items/{item1.Id}/unstage", null);
        Assert.AreEqual(HttpStatusCode.OK, unstageRes.StatusCode);
        var unstaged1 = await unstageRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(unstaged1);
        Assert.AreEqual(ItemStatus.InPlace, unstaged1.Status);
        Assert.IsNull(unstaged1.StagingTargetPrice);
        Assert.IsNull(unstaged1.StagingListingNotes);
        Assert.IsNull(unstaged1.StagedAt);

        // Verify summary count updated
        var summaryAfter = await (
            await _client.GetAsync("/api/lifecycle/staged")
        ).Content.ReadFromJsonAsync<DeclutterStagingSummaryDto>();
        Assert.IsNotNull(summaryAfter);
        Assert.AreEqual(2, summaryAfter.TotalStagedCount);
        Assert.AreEqual(1, summaryAfter.StagedToSellCount);
    }

    [TestMethod]
    public async Task GraveyardArchive_ExcludesFromActiveBins_ReturnsInSearch_AndRestores()
    {
        await RegisterAndAuthenticateAsync(_client, "graveyard@example.com", "graveyarduser");

        // Create Home Location
        var locRes = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Basement Bin 03", LocationNodeType.MovableContainer)
        );
        var location = await locRes.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(location);

        // Create Item
        var itemRes = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Linksys WRT Router",
                HomeLocationId: location.Id,
                EstimatedReplacementValue: 50m
            )
        );
        var item = await itemRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);

        // Archive to Graveyard as Donated
        var archiveRes = await _client.PostAsJsonAsync(
            $"/api/lifecycle/items/{item.Id}/archive",
            new ArchiveItemRequest(
                DispositionReason.Donated,
                DispositionNote: "Donated to community center"
            )
        );
        Assert.AreEqual(HttpStatusCode.OK, archiveRes.StatusCode);
        var archived = await archiveRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(archived);
        Assert.AreEqual(ItemStatus.Archived, archived.Status);
        Assert.AreEqual(DispositionReason.Donated, archived.DispositionReason);
        Assert.AreEqual("Donated to community center", archived.DispositionNote);
        Assert.IsNotNull(archived.ArchivedAt);
        Assert.AreEqual("graveyarduser", archived.ArchivedByUsername);
        Assert.AreEqual(location.Id, archived.HomeLocationId); // Preserves home location!

        // Verify GET /api/items (default active view) excludes it
        var activeItems = await (await _client.GetAsync("/api/items")).Content.ReadFromJsonAsync<
            List<ItemDto>
        >();
        Assert.IsNotNull(activeItems);
        Assert.IsFalse(activeItems.Any(i => i.Id == item.Id));

        // Verify LocationNodeDto.ItemCount excludes it
        var locAfter = await (
            await _client.GetAsync($"/api/locations/{location.Id}")
        ).Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(locAfter);
        Assert.AreEqual(0, locAfter.ItemCount);

        // Verify GET /api/search finds it in ArchivedItems
        var searchRes = await (
            await _client.GetAsync("/api/search?query=Linksys")
        ).Content.ReadFromJsonAsync<SmartSearchResponseDto>();
        Assert.IsNotNull(searchRes);
        Assert.IsFalse(searchRes.ActiveItems.Any(i => i.Id == item.Id));
        Assert.IsTrue(searchRes.ArchivedItems.Any(i => i.Id == item.Id));
        var searchHit = searchRes.ArchivedItems.First(i => i.Id == item.Id);
        Assert.AreEqual(DispositionReason.Donated, searchHit.DispositionReason);
        Assert.AreEqual("Donated to community center", searchHit.DispositionNote);

        // Verify GET /api/lifecycle/graveyard returns it
        var gyRes = await (
            await _client.GetAsync("/api/lifecycle/graveyard")
        ).Content.ReadFromJsonAsync<GraveyardSummaryDto>();
        Assert.IsNotNull(gyRes);
        Assert.AreEqual(1, gyRes.TotalArchivedCount);
        Assert.AreEqual(1, gyRes.DonatedCount);
        Assert.AreEqual(50m, gyRes.TotalDonatedEstimatedValue);
        Assert.IsTrue(gyRes.Items.Any(i => i.Id == item.Id));

        // Restore to InPlace
        var restoreRes = await _client.PostAsync($"/api/lifecycle/items/{item.Id}/restore", null);
        Assert.AreEqual(HttpStatusCode.OK, restoreRes.StatusCode);
        var restored = await restoreRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(restored);
        Assert.AreEqual(ItemStatus.InPlace, restored.Status);
        Assert.IsNull(restored.DispositionReason);
        Assert.IsNull(restored.DispositionNote);
        Assert.IsNull(restored.ArchivedAt);

        // Verify item is back in active items
        var activeAfterRestore = await (
            await _client.GetAsync("/api/items")
        ).Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.IsNotNull(activeAfterRestore);
        Assert.IsTrue(activeAfterRestore.Any(i => i.Id == item.Id));
    }

    [TestMethod]
    public async Task BulkArchive_WithTargetPrice_AndBulkUnstage()
    {
        await RegisterAndAuthenticateAsync(_client, "bulk@example.com", "bulkuser");

        var itm1 = await (
            await _client.PostAsJsonAsync("/api/items", new CreateItemRequest("Bulk Item 1"))
        ).Content.ReadFromJsonAsync<ItemDto>();
        var itm2 = await (
            await _client.PostAsJsonAsync("/api/items", new CreateItemRequest("Bulk Item 2"))
        ).Content.ReadFromJsonAsync<ItemDto>();
        var itm3 = await (
            await _client.PostAsJsonAsync("/api/items", new CreateItemRequest("Bulk Item 3"))
        ).Content.ReadFromJsonAsync<ItemDto>();

        Assert.IsNotNull(itm1);
        Assert.IsNotNull(itm2);
        Assert.IsNotNull(itm3);

        // Stage all 3 to sell
        await _client.PostAsJsonAsync(
            $"/api/lifecycle/items/{itm1.Id}/stage",
            new StageItemRequest(IsToSell: true, TargetPrice: 25m)
        );
        await _client.PostAsJsonAsync(
            $"/api/lifecycle/items/{itm2.Id}/stage",
            new StageItemRequest(IsToSell: true, TargetPrice: 50m)
        );
        await _client.PostAsJsonAsync(
            $"/api/lifecycle/items/{itm3.Id}/stage",
            new StageItemRequest(IsToSell: true, TargetPrice: 75m)
        );

        // Bulk archive items 1 & 2 as Sold with null SalePrice (inherits staging target price!)
        var bulkArchiveRes = await _client.PostAsJsonAsync(
            "/api/lifecycle/bulk-archive",
            new BulkArchiveRequest(
                new[] { itm1.Id, itm2.Id },
                DispositionReason.Sold,
                DispositionNote: "Sold at garage sale"
            )
        );
        Assert.AreEqual(HttpStatusCode.OK, bulkArchiveRes.StatusCode);
        var bulkArchiveResult =
            await bulkArchiveRes.Content.ReadFromJsonAsync<BulkLifecycleResultDto>();
        Assert.IsNotNull(bulkArchiveResult);
        Assert.AreEqual(2, bulkArchiveResult.ProcessedCount);

        // Verify Graveyard reflects sales proceeds
        var gyRes = await (
            await _client.GetAsync("/api/lifecycle/graveyard")
        ).Content.ReadFromJsonAsync<GraveyardSummaryDto>();
        Assert.IsNotNull(gyRes);
        Assert.AreEqual(2, gyRes.TotalArchivedCount);
        Assert.AreEqual(2, gyRes.SoldCount);
        Assert.AreEqual(75m, gyRes.TotalSaleProceeds); // 25 + 50

        // Bulk unstage item 3
        var bulkUnstageRes = await _client.PostAsJsonAsync(
            "/api/lifecycle/bulk-unstage",
            new BulkUnstageRequest(new[] { itm3.Id })
        );
        Assert.AreEqual(HttpStatusCode.OK, bulkUnstageRes.StatusCode);
        var bulkUnstageResult =
            await bulkUnstageRes.Content.ReadFromJsonAsync<BulkLifecycleResultDto>();
        Assert.IsNotNull(bulkUnstageResult);
        Assert.AreEqual(1, bulkUnstageResult.ProcessedCount);
        Assert.AreEqual(ItemStatus.InPlace, bulkUnstageResult.Items[0].Status);
    }

    [TestMethod]
    public async Task DustCollectorInsights_GroupsByLocation_AndTouchResetsTimer()
    {
        await RegisterAndAuthenticateAsync(_client, "dust@example.com", "dustuser");

        // Create Home Location
        var locRes = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Attic Bin 01", LocationNodeType.MovableContainer)
        );
        var location = await locRes.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(location);

        // Create Item
        var itemRes = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Vintage Projector",
                HomeLocationId: location.Id,
                EstimatedReplacementValue: 120m
            )
        );
        var item = await itemRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);

        // Simulate item untouched for 400 days via DbContext
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WhereHouseDbContext>();
            var dbItem = await db.InventoryItems.FirstAsync(i => i.Id == item.Id);
            dbItem.LastTouchedAt = DateTimeOffset.UtcNow.AddDays(-400);
            await db.SaveChangesAsync();
        }

        // Query Dust Collectors (threshold 365 days)
        var dustRes = await _client.GetAsync("/api/lifecycle/dust-collectors?minUntouchedDays=365");
        Assert.AreEqual(HttpStatusCode.OK, dustRes.StatusCode);
        var dust = await dustRes.Content.ReadFromJsonAsync<DustCollectorInsightsDto>();
        Assert.IsNotNull(dust);
        Assert.IsGreaterThanOrEqualTo(1, dust.TotalItemsCount);
        Assert.IsGreaterThanOrEqualTo(120m, dust.TotalEstimatedValue);
        Assert.IsTrue(
            dust.LocationGroups.Any(g =>
                g.LocationId == location.Id && g.Items.Any(i => i.Item.Id == item.Id)
            )
        );

        var dustItem = dust
            .LocationGroups.First(g => g.LocationId == location.Id)
            .Items.First(i => i.Item.Id == item.Id);
        Assert.IsGreaterThanOrEqualTo(365, dustItem.DaysUntouched);

        // Touch the item to reset timer
        var touchRes = await _client.PostAsync($"/api/lifecycle/items/{item.Id}/touch", null);
        Assert.AreEqual(HttpStatusCode.OK, touchRes.StatusCode);
        var touched = await touchRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(touched);
        Assert.IsLessThan(5.0, (DateTimeOffset.UtcNow - touched.LastTouchedAt).TotalMinutes);

        // Re-query Dust Collectors: item should no longer be present
        var dustAfter = await (
            await _client.GetAsync("/api/lifecycle/dust-collectors?minUntouchedDays=365")
        ).Content.ReadFromJsonAsync<DustCollectorInsightsDto>();
        Assert.IsNotNull(dustAfter);
        Assert.IsFalse(dustAfter.LocationGroups.Any(g => g.Items.Any(i => i.Item.Id == item.Id)));
    }

    [TestMethod]
    public async Task SecretGiftMode_IsPrivateIsolation()
    {
        // User A creates a private item
        await RegisterAndAuthenticateAsync(_client, "usera@example.com", "usera");
        var privateRes = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Secret Birthday Gift", IsPrivate: true)
        );
        var privateItem = await privateRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(privateItem);

        // User B authenticates
        await RegisterAndAuthenticateAsync(_client, "userb@example.com", "userb");

        // User B attempts direct actions -> 403 Forbidden
        var stageRes = await _client.PostAsJsonAsync(
            $"/api/lifecycle/items/{privateItem.Id}/stage",
            new StageItemRequest()
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, stageRes.StatusCode);

        var unstageRes = await _client.PostAsync(
            $"/api/lifecycle/items/{privateItem.Id}/unstage",
            null
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, unstageRes.StatusCode);

        var archiveRes = await _client.PostAsJsonAsync(
            $"/api/lifecycle/items/{privateItem.Id}/archive",
            new ArchiveItemRequest(DispositionReason.BrokenTrashed)
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, archiveRes.StatusCode);

        var restoreRes = await _client.PostAsync(
            $"/api/lifecycle/items/{privateItem.Id}/restore",
            null
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, restoreRes.StatusCode);

        var touchRes = await _client.PostAsync(
            $"/api/lifecycle/items/{privateItem.Id}/touch",
            null
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, touchRes.StatusCode);

        // User B lists staged / graveyard / dust-collectors -> omitted completely
        var staged = await (
            await _client.GetAsync("/api/lifecycle/staged")
        ).Content.ReadFromJsonAsync<DeclutterStagingSummaryDto>();
        Assert.IsNotNull(staged);
        Assert.IsFalse(staged.Items.Any(i => i.Id == privateItem.Id));

        var gy = await (
            await _client.GetAsync("/api/lifecycle/graveyard")
        ).Content.ReadFromJsonAsync<GraveyardSummaryDto>();
        Assert.IsNotNull(gy);
        Assert.IsFalse(gy.Items.Any(i => i.Id == privateItem.Id));

        var dust = await (
            await _client.GetAsync("/api/lifecycle/dust-collectors?minUntouchedDays=0")
        ).Content.ReadFromJsonAsync<DustCollectorInsightsDto>();
        Assert.IsNotNull(dust);
        Assert.IsFalse(dust.LocationGroups.Any(g => g.Items.Any(i => i.Item.Id == privateItem.Id)));
    }
}
