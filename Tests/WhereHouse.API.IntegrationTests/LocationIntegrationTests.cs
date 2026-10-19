using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Locations;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class LocationIntegrationTests
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
    public async Task CreateLocationHierarchy_GeneratesShortCodesAndCalculatesPath()
    {
        await RegisterAndAuthenticateAsync(_client, "loc1@example.com", "locuser1");

        // 1. Create root fixed location: Garage
        var rootResponse = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Garage", LocationNodeType.FixedLocation)
        );
        Assert.AreEqual(HttpStatusCode.Created, rootResponse.StatusCode);
        var root = await rootResponse.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(root);
        Assert.AreEqual("LOC-001", root.ShortCode);
        Assert.AreEqual("Garage", root.FullPath);
        Assert.IsNull(root.ParentId);

        // 2. Create sub-location: West Wall Rack
        var rackResponse = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "West Wall Rack",
                LocationNodeType.FixedLocation,
                ParentId: root.Id
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, rackResponse.StatusCode);
        var rack = await rackResponse.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(rack);
        Assert.AreEqual("LOC-002", rack.ShortCode);
        Assert.AreEqual("Garage > West Wall Rack", rack.FullPath);
        Assert.HasCount(2, rack.Breadcrumbs);

        // 3. Create movable container: BIN-001
        var binResponse = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Winter Camping Bin",
                LocationNodeType.MovableContainer,
                ParentId: rack.Id,
                ContainerStyle: "27-Gal Heavy Duty Tote",
                PrimaryColor: "#1f2937",
                AccentColor: "#eab308",
                ColorLabel: "Black Base / Yellow Lid"
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, binResponse.StatusCode);
        var bin = await binResponse.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(bin);
        Assert.AreEqual("BIN-001", bin.ShortCode);
        Assert.AreEqual("Garage > West Wall Rack > Winter Camping Bin", bin.FullPath);
        Assert.AreEqual("27-Gal Heavy Duty Tote", bin.ContainerStyle);
        Assert.AreEqual("Black Base / Yellow Lid", bin.ColorLabel);

        // 4. Check Tree endpoint
        var treeResponse = await _client.GetAsync("/api/locations/tree");
        Assert.AreEqual(HttpStatusCode.OK, treeResponse.StatusCode);
        var tree = await treeResponse.Content.ReadFromJsonAsync<List<LocationTreeNodeDto>>();
        Assert.IsNotNull(tree);
        Assert.HasCount(1, tree);
        Assert.AreEqual("Garage", tree[0].Name);
        Assert.HasCount(1, tree[0].Children);
        Assert.AreEqual("West Wall Rack", tree[0].Children[0].Name);
        Assert.HasCount(1, tree[0].Children[0].Children);
        Assert.AreEqual("Winter Camping Bin", tree[0].Children[0].Children[0].Name);
    }

    [TestMethod]
    public async Task MoveContainer_InheritsUpdatedPathForDescendants()
    {
        await RegisterAndAuthenticateAsync(_client, "loc2@example.com", "locuser2");

        // Create House -> Basement
        var basementResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Basement", LocationNodeType.FixedLocation)
        );
        var basement = await basementResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(basement);

        // Create Garage
        var garageResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Garage", LocationNodeType.FixedLocation)
        );
        var garage = await garageResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(garage);

        // Create Tote inside Garage
        var toteResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Tote A",
                LocationNodeType.MovableContainer,
                ParentId: garage.Id
            )
        );
        var tote = await toteResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(tote);

        // Create Small Box inside Tote A
        var boxResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Small Box 1",
                LocationNodeType.MovableContainer,
                ParentId: tote.Id
            )
        );
        var box = await boxResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(box);
        Assert.AreEqual("Garage > Tote A > Small Box 1", box.FullPath);

        // Move Tote A to Basement
        var moveResp = await _client.PatchAsJsonAsync(
            $"/api/locations/{tote.Id}/move",
            new MoveLocationNodeRequest(basement.Id)
        );
        Assert.AreEqual(HttpStatusCode.OK, moveResp.StatusCode);
        var movedTote = await moveResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(movedTote);
        Assert.AreEqual("Basement > Tote A", movedTote.FullPath);

        // Verify child Small Box 1 automatically inherits new FullPath
        var getBoxResp = await _client.GetAsync($"/api/locations/{box.Id}");
        Assert.AreEqual(HttpStatusCode.OK, getBoxResp.StatusCode);
        var updatedBox = await getBoxResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(updatedBox);
        Assert.AreEqual("Basement > Tote A > Small Box 1", updatedBox.FullPath);
    }

    [TestMethod]
    public async Task MoveContainer_PreventCircularMove_ReturnsConflict()
    {
        await RegisterAndAuthenticateAsync(_client, "loc3@example.com", "locuser3");

        var rootResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Root", LocationNodeType.FixedLocation)
        );
        var root = await rootResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(root);

        var childResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Child",
                LocationNodeType.FixedLocation,
                ParentId: root.Id
            )
        );
        var child = await childResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(child);

        // Cannot move into itself
        var moveSelfResp = await _client.PatchAsJsonAsync(
            $"/api/locations/{root.Id}/move",
            new MoveLocationNodeRequest(root.Id)
        );
        Assert.AreEqual(HttpStatusCode.Conflict, moveSelfResp.StatusCode);

        // Cannot move into its own descendant
        var moveDescendantResp = await _client.PatchAsJsonAsync(
            $"/api/locations/{root.Id}/move",
            new MoveLocationNodeRequest(child.Id)
        );
        Assert.AreEqual(HttpStatusCode.Conflict, moveDescendantResp.StatusCode);
    }

    [TestMethod]
    public async Task DeleteLocation_NonEmptyReturnsConflict_EmptyReturnsNoContent()
    {
        await RegisterAndAuthenticateAsync(_client, "loc4@example.com", "locuser4");

        var parentResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Parent", LocationNodeType.FixedLocation)
        );
        var parent = await parentResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(parent);

        var childResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Child",
                LocationNodeType.FixedLocation,
                ParentId: parent.Id
            )
        );
        var child = await childResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(child);

        // Delete parent while child exists -> Conflict
        var delParentResp = await _client.DeleteAsync($"/api/locations/{parent.Id}");
        Assert.AreEqual(HttpStatusCode.Conflict, delParentResp.StatusCode);

        // Delete child -> NoContent
        var delChildResp = await _client.DeleteAsync($"/api/locations/{child.Id}");
        Assert.AreEqual(HttpStatusCode.NoContent, delChildResp.StatusCode);

        // Now parent can be deleted -> NoContent
        var delParentAgainResp = await _client.DeleteAsync($"/api/locations/{parent.Id}");
        Assert.AreEqual(HttpStatusCode.NoContent, delParentAgainResp.StatusCode);
    }

    [TestMethod]
    public async Task SecretGiftMode_HidesNodeAndSubtreeFromOtherUsers()
    {
        await RegisterAndAuthenticateAsync(_client, "owner@example.com", "owneruser");

        // Owner creates private container
        var createPrivateResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Secret Birthday Bin",
                LocationNodeType.MovableContainer,
                IsPrivate: true
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, createPrivateResp.StatusCode);
        var privateNode = await createPrivateResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(privateNode);
        Assert.IsTrue(privateNode.IsPrivate);

        // Other household user logs in
        using var otherClient = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(otherClient, "other@example.com", "otheruser");

        // 1. Direct GET by ID returns Forbidden
        var getDirectResp = await otherClient.GetAsync($"/api/locations/{privateNode.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, getDirectResp.StatusCode);

        // 2. List endpoint omits private container
        var listResp = await otherClient.GetAsync("/api/locations");
        Assert.AreEqual(HttpStatusCode.OK, listResp.StatusCode);
        var list = await listResp.Content.ReadFromJsonAsync<List<LocationNodeDto>>();
        Assert.IsNotNull(list);
        Assert.IsFalse(list.Any(n => n.Id == privateNode.Id));

        // 3. Tree endpoint omits private container
        var treeResp = await otherClient.GetAsync("/api/locations/tree");
        Assert.AreEqual(HttpStatusCode.OK, treeResp.StatusCode);
        var tree = await treeResp.Content.ReadFromJsonAsync<List<LocationTreeNodeDto>>();
        Assert.IsNotNull(tree);
        Assert.IsFalse(tree.Any(n => n.Id == privateNode.Id));

        // 4. Update returns Forbidden
        var updateResp = await otherClient.PutAsJsonAsync(
            $"/api/locations/{privateNode.Id}",
            new UpdateLocationNodeRequest("Hacked Bin", LocationNodeType.MovableContainer)
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, updateResp.StatusCode);

        // 5. Delete returns Forbidden
        var deleteResp = await otherClient.DeleteAsync($"/api/locations/{privateNode.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, deleteResp.StatusCode);
    }
}
