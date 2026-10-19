using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Attachments;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Categories;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.Search;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class AttachmentAndSearchIntegrationTests
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
    public async Task AttachmentLifecycle_Upload_Download_Patch_Delete_AndUpdatesItemDto()
    {
        await RegisterAndAuthenticateAsync(_client, "att-user@example.com", "attuser");

        // 1. Create an item
        var itemReq = new CreateItemRequest(
            "Precision Screwdriver Set",
            Description: "Set of 64 bits",
            ItemType: ItemType.Unique
        );
        var itemResp = await _client.PostAsJsonAsync("/api/items", itemReq);
        Assert.AreEqual(HttpStatusCode.Created, itemResp.StatusCode);
        var item = await itemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);
        Assert.AreEqual(0, item.AttachmentCount);
        Assert.IsNull(item.PrimaryPhotoAttachmentId);

        // 2. Upload first attachment (PDF manual)
        var manualBytes = Encoding.UTF8.GetBytes("%PDF-1.4 Test Manual Content");
        using var manualContent = new MultipartFormDataContent();
        var fileContent1 = new ByteArrayContent(manualBytes);
        fileContent1.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        manualContent.Add(fileContent1, "file", "driver-manual.pdf");
        manualContent.Add(
            new StringContent(((int)AttachmentType.UserManual).ToString()),
            "attachmentType"
        );
        manualContent.Add(new StringContent("Original owner manual"), "notes");

        var uploadResp1 = await _client.PostAsync(
            $"/api/items/{item.Id}/attachments",
            manualContent
        );
        Assert.AreEqual(HttpStatusCode.Created, uploadResp1.StatusCode);
        var att1 = await uploadResp1.Content.ReadFromJsonAsync<ItemAttachmentDto>();
        Assert.IsNotNull(att1);
        Assert.AreEqual("driver-manual.pdf", att1.FileName);
        Assert.AreEqual(AttachmentType.UserManual, att1.AttachmentType);
        Assert.IsFalse(att1.IsPrimaryPhoto);

        // 3. Upload second attachment (Photo, set as primary)
        var photoBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46 };
        using var photoContent = new MultipartFormDataContent();
        var fileContent2 = new ByteArrayContent(photoBytes);
        fileContent2.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        photoContent.Add(fileContent2, "file", "driver-case.jpg");
        photoContent.Add(
            new StringContent(((int)AttachmentType.Photo).ToString()),
            "attachmentType"
        );
        photoContent.Add(new StringContent("true"), "isPrimaryPhoto");

        var uploadResp2 = await _client.PostAsync(
            $"/api/items/{item.Id}/attachments",
            photoContent
        );
        Assert.AreEqual(HttpStatusCode.Created, uploadResp2.StatusCode);
        var att2 = await uploadResp2.Content.ReadFromJsonAsync<ItemAttachmentDto>();
        Assert.IsNotNull(att2);
        Assert.AreEqual("driver-case.jpg", att2.FileName);
        Assert.IsTrue(att2.IsPrimaryPhoto);

        // 4. Verify item now reflects 2 attachments and primary photo id
        var getItemResp = await _client.GetAsync($"/api/items/{item.Id}");
        Assert.AreEqual(HttpStatusCode.OK, getItemResp.StatusCode);
        var updatedItem = await getItemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(updatedItem);
        Assert.AreEqual(2, updatedItem.AttachmentCount);
        Assert.AreEqual(att2.Id, updatedItem.PrimaryPhotoAttachmentId);

        // 5. Download manual content stream
        var downloadResp = await _client.GetAsync(
            $"/api/items/{item.Id}/attachments/{att1.Id}/content"
        );
        Assert.AreEqual(HttpStatusCode.OK, downloadResp.StatusCode);
        Assert.AreEqual("application/pdf", downloadResp.Content.Headers.ContentType?.MediaType);
        var downloadedBytes = await downloadResp.Content.ReadAsByteArrayAsync();
        CollectionAssert.AreEqual(manualBytes, downloadedBytes);

        // 6. Patch attachment 1 (make it primary photo)
        var patchReq = new UpdateItemAttachmentRequest(
            AttachmentType.Photo,
            Notes: "Updated notes",
            IsPrimaryPhoto: true
        );
        var patchResp = await _client.PatchAsJsonAsync(
            $"/api/items/{item.Id}/attachments/{att1.Id}",
            patchReq
        );
        Assert.AreEqual(HttpStatusCode.OK, patchResp.StatusCode);
        var patchedAtt = await patchResp.Content.ReadFromJsonAsync<ItemAttachmentDto>();
        Assert.IsNotNull(patchedAtt);
        Assert.IsTrue(patchedAtt.IsPrimaryPhoto);
        Assert.AreEqual("Updated notes", patchedAtt.Notes);

        // Verify att2 is no longer primary
        var listResp = await _client.GetAsync($"/api/items/{item.Id}/attachments");
        Assert.AreEqual(HttpStatusCode.OK, listResp.StatusCode);
        var attList = await listResp.Content.ReadFromJsonAsync<List<ItemAttachmentDto>>();
        Assert.IsNotNull(attList);
        Assert.HasCount(2, attList);
        Assert.IsFalse(attList.Single(a => a.Id == att2.Id).IsPrimaryPhoto);

        // 7. Delete attachment 1
        var delResp = await _client.DeleteAsync($"/api/items/{item.Id}/attachments/{att1.Id}");
        Assert.AreEqual(HttpStatusCode.NoContent, delResp.StatusCode);

        // Item attachment count should now be 1
        var getItemResp2 = await _client.GetAsync($"/api/items/{item.Id}");
        var finalItem = await getItemResp2.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(finalItem);
        Assert.AreEqual(1, finalItem.AttachmentCount);
    }

    [TestMethod]
    public async Task SmartSearch_MultiToken_AndFacetedFiltering()
    {
        await RegisterAndAuthenticateAsync(_client, "search-user@example.com", "searchuser");

        // 1. Create Location
        var locReq = new CreateLocationNodeRequest(
            "Electronics Workbench",
            NodeType: LocationNodeType.MovableContainer,
            ColorLabel: "Blue",
            Description: "Benchtop workstation"
        );
        var locResp = await _client.PostAsJsonAsync("/api/locations", locReq);
        Assert.AreEqual(HttpStatusCode.Created, locResp.StatusCode);
        var loc = await locResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(loc);

        // 2. Create Category with Attribute Template
        var catReq = new CreateCategoryRequest(
            "Audio Gear",
            AttributeTemplates:
            [
                new UpsertCategoryAttributeTemplateRequest(
                    null,
                    "Impedance",
                    AttributeFieldType.Number,
                    Unit: "ohms"
                ),
            ]
        );
        var catResp = await _client.PostAsJsonAsync("/api/categories", catReq);
        Assert.AreEqual(HttpStatusCode.Created, catResp.StatusCode);
        var cat = await catResp.Content.ReadFromJsonAsync<CategoryDto>();
        Assert.IsNotNull(cat);

        // 3. Create Item matching multiple searchable fields
        var itemReq = new CreateItemRequest(
            "Sennheiser Studio Headphones",
            Description: "Over-ear open back reference",
            CategoryId: cat.Id,
            HomeLocationId: loc.Id,
            Brand: "Sennheiser",
            ModelNumber: "HD600",
            Aliases: ["audiophile", "cans", "reference"],
            Tags: ["studio", "mixing", "audio"],
            AttributeValues:
            [
                new UpsertItemAttributeValueRequest(
                    cat.AttributeTemplates[0].Id,
                    "Impedance",
                    AttributeFieldType.Number,
                    "ohms",
                    "300"
                ),
            ]
        );
        var itemResp = await _client.PostAsJsonAsync("/api/items", itemReq);
        Assert.AreEqual(HttpStatusCode.Created, itemResp.StatusCode);
        var item = await itemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);

        // Upload attachment to item with notes
        var dummyBytes = Encoding.UTF8.GetBytes("Quick start guide");
        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(dummyBytes), "file", "hd600-specs.txt");
        form.Add(new StringContent("Acoustic calibration data"), "notes");
        await _client.PostAsync($"/api/items/{item.Id}/attachments", form);

        // 4. Test Multi-Token Matching across fields: "audiophile calibration"
        // 'audiophile' is in Aliases, 'calibration' is in Attachment notes
        var searchResp1 = await _client.GetAsync("/api/search?q=audiophile+calibration");
        Assert.AreEqual(HttpStatusCode.OK, searchResp1.StatusCode);
        var result1 = await searchResp1.Content.ReadFromJsonAsync<SmartSearchResponseDto>();
        Assert.IsNotNull(result1);
        Assert.HasCount(1, result1.ActiveItems);
        Assert.AreEqual(item.Id, result1.ActiveItems[0].Id);

        // 5. Test Location search hit matching ShortCode or ColorLabel
        var searchResp2 = await _client.GetAsync($"/api/search?q={loc.ShortCode}");
        Assert.AreEqual(HttpStatusCode.OK, searchResp2.StatusCode);
        var result2 = await searchResp2.Content.ReadFromJsonAsync<SmartSearchResponseDto>();
        Assert.IsNotNull(result2);
        Assert.IsTrue(result2.Locations.Any(l => l.Id == loc.Id));

        // 6. Test Faceted Numeric Attribute Search (Impedance >= 250)
        var searchResp3 = await _client.GetAsync(
            $"/api/search?categoryId={cat.Id}&attributeName=Impedance&attributeMinNumber=250"
        );
        Assert.AreEqual(HttpStatusCode.OK, searchResp3.StatusCode);
        var result3 = await searchResp3.Content.ReadFromJsonAsync<SmartSearchResponseDto>();
        Assert.IsNotNull(result3);
        Assert.HasCount(1, result3.ActiveItems);

        // 7. Test Faceted Numeric Attribute Search out of range (Impedance >= 400)
        var searchResp4 = await _client.GetAsync(
            $"/api/search?categoryId={cat.Id}&attributeName=Impedance&attributeMinNumber=400"
        );
        Assert.AreEqual(HttpStatusCode.OK, searchResp4.StatusCode);
        var result4 = await searchResp4.Content.ReadFromJsonAsync<SmartSearchResponseDto>();
        Assert.IsNotNull(result4);
        Assert.HasCount(0, result4.ActiveItems);
    }

    [TestMethod]
    public async Task SmartSearch_GraveyardSeparation_AndIncludeArchivedToggle()
    {
        await RegisterAndAuthenticateAsync(_client, "graveyard-user@example.com", "graveuser");

        // Create active item
        var activeReq = new CreateItemRequest("Active Soldering Station");
        var activeResp = await _client.PostAsJsonAsync("/api/items", activeReq);
        var activeItem = await activeResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(activeItem);

        // Create archived item
        var archivedReq = new CreateItemRequest("Archived Soldering Iron");
        var archivedResp = await _client.PostAsJsonAsync("/api/items", archivedReq);
        var archivedItem = await archivedResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(archivedItem);

        var updateReq = new UpdateItemRequest(
            "Archived Soldering Iron",
            ItemType: ItemType.Unique,
            Status: ItemStatus.Archived
        );
        var updateResp = await _client.PutAsJsonAsync($"/api/items/{archivedItem.Id}", updateReq);
        Assert.AreEqual(HttpStatusCode.OK, updateResp.StatusCode);

        // 1. Search with includeArchived=true (default)
        var searchResp1 = await _client.GetAsync("/api/search?q=Soldering&includeArchived=true");
        Assert.AreEqual(HttpStatusCode.OK, searchResp1.StatusCode);
        var result1 = await searchResp1.Content.ReadFromJsonAsync<SmartSearchResponseDto>();
        Assert.IsNotNull(result1);
        Assert.HasCount(1, result1.ActiveItems);
        Assert.AreEqual(activeItem.Id, result1.ActiveItems[0].Id);
        Assert.HasCount(1, result1.ArchivedItems);
        Assert.AreEqual(archivedItem.Id, result1.ArchivedItems[0].Id);
        Assert.AreEqual(2, result1.TotalCount);

        // 2. Search with includeArchived=false
        var searchResp2 = await _client.GetAsync("/api/search?q=Soldering&includeArchived=false");
        Assert.AreEqual(HttpStatusCode.OK, searchResp2.StatusCode);
        var result2 = await searchResp2.Content.ReadFromJsonAsync<SmartSearchResponseDto>();
        Assert.IsNotNull(result2);
        Assert.HasCount(1, result2.ActiveItems);
        Assert.HasCount(0, result2.ArchivedItems);
        Assert.AreEqual(1, result2.TotalCount);
    }

    [TestMethod]
    public async Task PrivacySecurity_PrivateItemAndAttachments_ForbiddenForOtherUser()
    {
        // 1. User A creates a private item with an attachment
        await RegisterAndAuthenticateAsync(_client, "owner@example.com", "owneruser");

        var privateItemReq = new CreateItemRequest(
            "Secret Birthday Gift",
            Description: "Surprise for spouse",
            IsPrivate: true
        );
        var itemResp = await _client.PostAsJsonAsync("/api/items", privateItemReq);
        Assert.AreEqual(HttpStatusCode.Created, itemResp.StatusCode);
        var item = await itemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);

        var dummyBytes = Encoding.UTF8.GetBytes("Gift receipt 2026");
        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(dummyBytes), "file", "secret-receipt.pdf");
        var uploadResp = await _client.PostAsync($"/api/items/{item.Id}/attachments", form);
        Assert.AreEqual(HttpStatusCode.Created, uploadResp.StatusCode);
        var att = await uploadResp.Content.ReadFromJsonAsync<ItemAttachmentDto>();
        Assert.IsNotNull(att);

        // 2. Switch to User B (different household user)
        await RegisterAndAuthenticateAsync(_client, "other@example.com", "otheruser");

        // Attempt to list attachments -> 403 Forbidden
        var listResp = await _client.GetAsync($"/api/items/{item.Id}/attachments");
        Assert.AreEqual(HttpStatusCode.Forbidden, listResp.StatusCode);

        // Attempt to download attachment content -> 403 Forbidden
        var getResp = await _client.GetAsync($"/api/items/{item.Id}/attachments/{att.Id}/content");
        Assert.AreEqual(HttpStatusCode.Forbidden, getResp.StatusCode);

        // Attempt to upload attachment -> 403 Forbidden
        using var form2 = new MultipartFormDataContent();
        form2.Add(new ByteArrayContent(dummyBytes), "file", "injected.pdf");
        var postResp = await _client.PostAsync($"/api/items/{item.Id}/attachments", form2);
        Assert.AreEqual(HttpStatusCode.Forbidden, postResp.StatusCode);

        // Attempt to delete attachment -> 403 Forbidden
        var delResp = await _client.DeleteAsync($"/api/items/{item.Id}/attachments/{att.Id}");
        Assert.AreEqual(HttpStatusCode.Forbidden, delResp.StatusCode);

        // Attempt to search for "Secret Birthday Gift" -> does NOT leak in results
        var searchResp = await _client.GetAsync("/api/search?q=Secret+Birthday");
        Assert.AreEqual(HttpStatusCode.OK, searchResp.StatusCode);
        var searchResult = await searchResp.Content.ReadFromJsonAsync<SmartSearchResponseDto>();
        Assert.IsNotNull(searchResult);
        Assert.HasCount(0, searchResult.ActiveItems);
        Assert.HasCount(0, searchResult.ArchivedItems);
    }
}
