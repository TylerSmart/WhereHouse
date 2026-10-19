using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Attachments;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Insurance;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.Maintenance;
using WhereHouse.Core.Search;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class Phase08VaultAndAutomationIntegrationTests
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
    public async Task PdfManual_FullTextExtraction_And_SearchIndexing()
    {
        await RegisterAndAuthenticateAsync(_client, "pdf-indexer@example.com", "pdfindexer");

        // 1. Create item
        var createItemResp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Festool Track Saw TS 55",
                Description: "Plunge cut saw with guide rail",
                Brand: "Festool",
                ModelNumber: "TS 55 FEQ-F-Plus"
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, createItemResp.StatusCode);
        var item = await createItemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);

        // 2. Upload PDF manual with specific part number: "TS55-BLADE-9921"
        var pdfContent = """
            %PDF-1.4
            1 0 obj
            stream
            BT
            /F1 10 Tf
            (Festool TS 55 Manual: Warning Error E04 replacement blade part TS55-BLADE-9921) Tj
            ET
            endstream
            endobj
            %%EOF
            """;
        var pdfBytes = Encoding.UTF8.GetBytes(pdfContent);

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(pdfBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(fileContent, "file", "TS55_Manual.pdf");
        form.Add(new StringContent(((int)AttachmentType.UserManual).ToString()), "attachmentType");
        form.Add(new StringContent("Official OEM user guide"), "notes");

        var uploadResp = await _client.PostAsync($"/api/items/{item.Id}/attachments", form);
        Assert.AreEqual(HttpStatusCode.Created, uploadResp.StatusCode);
        var attachment = await uploadResp.Content.ReadFromJsonAsync<ItemAttachmentDto>();
        Assert.IsNotNull(attachment);
        Assert.IsTrue(attachment.HasExtractedText);
        Assert.IsNotNull(attachment.ExtractedText);
        StringAssert.Contains(attachment.ExtractedText, "TS55-BLADE-9921");

        // 3. Search with includeAttachmentText = true -> should find item
        var searchRespTrue = await _client.GetAsync(
            "/api/search?q=TS55-BLADE-9921&includeAttachmentText=true"
        );
        Assert.AreEqual(HttpStatusCode.OK, searchRespTrue.StatusCode);
        var searchResultTrue =
            await searchRespTrue.Content.ReadFromJsonAsync<SmartSearchResponseDto>();
        Assert.IsNotNull(searchResultTrue);
        Assert.HasCount(1, searchResultTrue.ActiveItems);
        Assert.AreEqual(item.Id, searchResultTrue.ActiveItems[0].Id);

        // 4. Search with includeAttachmentText = false -> should NOT find item
        var searchRespFalse = await _client.GetAsync(
            "/api/search?q=TS55-BLADE-9921&includeAttachmentText=false"
        );
        Assert.AreEqual(HttpStatusCode.OK, searchRespFalse.StatusCode);
        var searchResultFalse =
            await searchRespFalse.Content.ReadFromJsonAsync<SmartSearchResponseDto>();
        Assert.IsNotNull(searchResultFalse);
        Assert.IsEmpty(searchResultFalse.ActiveItems);
    }

    [TestMethod]
    public async Task MaintenanceSchedules_Create_Complete_DueStatus_AndLogs()
    {
        await RegisterAndAuthenticateAsync(_client, "maint-user@example.com", "maintuser");

        // 1. Create item
        var createItemResp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest("DeWalt Leaf Blower", ItemType: ItemType.Unique)
        );
        var item = await createItemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);

        // 2. Create maintenance schedule: 30 days interval
        var createScheduleReq = new CreateMaintenanceScheduleRequest(
            "Clean Intake Screen & Check Battery",
            Description: "Blow out air intake and verify 60V battery health",
            IntervalValue: 30,
            IntervalUnit: MaintenanceIntervalUnit.Days
        );
        var createScheduleResp = await _client.PostAsJsonAsync(
            $"/api/maintenance/items/{item.Id}/schedules",
            createScheduleReq
        );
        Assert.AreEqual(HttpStatusCode.Created, createScheduleResp.StatusCode);
        var schedule = await createScheduleResp.Content.ReadFromJsonAsync<MaintenanceScheduleDto>();
        Assert.IsNotNull(schedule);
        Assert.AreEqual("Clean Intake Screen & Check Battery", schedule.Title);
        Assert.AreEqual(30, schedule.IntervalValue);
        Assert.AreEqual(MaintenanceIntervalUnit.Days, schedule.IntervalUnit);
        Assert.AreEqual(MaintenanceDueStatus.UpToDate, schedule.DueStatus);

        // 3. Verify in summary
        var summaryResp = await _client.GetAsync("/api/maintenance");
        Assert.AreEqual(HttpStatusCode.OK, summaryResp.StatusCode);
        var summary = await summaryResp.Content.ReadFromJsonAsync<MaintenanceSummaryDto>();
        Assert.IsNotNull(summary);
        Assert.AreEqual(1, summary.TotalActiveSchedules);
        Assert.AreEqual(1, summary.UpToDateCount);

        // 4. Complete task
        var completeReq = new CompleteMaintenanceTaskRequest(
            Notes: "Cleaned screen with compressed air, tested battery at 58.4V",
            Cost: 12.50m
        );
        var completeResp = await _client.PostAsJsonAsync(
            $"/api/maintenance/schedules/{schedule.Id}/complete",
            completeReq
        );
        Assert.AreEqual(HttpStatusCode.OK, completeResp.StatusCode);
        var completedSchedule =
            await completeResp.Content.ReadFromJsonAsync<MaintenanceScheduleDto>();
        Assert.IsNotNull(completedSchedule);
        Assert.IsNotNull(completedSchedule.LastCompletedAt);

        // 5. Verify logs
        var logsResp = await _client.GetAsync($"/api/maintenance/items/{item.Id}/logs");
        Assert.AreEqual(HttpStatusCode.OK, logsResp.StatusCode);
        var logs = await logsResp.Content.ReadFromJsonAsync<List<MaintenanceLogDto>>();
        Assert.IsNotNull(logs);
        Assert.HasCount(1, logs);
        Assert.AreEqual(schedule.Id, logs[0].ScheduleId);
        Assert.AreEqual("Clean Intake Screen & Check Battery", logs[0].ScheduleTitle);
        Assert.AreEqual("maintuser", logs[0].CompletedByUsername);
        Assert.AreEqual(12.50m, logs[0].Cost);

        // 6. Update schedule
        var updateResp = await _client.PutAsJsonAsync(
            $"/api/maintenance/schedules/{schedule.Id}",
            new UpdateMaintenanceScheduleRequest(
                "Clean Intake Screen & Replace O-Ring",
                IntervalValue: 60,
                IntervalUnit: MaintenanceIntervalUnit.Days,
                IsActive: true
            )
        );
        Assert.AreEqual(HttpStatusCode.OK, updateResp.StatusCode);
        var updated = await updateResp.Content.ReadFromJsonAsync<MaintenanceScheduleDto>();
        Assert.IsNotNull(updated);
        Assert.AreEqual("Clean Intake Screen & Replace O-Ring", updated.Title);

        // 7. Delete schedule
        var deleteResp = await _client.DeleteAsync($"/api/maintenance/schedules/{schedule.Id}");
        Assert.AreEqual(HttpStatusCode.NoContent, deleteResp.StatusCode);
    }

    [TestMethod]
    public async Task InsuranceExport_Preview_And_ZipArchiveGeneration()
    {
        await RegisterAndAuthenticateAsync(_client, "insurance-user@example.com", "insuser");

        // 1. Create Location hierarchy: Living Room -> Media Cabinet
        var rootLocResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Living Room", NodeType: LocationNodeType.FixedLocation)
        );
        var rootLoc = await rootLocResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(rootLoc);

        var childLocResp = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "Media Cabinet",
                NodeType: LocationNodeType.FixedLocation,
                ParentId: rootLoc.Id
            )
        );
        var childLoc = await childLocResp.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(childLoc);

        // 2. Create Item in child location
        var itemResp = await _client.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Sony OLED 65-Inch 4K TV",
                Brand: "Sony",
                ModelNumber: "XR-65A80K",
                SerialNumber: "SN-SONY-OLED-9912",
                PurchasePrice: 1699.99m,
                EstimatedReplacementValue: 1899.99m,
                PurchaseDate: DateTimeOffset.UtcNow.AddYears(-1),
                Retailer: "Best Buy",
                HomeLocationId: childLoc.Id
            )
        );
        var item = await itemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(item);

        // 3. Upload Photo attachment
        var photoBytes = Encoding.UTF8.GetBytes("Fake photo content bytes");
        using (var form = new MultipartFormDataContent())
        {
            var photoContent = new ByteArrayContent(photoBytes);
            photoContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
            form.Add(photoContent, "file", "sony_tv_front.jpg");
            form.Add(new StringContent(((int)AttachmentType.Photo).ToString()), "attachmentType");
            form.Add(new StringContent("true"), "isPrimaryPhoto");

            var photoResp = await _client.PostAsync($"/api/items/{item.Id}/attachments", form);
            Assert.AreEqual(HttpStatusCode.Created, photoResp.StatusCode);
        }

        // 4. Upload Receipt attachment
        var receiptBytes = Encoding.UTF8.GetBytes("Fake receipt content bytes");
        using (var form = new MultipartFormDataContent())
        {
            var receiptContent = new ByteArrayContent(receiptBytes);
            receiptContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
            form.Add(receiptContent, "file", "bestbuy_receipt.pdf");
            form.Add(
                new StringContent(((int)AttachmentType.ReceiptInvoice).ToString()),
                "attachmentType"
            );

            var receiptResp = await _client.PostAsync($"/api/items/{item.Id}/attachments", form);
            Assert.AreEqual(HttpStatusCode.Created, receiptResp.StatusCode);
        }

        // 5. Test GET /api/insurance/preview
        var previewResp = await _client.GetAsync(
            $"/api/insurance/preview?locationId={rootLoc.Id}&includeSubtree=true"
        );
        Assert.AreEqual(HttpStatusCode.OK, previewResp.StatusCode);
        var preview = await previewResp.Content.ReadFromJsonAsync<InsuranceClaimPreviewDto>();
        Assert.IsNotNull(preview);
        Assert.AreEqual(1, preview.TotalItemsCount);
        Assert.AreEqual(1899.99m, preview.TotalReplacementValue);
        Assert.AreEqual(1899.99m, preview.TotalEffectiveClaimValue);
        Assert.AreEqual(1, preview.TotalPhotoCount);
        Assert.AreEqual(1, preview.TotalReceiptAndDocCount);
        StringAssert.Contains(preview.Items[0].LocationFullPath, "Living Room / Media Cabinet");

        // 6. Test MinValue filter
        var previewFilteredResp = await _client.GetAsync(
            $"/api/insurance/preview?locationId={rootLoc.Id}&includeSubtree=true&minValue=2500"
        );
        Assert.AreEqual(HttpStatusCode.OK, previewFilteredResp.StatusCode);
        var filteredPreview =
            await previewFilteredResp.Content.ReadFromJsonAsync<InsuranceClaimPreviewDto>();
        Assert.IsNotNull(filteredPreview);
        Assert.AreEqual(0, filteredPreview.TotalItemsCount);

        // 7. Test GET /api/insurance/export-zip
        var zipResp = await _client.GetAsync(
            $"/api/insurance/export-zip?locationId={rootLoc.Id}&includeSubtree=true&includeAttachments=true"
        );
        Assert.AreEqual(HttpStatusCode.OK, zipResp.StatusCode);
        Assert.AreEqual("application/zip", zipResp.Content.Headers.ContentType?.MediaType);

        var zipBytes = await zipResp.Content.ReadAsByteArrayAsync();
        Assert.IsGreaterThan(0, zipBytes.Length);

        using var zipStream = new MemoryStream(zipBytes);
        using var archive = new ZipArchive(zipStream, ZipArchiveMode.Read);

        // Verify standard manifest files
        var csvEntry = archive.GetEntry("Insurance_Claim_Schedule.csv");
        Assert.IsNotNull(csvEntry, "Insurance_Claim_Schedule.csv should exist in ZIP");

        var pdfEntry = archive.GetEntry("Insurance_Claim_Schedule.pdf");
        Assert.IsNotNull(pdfEntry, "Insurance_Claim_Schedule.pdf should exist in ZIP");

        var jsonEntry = archive.GetEntry("Insurance_Claim_Summary.json");
        Assert.IsNotNull(jsonEntry, "Insurance_Claim_Summary.json should exist in ZIP");

        // Verify PDF starts with %PDF-1.4
        using (var pdfStream = pdfEntry.Open())
        {
            var headerBytes = new byte[8];
            _ = await pdfStream.ReadAsync(headerBytes);
            var headerStr = Encoding.ASCII.GetString(headerBytes);
            StringAssert.StartsWith(headerStr, "%PDF-1.4");
        }

        // Verify CSV contains TV info
        using (var csvStream = csvEntry.Open())
        using (var reader = new StreamReader(csvStream))
        {
            var csvText = await reader.ReadToEndAsync();
            StringAssert.Contains(csvText, "Sony OLED 65-Inch 4K TV");
            StringAssert.Contains(csvText, "SN-SONY-OLED-9912");
            StringAssert.Contains(csvText, "1899.99");
            StringAssert.Contains(csvText, "TOTALS");
        }

        // Verify attached files inside Photos/ and Receipts_And_Documents/
        var photoEntry = archive.Entries.FirstOrDefault(e => e.FullName.StartsWith("Photos/"));
        Assert.IsNotNull(photoEntry, "Photos folder should contain attached photo");

        var receiptEntry = archive.Entries.FirstOrDefault(e =>
            e.FullName.StartsWith("Receipts_And_Documents/")
        );
        Assert.IsNotNull(receiptEntry, "Receipts_And_Documents folder should contain receipt");
    }

    [TestMethod]
    public async Task PrivacyIsolation_MaintenanceAndInsurance_CannotAccessPrivateItems()
    {
        // 1. User A creates private item
        var clientA = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(clientA, "usera-p8@example.com", "usera_p8");

        var privateItemResp = await clientA.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "Secret Diamond Watch",
                IsPrivate: true,
                EstimatedReplacementValue: 5000m
            )
        );
        var privateItem = await privateItemResp.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(privateItem);

        // User A creates maintenance schedule on private item
        var scheduleResp = await clientA.PostAsJsonAsync(
            $"/api/maintenance/items/{privateItem.Id}/schedules",
            new CreateMaintenanceScheduleRequest("Annual Service", IntervalValue: 365)
        );
        var schedule = await scheduleResp.Content.ReadFromJsonAsync<MaintenanceScheduleDto>();
        Assert.IsNotNull(schedule);

        // 2. User B tries to access User A's private item maintenance
        var clientB = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(clientB, "userb-p8@example.com", "userb_p8");

        var bGetSchedules = await clientB.GetAsync(
            $"/api/maintenance/items/{privateItem.Id}/schedules"
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, bGetSchedules.StatusCode);

        var bCreateSchedule = await clientB.PostAsJsonAsync(
            $"/api/maintenance/items/{privateItem.Id}/schedules",
            new CreateMaintenanceScheduleRequest("Hacked Task", IntervalValue: 30)
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, bCreateSchedule.StatusCode);

        var bCompleteTask = await clientB.PostAsJsonAsync(
            $"/api/maintenance/schedules/{schedule.Id}/complete",
            new CompleteMaintenanceTaskRequest()
        );
        Assert.AreEqual(HttpStatusCode.Forbidden, bCompleteTask.StatusCode);

        // Summary for User B omits User A's private schedule
        var bSummaryResp = await clientB.GetAsync("/api/maintenance");
        var bSummary = await bSummaryResp.Content.ReadFromJsonAsync<MaintenanceSummaryDto>();
        Assert.IsNotNull(bSummary);
        Assert.IsFalse(bSummary.Schedules.Any(s => s.Id == schedule.Id));

        // Insurance preview for User B omits User A's private item
        var bInsuranceResp = await clientB.GetAsync("/api/insurance/preview");
        var bInsurance = await bInsuranceResp.Content.ReadFromJsonAsync<InsuranceClaimPreviewDto>();
        Assert.IsNotNull(bInsurance);
        Assert.IsFalse(bInsurance.Items.Any(i => i.Id == privateItem.Id));
    }
}
