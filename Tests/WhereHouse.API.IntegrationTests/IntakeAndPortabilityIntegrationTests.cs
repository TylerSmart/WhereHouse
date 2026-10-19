using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Categories;
using WhereHouse.Core.Intake;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.Portability;
using WhereHouse.Core.QrCodes;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class IntakeAndPortabilityIntegrationTests
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
    public async Task BarcodeLookup_CuratedAndHouseholdCatalog_ResolvesCorrectly()
    {
        await RegisterAndAuthenticateAsync(_client, "barcodeuser@example.com", "barcodeuser");

        // 1. Curated Barcode Lookup (DeWalt 20V Hammer Drill)
        var curatedRes = await _client.GetAsync("/api/intake/barcode/0885911362757");
        Assert.AreEqual(HttpStatusCode.OK, curatedRes.StatusCode);
        var curatedDto = await curatedRes.Content.ReadFromJsonAsync<BarcodeProductLookupDto>();
        Assert.IsNotNull(curatedDto);
        Assert.IsTrue(curatedDto.Found);
        Assert.AreEqual("CuratedCatalog", curatedDto.Source);
        Assert.AreEqual("DeWalt", curatedDto.Brand);
        StringAssert.Contains(curatedDto.Name, "Hammer Drill");

        // 2. Create an item with a custom barcode number
        var customBarcode = "998877665544";
        var itemReq = new CreateItemRequest(
            Name: "Custom Metric Socket Set",
            Brand: "Tekton",
            BarcodeNumber: customBarcode
        );
        var createItemRes = await _client.PostAsJsonAsync("/api/items", itemReq);
        Assert.AreEqual(HttpStatusCode.Created, createItemRes.StatusCode);
        var createdItem = await createItemRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(createdItem);
        Assert.AreEqual(customBarcode, createdItem.BarcodeNumber);

        // 3. Lookup that custom barcode via Intake API -> should match HouseholdCatalog!
        var householdRes = await _client.GetAsync($"/api/intake/barcode/{customBarcode}");
        Assert.AreEqual(HttpStatusCode.OK, householdRes.StatusCode);
        var householdDto = await householdRes.Content.ReadFromJsonAsync<BarcodeProductLookupDto>();
        Assert.IsNotNull(householdDto);
        Assert.IsTrue(householdDto.Found);
        Assert.AreEqual("HouseholdCatalog", householdDto.Source);
        Assert.AreEqual("Custom Metric Socket Set", householdDto.Name);
        Assert.AreEqual("Tekton", householdDto.Brand);
        Assert.AreEqual(createdItem.Id, householdDto.ExistingItemId);
    }

    [TestMethod]
    public async Task ScanResolution_ByRetailBarcode_ResolvesItem()
    {
        await RegisterAndAuthenticateAsync(_client, "scanbarcode@example.com", "scanbarcode");

        var testBarcode = "045242507979"; // Milwaukee Impact Driver
        var createReq = new CreateItemRequest(
            Name: "Milwaukee M18 Impact Driver",
            Brand: "Milwaukee",
            BarcodeNumber: testBarcode
        );
        var createRes = await _client.PostAsJsonAsync("/api/items", createReq);
        Assert.AreEqual(HttpStatusCode.Created, createRes.StatusCode);

        // Scan by the BarcodeNumber instead of ShortCode
        var scanRes = await _client.GetAsync($"/api/scan/{testBarcode}");
        Assert.AreEqual(HttpStatusCode.OK, scanRes.StatusCode);
        var scanDto = await scanRes.Content.ReadFromJsonAsync<ScanResolutionDto>();
        Assert.IsNotNull(scanDto);
        Assert.AreEqual(ScanResolutionType.Item, scanDto.ResolutionType);
        Assert.IsNotNull(scanDto.Item);
        Assert.AreEqual("Milwaukee M18 Impact Driver", scanDto.Item.Name);
        Assert.AreEqual(testBarcode, scanDto.Item.BarcodeNumber);
    }

    [TestMethod]
    public async Task RapidIntake_SingleWithQrBind_AndBatch_CreatesItemsSuccessfully()
    {
        await RegisterAndAuthenticateAsync(_client, "rapiduser@example.com", "rapiduser");

        // 1. Create a Location (Movable Container)
        var locReq = new CreateLocationNodeRequest("Tote 05", LocationNodeType.MovableContainer);
        var locRes = await _client.PostAsJsonAsync("/api/locations", locReq);
        Assert.AreEqual(HttpStatusCode.Created, locRes.StatusCode);
        var loc = await locRes.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(loc);

        // 2. Generate a Blank QR token to bind on the fly
        var qrBatchRes = await _client.PostAsJsonAsync(
            "/api/qrcodes/batch",
            new GenerateQrCodeBatchRequest(1, "QR", "Rapid Intake Sticker")
        );
        Assert.AreEqual(HttpStatusCode.Created, qrBatchRes.StatusCode);
        var qrList = await qrBatchRes.Content.ReadFromJsonAsync<List<QrCodeDto>>();
        Assert.IsNotNull(qrList);
        Assert.HasCount(1, qrList);
        var qrToken = qrList[0].Token;

        // 3. Single Rapid Intake with inline QR bind
        var rapidReq = new RapidIntakeItemRequest(
            Name: "Gorilla Heavy Duty Mounting Tape",
            HomeLocationId: loc.Id,
            ItemType: ItemType.Quantity,
            CurrentQuantity: 3,
            Unit: "rolls",
            Brand: "Gorilla",
            BarcodeNumber: "052427000033",
            BindQrToken: qrToken
        );
        var rapidRes = await _client.PostAsJsonAsync("/api/intake/rapid", rapidReq);
        Assert.AreEqual(HttpStatusCode.Created, rapidRes.StatusCode);
        var rapidItem = await rapidRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(rapidItem);
        Assert.AreEqual("Gorilla Heavy Duty Mounting Tape", rapidItem.Name);
        Assert.AreEqual(loc.Id, rapidItem.HomeLocationId);

        // Verify the QR sticker was bound to this item
        var scanQrRes = await _client.GetAsync($"/api/scan/{qrToken}");
        Assert.AreEqual(HttpStatusCode.OK, scanQrRes.StatusCode);
        var scanQrDto = await scanQrRes.Content.ReadFromJsonAsync<ScanResolutionDto>();
        Assert.IsNotNull(scanQrDto);
        Assert.AreEqual(ScanResolutionType.Item, scanQrDto.ResolutionType);
        Assert.AreEqual(rapidItem.Id, scanQrDto.Item?.Id);

        // 4. Batch Rapid Intake
        var batchIntakeReq = new RapidBatchIntakeRequest(
            DefaultHomeLocationId: loc.Id,
            Items:
            [
                new RapidIntakeItemRequest("Wire Strippers", Brand: "Klein"),
                new RapidIntakeItemRequest("Needle Nose Pliers", Brand: "Knipex"),
            ]
        );
        var batchRes = await _client.PostAsJsonAsync("/api/intake/rapid-batch", batchIntakeReq);
        Assert.AreEqual(HttpStatusCode.OK, batchRes.StatusCode);
        var batchDto = await batchRes.Content.ReadFromJsonAsync<RapidBatchIntakeResponseDto>();
        Assert.IsNotNull(batchDto);
        Assert.AreEqual(2, batchDto.CreatedCount);
        Assert.HasCount(2, batchDto.CreatedItems);
        Assert.AreEqual(loc.Id, batchDto.CreatedItems[0].HomeLocationId);
        Assert.AreEqual(loc.Id, batchDto.CreatedItems[1].HomeLocationId);
    }

    [TestMethod]
    public async Task Portability_ExportAndImport_WithDryRunAndColumnMapping()
    {
        await RegisterAndAuthenticateAsync(_client, "porter1@example.com", "porter1");

        // 1. Create category and location
        var catRes = await _client.PostAsJsonAsync(
            "/api/categories",
            new CreateCategoryRequest("Electronics", Description: "Gadgets")
        );
        Assert.AreEqual(HttpStatusCode.Created, catRes.StatusCode);

        var locRes = await _client.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest("Garage Shelf A", LocationNodeType.FixedLocation)
        );
        Assert.AreEqual(HttpStatusCode.Created, locRes.StatusCode);
        var loc = await locRes.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(loc);

        // 2. Export JSON Bundle
        var exportJsonRes = await _client.GetAsync("/api/portability/export/json");
        Assert.AreEqual(HttpStatusCode.OK, exportJsonRes.StatusCode);
        var bundle = await exportJsonRes.Content.ReadFromJsonAsync<WhereHouseExportBundleDto>();
        Assert.IsNotNull(bundle);
        Assert.IsTrue(bundle.Locations.Any(l => l.ShortCode == loc.ShortCode));

        // 3. Export CSV for Locations
        var exportCsvRes = await _client.GetAsync(
            "/api/portability/export/csv?entityType=Locations"
        );
        Assert.AreEqual(HttpStatusCode.OK, exportCsvRes.StatusCode);
        var csv = await exportCsvRes.Content.ReadAsStringAsync();
        StringAssert.Contains(csv, "ShortCode,Name,ParentShortCode");
        StringAssert.Contains(csv, loc.ShortCode);

        // 4. Test CSV Import with DryRun = true and Column Mapping
        var csvToImport =
            "CustomTitle,CustomBin,CustomBrand\r\nSoldering Iron Station,"
            + loc.ShortCode
            + ",Weller\r\n";
        var colMapping = new Dictionary<string, string>
        {
            ["Name"] = "CustomTitle",
            ["HomeLocationShortCode"] = "CustomBin",
            ["Brand"] = "CustomBrand",
        };

        var dryRunReq = new CsvImportRequest(
            PortabilityEntityType.Items,
            csvToImport,
            DryRun: true,
            UpdateExisting: true,
            ColumnMapping: colMapping
        );
        var dryRunRes = await _client.PostAsJsonAsync("/api/portability/import/csv", dryRunReq);
        Assert.AreEqual(HttpStatusCode.OK, dryRunRes.StatusCode);
        var dryRunResult = await dryRunRes.Content.ReadFromJsonAsync<ImportResultDto>();
        Assert.IsNotNull(dryRunResult);
        Assert.IsTrue(dryRunResult.DryRun);
        Assert.AreEqual(1, dryRunResult.CreatedCount);
        Assert.AreEqual(0, dryRunResult.ErrorCount);

        // Ensure database was NOT modified in dry run
        var checkItemsRes = await _client.GetAsync("/api/items?search=Soldering");
        var itemsBefore = await checkItemsRes.Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.IsNotNull(itemsBefore);
        Assert.IsEmpty(itemsBefore);

        // 5. Test CSV Import Commit (DryRun = false)
        var commitReq = dryRunReq with
        {
            DryRun = false,
        };
        var commitRes = await _client.PostAsJsonAsync("/api/portability/import/csv", commitReq);
        Assert.AreEqual(HttpStatusCode.OK, commitRes.StatusCode);
        var commitResult = await commitRes.Content.ReadFromJsonAsync<ImportResultDto>();
        Assert.IsNotNull(commitResult);
        Assert.IsFalse(commitResult.DryRun);
        Assert.AreEqual(1, commitResult.CreatedCount);

        // Verify the item was created and housed in the target bin
        var checkItemsAfter = await _client.GetAsync("/api/items?search=Soldering");
        var itemsAfter = await checkItemsAfter.Content.ReadFromJsonAsync<List<ItemDto>>();
        Assert.IsNotNull(itemsAfter);
        Assert.HasCount(1, itemsAfter);
        Assert.AreEqual("Soldering Iron Station", itemsAfter[0].Name);
        Assert.AreEqual("Weller", itemsAfter[0].Brand);
        Assert.AreEqual(loc.Id, itemsAfter[0].HomeLocationId);
    }

    [TestMethod]
    public async Task Portability_SecretGiftMode_NeverLeaksOrOverwritesOtherUsersPrivateData()
    {
        // User A setup
        using var clientA = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(clientA, "usera_priv@example.com", "usera_priv");

        var secretLocRes = await clientA.PostAsJsonAsync(
            "/api/locations",
            new CreateLocationNodeRequest(
                "User A Secret Vault",
                LocationNodeType.MovableContainer,
                IsPrivate: true
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, secretLocRes.StatusCode);
        var secretLoc = await secretLocRes.Content.ReadFromJsonAsync<LocationNodeDto>();
        Assert.IsNotNull(secretLoc);

        var secretItemRes = await clientA.PostAsJsonAsync(
            "/api/items",
            new CreateItemRequest(
                "User A Hidden Diamond Ring",
                HomeLocationId: secretLoc.Id,
                IsPrivate: true
            )
        );
        Assert.AreEqual(HttpStatusCode.Created, secretItemRes.StatusCode);
        var secretItem = await secretItemRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(secretItem);

        // User B setup
        using var clientB = _factory.CreateClient();
        await RegisterAndAuthenticateAsync(clientB, "userb_snoop@example.com", "userb_snoop");

        // 1. User B JSON Export -> MUST NOT contain User A's secret location or secret item
        var exportJsonB = await clientB.GetAsync("/api/portability/export/json");
        Assert.AreEqual(HttpStatusCode.OK, exportJsonB.StatusCode);
        var bundleB = await exportJsonB.Content.ReadFromJsonAsync<WhereHouseExportBundleDto>();
        Assert.IsNotNull(bundleB);
        Assert.IsFalse(bundleB.Locations.Any(l => l.ShortCode == secretLoc.ShortCode));
        Assert.IsFalse(bundleB.Items.Any(i => i.ShortCode == secretItem.ShortCode));

        // 2. User B CSV Export -> MUST NOT contain User A's secret short codes
        var exportCsvItemsB = await clientB.GetAsync(
            "/api/portability/export/csv?entityType=Items"
        );
        Assert.AreEqual(HttpStatusCode.OK, exportCsvItemsB.StatusCode);
        var csvB = await exportCsvItemsB.Content.ReadAsStringAsync();
        Assert.DoesNotContain(secretItem.ShortCode, csvB);
        Assert.DoesNotContain("User A Hidden Diamond Ring", csvB);

        // 3. User B tries to overwrite User A's private item using CSV import matching User A's ShortCode
        var maliciousCsv =
            $"ShortCode,Name,Brand\r\n{secretItem.ShortCode},Overwritten Name,MaliciousBrand\r\n";
        var importMaliciousReq = new CsvImportRequest(
            PortabilityEntityType.Items,
            maliciousCsv,
            DryRun: false,
            UpdateExisting: true
        );
        var maliciousRes = await clientB.PostAsJsonAsync(
            "/api/portability/import/csv",
            importMaliciousReq
        );
        Assert.AreEqual(HttpStatusCode.OK, maliciousRes.StatusCode);
        var maliciousResult = await maliciousRes.Content.ReadFromJsonAsync<ImportResultDto>();
        Assert.IsNotNull(maliciousResult);
        Assert.IsGreaterThan(0, maliciousResult.ErrorCount);
        Assert.IsTrue(maliciousResult.Rows.Any(r => r.Action == ImportRowAction.Error));

        // Verify User A's item remains intact and untouched
        var itemCheckRes = await clientA.GetAsync($"/api/items/{secretItem.Id}");
        Assert.AreEqual(HttpStatusCode.OK, itemCheckRes.StatusCode);
        var safeItem = await itemCheckRes.Content.ReadFromJsonAsync<ItemDto>();
        Assert.IsNotNull(safeItem);
        Assert.AreEqual("User A Hidden Diamond Ring", safeItem.Name);
    }
}
