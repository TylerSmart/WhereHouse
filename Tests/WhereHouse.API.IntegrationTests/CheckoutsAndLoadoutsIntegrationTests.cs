using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Checkouts;
using WhereHouse.Core.Items;
using WhereHouse.Core.Loadouts;
using WhereHouse.Core.Locations;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class CheckoutsAndLoadoutsIntegrationTests
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
    public async Task SingleItemCheckout_ExternalLoan_AndReturn_PreservesHomeLocation()
    {
        await RegisterAndAuthenticateAsync(_client, "checkout1@example.com", "checkoutuser1");

        // Create Home Location
        var locRes = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Garage Shelf A",
                NodeType: LocationNodeType.FixedLocation
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, locRes.StatusCode);
        var loc = await locRes.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(loc);

        // Create Unique Item
        var itemRes = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Cordless Drill",
                HomeLocationId: loc.Id,
                ItemType: ItemType.Unique
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, itemRes.StatusCode);
        var item = await itemRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);
        Assert.AreEqual(ItemStatus.InPlace, item.Status);
        Assert.AreEqual(loc.Id, item.HomeLocationId);

        // 1. Check out In Use
        var checkoutReq = new CheckoutItemRequest(
            IsExternalLoan: false,
            ProjectOrNote: "Kitchen Cabinet Repair"
        );
        var chkRes = await _client.PostAsJsonAsync(
            $"/api/checkouts/items/{item.Id}/checkout",
            checkoutReq
        );
        Assert.AreEqual(HttpStatusCode.OK, chkRes.StatusCode);
        var chkItem = await chkRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(chkItem);
        Assert.AreEqual(ItemStatus.InUse, chkItem.Status);
        Assert.AreEqual(loc.Id, chkItem.HomeLocationId); // Preserved!
        Assert.AreEqual("Kitchen Cabinet Repair", chkItem.CheckoutNote);
        Assert.AreEqual("checkoutuser1", chkItem.CheckedOutByUsername);

        // 2. Return to Home
        var returnReq = new ReturnItemRequest(ReturnNote: "Done with cabinets");
        var retRes = await _client.PostAsJsonAsync(
            $"/api/checkouts/items/{item.Id}/return",
            returnReq
        );
        Assert.AreEqual(HttpStatusCode.OK, retRes.StatusCode);
        var retItem = await retRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(retItem);
        Assert.AreEqual(ItemStatus.InPlace, retItem.Status);
        Assert.AreEqual(loc.Id, retItem.HomeLocationId);
        Assert.IsNull(retItem.CheckedOutByUsername);

        // 3. External Loan with Due Date in past (to test overdue)
        var pastDue = DateTimeOffset.UtcNow.AddDays(-2);
        var loanReq = new CheckoutItemRequest(
            IsExternalLoan: true,
            BorrowerName: "Dave Miller",
            BorrowerContact: "dave@example.com",
            ProjectOrNote: "Weekend deck project",
            ExpectedReturnAt: pastDue
        );
        var loanRes = await _client.PostAsJsonAsync(
            $"/api/checkouts/items/{item.Id}/checkout",
            loanReq
        );
        Assert.AreEqual(HttpStatusCode.OK, loanRes.StatusCode);
        var loanedItem = await loanRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(loanedItem);
        Assert.AreEqual(ItemStatus.LoanedOut, loanedItem.Status);
        Assert.AreEqual("Dave Miller", loanedItem.CheckedOutToBorrower);
        Assert.AreEqual("dave@example.com", loanedItem.CheckedOutBorrowerContact);
        Assert.IsTrue(loanedItem.IsOverdueLoan);

        // Verify GET /api/checkouts/active?overdueOnly=true
        var activeRes = await _client.GetAsync("/api/checkouts/active?overdueOnly=true");
        Assert.AreEqual(HttpStatusCode.OK, activeRes.StatusCode);
        var activeItems = await activeRes.Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.IsNotNull(activeItems);
        Assert.IsTrue(activeItems.Any(i => i.Id == item.Id));

        // Verify GET /api/checkouts/items/{id}/history
        var histRes = await _client.GetAsync($"/api/checkouts/items/{item.Id}/history");
        Assert.AreEqual(HttpStatusCode.OK, histRes.StatusCode);
        var history = await histRes.Content.ReadFromJsonAsync<List<CheckoutLogDto>>();
        Assert.IsNotNull(history);
        Assert.IsGreaterThanOrEqualTo(history.Count, 3);
    }

    [TestMethod]
    public async Task KitCascadeCheckout_AndReturn_CascadesToChildItems()
    {
        await RegisterAndAuthenticateAsync(_client, "kituser@example.com", "kituser");

        // Create Parent Kit
        var kitRes = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Camera Rig Kit", ItemType: ItemType.Kit)
        );
        Assert.AreEqual(HttpStatusCode.Created, kitRes.StatusCode);
        var kit = await kitRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(kit);

        // Create Child Items
        var child1Res = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Camera Body", ItemType: ItemType.Nested, ParentItemId: kit.Id)
        );
        var child2Res = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("50mm Lens", ItemType: ItemType.Nested, ParentItemId: kit.Id)
        );
        Assert.AreEqual(HttpStatusCode.Created, child1Res.StatusCode);
        Assert.AreEqual(HttpStatusCode.Created, child2Res.StatusCode);

        var child1 = await child1Res.Content.ReadFromJsonAsync<ItemDto>();
        var child2 = await child2Res.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(child1);
        Assert.IsNotNull(child2);

        // Check out the kit
        var chkRes = await _client.PostAsJsonAsync(
            $"/api/checkouts/items/{kit.Id}/checkout",
            new CheckoutItemRequest(ProjectOrNote: "Photo Shoot")
        );
        Assert.AreEqual(HttpStatusCode.OK, chkRes.StatusCode);

        // Verify both children cascaded to InUse
        var c1Chk = await _client.GetFromJsonAsync<ItemDto>($"/api/items/{child1.Id}");
        var c2Chk = await _client.GetFromJsonAsync<ItemDto>($"/api/items/{child2.Id}");
        Assert.IsNotNull(c1Chk);
        Assert.IsNotNull(c2Chk);
        Assert.AreEqual(ItemStatus.InUse, c1Chk.Status);
        Assert.AreEqual(ItemStatus.InUse, c2Chk.Status);

        // Return the kit
        var retRes = await _client.PostAsJsonAsync(
            $"/api/checkouts/items/{kit.Id}/return",
            new ReturnItemRequest(ReturnNote: "Shoot wrapped")
        );
        Assert.AreEqual(HttpStatusCode.OK, retRes.StatusCode);

        // Verify both children cascaded back to InPlace
        var c1Ret = await _client.GetFromJsonAsync<ItemDto>($"/api/items/{child1.Id}");
        var c2Ret = await _client.GetFromJsonAsync<ItemDto>($"/api/items/{child2.Id}");
        Assert.IsNotNull(c1Ret);
        Assert.IsNotNull(c2Ret);
        Assert.AreEqual(ItemStatus.InPlace, c1Ret.Status);
        Assert.AreEqual(ItemStatus.InPlace, c2Ret.Status);
    }

    [TestMethod]
    public async Task BatchCheckout_AndBatchReturn_ProjectCart()
    {
        await RegisterAndAuthenticateAsync(_client, "cartuser@example.com", "cartuser");

        var item1Res = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Hammer", ItemType: ItemType.Unique)
        );
        var item2Res = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Drywall Screws",
                ItemType: ItemType.Quantity,
                CurrentQuantity: 100,
                MinQuantity: 20
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, item1Res.StatusCode);
        Assert.AreEqual(HttpStatusCode.Created, item2Res.StatusCode);

        var item1 = await item1Res.Content.ReadFromJsonAsync<ItemDto>();
        var item2 = await item2Res.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item1);
        Assert.IsNotNull(item2);

        // Batch Checkout
        var batchChkReq = new BatchCheckoutRequest(
            ItemIds: new[] { item1.Id, item2.Id },
            ProjectOrNote: "Hang drywall in garage"
        );
        var batchRes = await _client.PostAsJsonAsync("/api/checkouts/batch-checkout", batchChkReq);
        Assert.AreEqual(HttpStatusCode.OK, batchRes.StatusCode);
        var batchDto = await batchRes.Content.ReadFromJsonAsync<BatchCheckoutResultDto>();
        Assert.IsNotNull(batchDto);
        Assert.AreEqual(2, batchDto.ProcessedCount);

        // Batch Return with consumable consumption on item2
        var batchRetReq = new BatchReturnRequest(
            Items: new[]
            {
                new BatchReturnItemEntry(item1.Id),
                new BatchReturnItemEntry(item2.Id, QuantityUsed: 25),
            },
            ReturnNote: "Project finished"
        );
        var retRes = await _client.PostAsJsonAsync("/api/checkouts/batch-return", batchRetReq);
        Assert.AreEqual(HttpStatusCode.OK, retRes.StatusCode);

        // Verify item2 stock was reduced: 100 - 25 = 75
        var updatedItem2 = await _client.GetFromJsonAsync<ItemDto>($"/api/items/{item2.Id}");
        Assert.IsNotNull(updatedItem2);
        Assert.AreEqual(75m, updatedItem2.CurrentQuantity);
        Assert.AreEqual(ItemStatus.InPlace, updatedItem2.Status);
    }

    [TestMethod]
    public async Task ReusableLoadout_PreFlightCheck_PickList_Checkout_AndPackBack()
    {
        await RegisterAndAuthenticateAsync(_client, "loadoutuser@example.com", "loadoutuser");

        // Create locations
        var bin1Res = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Bin 01 - Camping Gear",
                NodeType: LocationNodeType.MovableContainer
            )
        );
        var bin2Res = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Bin 02 - First Aid",
                NodeType: LocationNodeType.MovableContainer
            )
        );
        var bin1 = await bin1Res.Content.ReadFromJsonAsync<LocationNodeDto>();
        var bin2 = await bin2Res.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(bin1);
        Assert.IsNotNull(bin2);

        // Create items
        var tentRes = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "2-Person Tent",
                HomeLocationId: bin1.Id,
                ItemType: ItemType.Unique
            )
        );
        var stakesRes = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Tent Stakes",
                HomeLocationId: bin1.Id,
                ItemType: ItemType.Quantity,
                CurrentQuantity: 8
            )
        );
        var bandagesRes = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Adhesive Bandages",
                HomeLocationId: bin2.Id,
                ItemType: ItemType.Quantity,
                CurrentQuantity: 30
            )
        );

        var tent = await tentRes.Content.ReadFromJsonAsync<ItemDto>();
        var stakes = await stakesRes.Content.ReadFromJsonAsync<ItemDto>();
        var bandages = await bandagesRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(tent);
        Assert.IsNotNull(stakes);
        Assert.IsNotNull(bandages);

        // Create Loadout
        var createLoadoutReq = new CreateLoadoutRequest(
            Name: "Weekend Camp Trip",
            Description: "Essential camping gear and first aid",
            Icon: "camping",
            Items: new[]
            {
                new UpsertLoadoutItemRequest(tent.Id, RequiredQuantity: 1, IsConsumable: false),
                new UpsertLoadoutItemRequest(stakes.Id, RequiredQuantity: 6, IsConsumable: false),
                new UpsertLoadoutItemRequest(bandages.Id, RequiredQuantity: 5, IsConsumable: true),
            }
        );

        var createRes = await _client.PostAsJsonAsync("/api/loadouts", createLoadoutReq);
        Assert.AreEqual(HttpStatusCode.Created, createRes.StatusCode);
        var loadout = await createRes.Content.ReadFromJsonAsync<LoadoutDto>();
        Assert.IsNotNull(loadout);
        Assert.AreEqual(LoadoutStatus.Ready, loadout.Status);
        Assert.AreEqual(3, loadout.TotalItemCount);
        Assert.AreEqual(0, loadout.PreFlightWarningCount);

        // Verify Room-by-Room Pick List Stops
        Assert.HasCount(2, loadout.PickListStops);

        // Checkout the loadout
        var chkRes = await _client.PostAsJsonAsync(
            $"/api/loadouts/{loadout.Id}/checkout",
            new CheckoutLoadoutRequest(CheckoutNote: "Pine Valley Trip")
        );
        Assert.AreEqual(HttpStatusCode.OK, chkRes.StatusCode);
        var chkLoadout = await chkRes.Content.ReadFromJsonAsync<LoadoutDto>();
        Assert.IsNotNull(chkLoadout);
        Assert.AreEqual(LoadoutStatus.ActiveCheckout, chkLoadout.Status);
        Assert.AreEqual(3, chkLoadout.CheckedOutItemCount);

        // Pack-Back with consumable reconciliation: 2 bandages used, 1 stake lost (not returned)
        var packBackReq = new PackBackLoadoutRequest(
            Items: new[]
            {
                new PackBackLoadoutItemEntry(tent.Id, IsReturned: true),
                new PackBackLoadoutItemEntry(stakes.Id, IsReturned: false), // Lost/unreturned: stays checked out
                new PackBackLoadoutItemEntry(bandages.Id, IsReturned: true, QuantityUsed: 2),
            },
            ReturnNote: "Back from trip"
        );

        var pbRes = await _client.PostAsJsonAsync(
            $"/api/loadouts/{loadout.Id}/pack-back",
            packBackReq
        );
        Assert.AreEqual(HttpStatusCode.OK, pbRes.StatusCode);
        var pbLoadout = await pbRes.Content.ReadFromJsonAsync<LoadoutDto>();
        Assert.IsNotNull(pbLoadout);

        // Stakes are still not returned, so loadout status remains ActiveCheckout
        Assert.AreEqual(LoadoutStatus.ActiveCheckout, pbLoadout.Status);
        Assert.AreEqual(1, pbLoadout.CheckedOutItemCount);

        // Verify Bandages consumable deduction: 30 - 2 = 28
        var updatedBandages = await _client.GetFromJsonAsync<ItemDto>($"/api/items/{bandages.Id}");
        Assert.IsNotNull(updatedBandages);
        Assert.AreEqual(28m, updatedBandages.CurrentQuantity);
        Assert.AreEqual(ItemStatus.InPlace, updatedBandages.Status);

        // Now return the missing stakes
        var finishPbReq = new PackBackLoadoutRequest(
            Items: new[]
            {
                new PackBackLoadoutItemEntry(stakes.Id, IsReturned: true, QuantityReturned: 6),
            }
        );
        var finishRes = await _client.PostAsJsonAsync(
            $"/api/loadouts/{loadout.Id}/pack-back",
            finishPbReq
        );
        Assert.AreEqual(HttpStatusCode.OK, finishRes.StatusCode);
        var finLoadout = await finishRes.Content.ReadFromJsonAsync<LoadoutDto>();
        Assert.IsNotNull(finLoadout);
        Assert.AreEqual(LoadoutStatus.Ready, finLoadout.Status);
        Assert.AreEqual(0, finLoadout.CheckedOutItemCount);
    }

    [TestMethod]
    public async Task SecretGiftMode_PrivateLoadoutAndItem_AreIsolatedFromOtherUsers()
    {
        // User A creates a private item and private loadout
        await RegisterAndAuthenticateAsync(_client, "alice@example.com", "alice");

        var privItemRes = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Surprise Diamond Ring",
                ItemType: ItemType.Unique,
                IsPrivate: true
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, privItemRes.StatusCode);
        var privItem = await privItemRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(privItem);

        var privLoadoutRes = await _client.PostAsJsonAsync(
            "/api/loadouts",
            new CreateLoadoutRequest(
                Name: "Anniversary Surprise",
                IsPrivate: true,
                Items: new[] { new UpsertLoadoutItemRequest(privItem.Id) }
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, privLoadoutRes.StatusCode);
        var privLoadout = await privLoadoutRes.Content.ReadFromJsonAsync<LoadoutDto>();
        Assert.IsNotNull(privLoadout);

        // User B tries to view or check out User A's private item and loadout
        using var clientB = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(clientB, "bob@example.com", "bob");

        // 1. GET /api/loadouts does not show Alice's private loadout to Bob
        var bobLoadouts = await clientB.GetFromJsonAsync<List<LoadoutDto>>("/api/loadouts");
        Assert.IsNotNull(bobLoadouts);
        Assert.IsFalse(bobLoadouts.Any(l => l.Id == privLoadout.Id));

        // 2. GET /api/loadouts/{id} returns 403 Forbidden
        var bobGetRes = await clientB.GetAsync($"/api/loadouts/{privLoadout.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, bobGetRes.StatusCode);

        // 3. Bob cannot checkout Alice's private item
        var bobChkRes = await clientB.PostAsJsonAsync(
            $"/api/checkouts/items/{privItem.Id}/checkout",
            new CheckoutItemRequest(ProjectOrNote: "Attempting snooping")
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, bobChkRes.StatusCode);

        // 4. Bob cannot create a loadout containing Alice's private item
        var bobCreateRes = await clientB.PostAsJsonAsync(
            "/api/loadouts",
            new CreateLoadoutRequest(
                Name: "Bob Snooping Loadout",
                Items: new[] { new UpsertLoadoutItemRequest(privItem.Id) }
            )
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, bobCreateRes.StatusCode);
    }
}
