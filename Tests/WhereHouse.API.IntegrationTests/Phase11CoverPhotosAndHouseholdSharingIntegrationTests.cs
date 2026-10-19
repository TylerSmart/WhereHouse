using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.Search;

namespace WhereHouse.API.IntegrationTests;

#pragma warning disable MSTEST0037

[TestClass]
public sealed class Phase11CoverPhotosAndHouseholdSharingIntegrationTests
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
    public async Task GetHouseholdUsers_ReturnsActiveUsers()
    {
        await RegisterAndAuthenticateAsync(_client, "alice@example.com", "alice");

        using var clientBob = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(clientBob, "bob@example.com", "bob");

        var response = await _client.GetAsync("/api/auth/users");
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var users = await response.Content.ReadFromJsonAsync<List<UserSummaryDto>>();
        Assert.IsNotNull(users);
        Assert.IsTrue(users.Any(u => u.Username == "alice"));
        Assert.IsTrue(users.Any(u => u.Username == "bob"));
    }

    [TestMethod]
    public async Task PrivateItem_SharedWithHouseholdUser_IsVisibleToSharedUserAndHiddenFromUnsharedUser()
    {
        // Register Alice (owner), Bob (shared), and Charlie (unshared)
        var alice = await RegisterAndAuthenticateAsync(_client, "alice2@example.com", "alice2");

        using var clientBob = _factory.CreateClient();
        var bob = await RegisterAndAuthenticateAsync(clientBob, "bob2@example.com", "bob2");

        using var clientCharlie = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(clientCharlie, "charlie2@example.com", "charlie2");

        // Alice creates a private item shared with Bob
        var createRequest = new CreateItemRequest(
            Name: "Secret Anniversary Gift",
            ItemType: ItemType.Unique,
            IsPrivate: true,
            SharedWithUserIds: [bob.Id]
        );
        var createResponse = await _client.PostAsJsonAsync("/api/items", createRequest);
        Assert.AreEqual(HttpStatusCode.Created, createResponse.StatusCode);

        var item = await createResponse.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);
        Assert.IsTrue(item.IsPrivate);
        Assert.IsNotNull(item.SharedWithUserIds);
        Assert.AreEqual(1, item.SharedWithUserIds.Count);
        Assert.AreEqual(bob.Id, item.SharedWithUserIds[0]);

        // Alice can see her private item
        var aliceGetResponse = await _client.GetAsync($"/api/items/{item.Id}");
        Assert.AreEqual(HttpStatusCode.OK, aliceGetResponse.StatusCode);

        // Bob can see the shared private item
        var bobGetResponse = await clientBob.GetAsync($"/api/items/{item.Id}");
        Assert.AreEqual(HttpStatusCode.OK, bobGetResponse.StatusCode);

        // Charlie CANNOT see the private item
        var charlieGetResponse = await clientCharlie.GetAsync($"/api/items/{item.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, charlieGetResponse.StatusCode);
    }

    [TestMethod]
    public async Task LocationCoverPhoto_UploadGetAndDelete_WorksEndToEnd()
    {
        await RegisterAndAuthenticateAsync(_client, "locowner@example.com", "locowner");

        // 1. Create movable container
        var createLocResponse = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Heavy Duty Tote", LocationNodeType.MovableContainer)
        );
        Assert.AreEqual(HttpStatusCode.Created, createLocResponse.StatusCode);
        var location = await createLocResponse.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(location);
        Assert.IsNull(location.CoverAttachmentId);

        // 2. Upload cover photo
        using var content = new MultipartFormDataContent();
        var imageBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46 }; // Fake JPEG header
        var byteContent = new ByteArrayContent(imageBytes);
        byteContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        content.Add(byteContent, "file", "tote_cover.jpg");

        var uploadResponse = await _client.PostAsync(
            $"/api/locations/{location.Id}/cover-photo",
            content
        );
        Assert.AreEqual(HttpStatusCode.OK, uploadResponse.StatusCode);

        var updatedLoc = await uploadResponse.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(updatedLoc);
        Assert.IsNotNull(updatedLoc.CoverAttachmentId);

        // 3. Verify tree returns CoverAttachmentId
        var treeResponse = await _client.GetAsync("/api/locations/tree");
        Assert.AreEqual(HttpStatusCode.OK, treeResponse.StatusCode);
        var tree = await treeResponse.Content.ReadFromJsonAsync<List<LocationTreeNodeDto>>();
        Assert.IsNotNull(tree);
        var treeNode = tree.FirstOrDefault(t => t.Id == location.Id);
        Assert.IsNotNull(treeNode);
        Assert.AreEqual(updatedLoc.CoverAttachmentId, treeNode.CoverAttachmentId);

        // 4. Download cover photo
        var getPhotoResponse = await _client.GetAsync($"/api/locations/{location.Id}/cover-photo");
        Assert.AreEqual(HttpStatusCode.OK, getPhotoResponse.StatusCode);
        Assert.AreEqual("image/jpeg", getPhotoResponse.Content.Headers.ContentType?.MediaType);
        var downloadedBytes = await getPhotoResponse.Content.ReadAsByteArrayAsync();
        Assert.AreEqual(imageBytes.Length, downloadedBytes.Length);

        // 5. Delete cover photo
        var deleteResponse = await _client.DeleteAsync($"/api/locations/{location.Id}/cover-photo");
        Assert.AreEqual(HttpStatusCode.OK, deleteResponse.StatusCode);
        var locAfterDelete = await deleteResponse.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(locAfterDelete);
        Assert.IsNull(locAfterDelete.CoverAttachmentId);
    }

    [TestMethod]
    public async Task SmartSearch_WithFacetedOwnerFilter_FiltersItemsByOwner()
    {
        var alice = await RegisterAndAuthenticateAsync(_client, "alice3@example.com", "alice3");

        using var clientBob = _factory.CreateClient();
        var bob = await RegisterAndAuthenticateAsync(clientBob, "bob3@example.com", "bob3");

        // Alice creates an item
        await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Alice Hammer", ItemType.Unique)
        );

        // Bob creates an item
        await clientBob.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("Bob Screwdriver", ItemType.Unique)
        );

        // Search filtering by Alice's owner ID
        var searchResponse = await _client.GetAsync($"/api/search?ownerUserId={alice.Id}");
        Assert.AreEqual(HttpStatusCode.OK, searchResponse.StatusCode);

        var result = await searchResponse.Content.ReadFromJsonAsync<SmartSearchResponseDto>();
        Assert.IsNotNull(result);
        Assert.IsTrue(result.ActiveItems.Any(i => i.Name == "Alice Hammer"));
        Assert.IsFalse(result.ActiveItems.Any(i => i.Name == "Bob Screwdriver"));
    }
}
