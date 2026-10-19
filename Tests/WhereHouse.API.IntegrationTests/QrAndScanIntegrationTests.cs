using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.QrCodes;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class QrAndScanIntegrationTests
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
    public async Task QrLifecycle_BatchGenerate_Bind_ScanXRay_Unbind_Verify()
    {
        await RegisterAndAuthenticateAsync(_client, "qruser1@example.com", "qruser1");

        // 1. Generate Batch of 5 QR tokens
        var batchReq = new GenerateQrCodeBatchRequest(5, "QR", "Phase 4 Test Stickers");
        var batchRes = await _client.PostAsJsonAsync("/api/qrcodes/batch", batchReq);
        Assert.AreEqual(HttpStatusCode.Created, batchRes.StatusCode);

        var batchList = await batchRes.Content.ReadFromJsonAsync<IReadOnlyList<QrCodeDto>>();
        Assert.IsNotNull(batchList);
        Assert.HasCount(5, batchList);
        Assert.AreEqual("QR-0001", batchList[0].Token);
        Assert.AreEqual("QR-0005", batchList[4].Token);
        Assert.AreEqual(QrTargetType.Unassigned, batchList[0].TargetType);

        // 2. Scan QR-0001 -> returns UnassignedQr resolution
        var scanRes = await _client.GetAsync("/api/scan/QR-0001");
        Assert.AreEqual(HttpStatusCode.OK, scanRes.StatusCode);
        var resolution = await scanRes.Content.ReadFromJsonAsync<ScanResolutionDto>();
        Assert.IsNotNull(resolution);
        Assert.AreEqual(ScanResolutionType.UnassignedQr, resolution.ResolutionType);
        Assert.IsNotNull(resolution.QrCode);
        Assert.AreEqual("QR-0001", resolution.QrCode.Token);

        // 3. Create a Movable Container (Bin) and an Item
        var createLocRes = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Electronics Tote",
                NodeType: LocationNodeType.MovableContainer
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, createLocRes.StatusCode);
        var container = await createLocRes.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(container);

        var createItemRes = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Multimeter Pro",
                HomeLocationId: container.Id,
                CurrentQuantity: 1
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, createItemRes.StatusCode);
        var item = await createItemRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);

        // 4. Bind QR-0001 to the Container and QR-0002 to the Item
        var bindLocRes = await _client.PostAsJsonAsync(
            "/api/qrcodes/QR-0001/bind",
            new BindQrCodeRequest(QrTargetType.LocationNode, container.Id, "Top Lid Sticker")
        );
        Assert.AreEqual(HttpStatusCode.OK, bindLocRes.StatusCode);
        var boundLocQr = await bindLocRes.Content.ReadFromJsonAsync<QrCodeDto>();
        Assert.IsNotNull(boundLocQr);
        Assert.AreEqual(QrTargetType.LocationNode, boundLocQr.TargetType);
        Assert.AreEqual(container.Id, boundLocQr.LocationNodeId);
        Assert.AreEqual("Electronics Tote", boundLocQr.LocationNodeName);

        var bindItemRes = await _client.PostAsJsonAsync(
            "/api/qrcodes/QR-0002/bind",
            new BindQrCodeRequest(QrTargetType.Item, item.Id, "Handle Barcode")
        );
        Assert.AreEqual(HttpStatusCode.OK, bindItemRes.StatusCode);
        var boundItemQr = await bindItemRes.Content.ReadFromJsonAsync<QrCodeDto>();
        Assert.IsNotNull(boundItemQr);
        Assert.AreEqual(QrTargetType.Item, boundItemQr.TargetType);
        Assert.AreEqual(item.Id, boundItemQr.ItemId);
        Assert.AreEqual("Multimeter Pro", boundItemQr.ItemName);

        // 5. Scan QR-0001 via deep-link URL -> X-Ray View resolution
        var encodedUrl = Uri.EscapeDataString(
            $"https://wherehouse.lan/scan/QR-0001?source=sheet&ts={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}"
        );
        var xRayRes = await _client.GetAsync($"/api/scan/{encodedUrl}");
        Assert.AreEqual(HttpStatusCode.OK, xRayRes.StatusCode);
        var xRayResolution = await xRayRes.Content.ReadFromJsonAsync<ScanResolutionDto>();
        Assert.IsNotNull(xRayResolution);
        Assert.AreEqual(ScanResolutionType.LocationNode, xRayResolution.ResolutionType);
        Assert.IsNotNull(xRayResolution.Location);
        Assert.AreEqual(container.Id, xRayResolution.Location.Id);
        Assert.IsNotNull(xRayResolution.LocationItems);
        Assert.HasCount(1, xRayResolution.LocationItems);
        Assert.AreEqual(item.Id, xRayResolution.LocationItems[0].Id);

        // 6. Scan QR-0002 -> Item resolution
        var scanItemRes = await _client.GetAsync("/api/scan/QR-0002");
        Assert.AreEqual(HttpStatusCode.OK, scanItemRes.StatusCode);
        var itemResolution = await scanItemRes.Content.ReadFromJsonAsync<ScanResolutionDto>();
        Assert.IsNotNull(itemResolution);
        Assert.AreEqual(ScanResolutionType.Item, itemResolution.ResolutionType);
        Assert.IsNotNull(itemResolution.Item);
        Assert.AreEqual(item.Id, itemResolution.Item.Id);
        Assert.IsNotNull(itemResolution.Location);
        Assert.AreEqual(container.Id, itemResolution.Location.Id);

        // 7. Unbind QR-0002 -> reverts to Unassigned
        var unbindRes = await _client.PostAsync("/api/qrcodes/QR-0002/unbind", null);
        Assert.AreEqual(HttpStatusCode.OK, unbindRes.StatusCode);
        var unboundDto = await unbindRes.Content.ReadFromJsonAsync<QrCodeDto>();
        Assert.IsNotNull(unboundDto);
        Assert.AreEqual(QrTargetType.Unassigned, unboundDto.TargetType);
        Assert.IsNull(unboundDto.ItemId);

        // 8. Delete QR-0005
        var deleteRes = await _client.DeleteAsync($"/api/qrcodes/{batchList[4].Id}");
        Assert.AreEqual(HttpStatusCode.NoContent, deleteRes.StatusCode);
    }

    [TestMethod]
    public async Task BulkMoveAudit_MovesContainersAndItems_AndAuditsPresence()
    {
        await RegisterAndAuthenticateAsync(_client, "audituser@example.com", "audituser");

        // Create Destination Shelf (Fixed Location)
        var shelfRes = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Shelf A1", NodeType: LocationNodeType.FixedLocation)
        );
        var shelf = await shelfRes.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(shelf);

        // Create Movable Container elsewhere
        var binRes = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Tools Bin", NodeType: LocationNodeType.MovableContainer)
        );
        var bin = await binRes.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(bin);

        // Create 2 items: 1 already on Shelf A1, 1 elsewhere
        var item1Res = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Screwdriver Set", HomeLocationId: shelf.Id)
        );
        var item1 = await item1Res.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item1);

        var item2Res = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Tape Measure")
        );
        var item2 = await item2Res.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item2);

        // Execute bulk move & audit:
        // Scanned: shelf shortCode (audited present), bin shortCode (moved), item1 shortCode (audited present), item2 shortCode (moved)
        var auditReq = new BulkScanAuditRequest(
            shelf.Id,
            new[] { shelf.ShortCode, bin.ShortCode, item1.ShortCode, item2.ShortCode }
        );

        var auditRes = await _client.PostAsJsonAsync("/api/scan/bulk-move-audit", auditReq);
        Assert.AreEqual(HttpStatusCode.OK, auditRes.StatusCode);

        var auditResult = await auditRes.Content.ReadFromJsonAsync<BulkScanAuditResponseDto>();
        Assert.IsNotNull(auditResult);
        Assert.AreEqual(2, auditResult.MovedCount); // bin and item2 moved
        Assert.AreEqual(2, auditResult.AuditedPresentCount); // shelf and item1 confirmed
        Assert.AreEqual(0, auditResult.ErrorOrSkippedCount);
        Assert.HasCount(4, auditResult.Results);

        // Re-query bin and item2 to ensure destination parent/home was updated in DB
        var updatedBinRes = await _client.GetAsync($"/api/locations/{bin.Id}");
        var updatedBin = await updatedBinRes.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(updatedBin);
        Assert.AreEqual(shelf.Id, updatedBin.ParentId);

        var updatedItem2Res = await _client.GetAsync($"/api/items/{item2.Id}");
        var updatedItem2 = await updatedItem2Res.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(updatedItem2);
        Assert.AreEqual(shelf.Id, updatedItem2.HomeLocationId);
    }

    [TestMethod]
    public async Task Scan_PrivateContainerOrItem_ReturnsOpaqueRestrictedResolution()
    {
        // 1. User A creates private container and item
        using var clientA = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(clientA, "alice@example.com", "alice");

        var privLocRes = await clientA.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Alice Secret Safe",
                NodeType: LocationNodeType.MovableContainer,
                IsPrivate: true
            )
        );
        var privLoc = await privLocRes.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(privLoc);

        var privItemRes = await clientA.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Alice Birthday Gift",
                HomeLocationId: privLoc.Id,
                IsPrivate: true
            )
        );
        var privItem = await privItemRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(privItem);

        // 2. User B logs in and scans Alice's private container shortCode
        using var clientB = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(clientB, "bob@example.com", "bob");

        var scanLocRes = await clientB.GetAsync($"/api/scan/{privLoc.ShortCode}");
        Assert.AreEqual(HttpStatusCode.OK, scanLocRes.StatusCode);

        var scanLocResolution = await scanLocRes.Content.ReadFromJsonAsync<ScanResolutionDto>();
        Assert.IsNotNull(scanLocResolution);
        Assert.AreEqual(ScanResolutionType.PrivateRestricted, scanLocResolution.ResolutionType);
        Assert.IsNull(scanLocResolution.Location);
        Assert.IsNull(scanLocResolution.Item);
        Assert.IsNull(scanLocResolution.ChildLocations);
        Assert.IsNull(scanLocResolution.LocationItems);
        StringAssert.Contains(scanLocResolution.Message, "Private");

        // 3. User B scans Alice's private item shortCode
        var scanItemRes = await clientB.GetAsync($"/api/scan/{privItem.ShortCode}");
        Assert.AreEqual(HttpStatusCode.OK, scanItemRes.StatusCode);

        var scanItemResolution = await scanItemRes.Content.ReadFromJsonAsync<ScanResolutionDto>();
        Assert.IsNotNull(scanItemResolution);
        Assert.AreEqual(ScanResolutionType.PrivateRestricted, scanItemResolution.ResolutionType);
        Assert.IsNull(scanItemResolution.Location);
        Assert.IsNull(scanItemResolution.Item);
        StringAssert.Contains(scanItemResolution.Message, "Private");
    }
}
