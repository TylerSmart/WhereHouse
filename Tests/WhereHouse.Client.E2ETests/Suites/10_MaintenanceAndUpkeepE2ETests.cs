using System.Net.Http.Json;
using Microsoft.Playwright;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.Maintenance;

namespace WhereHouse.Client.E2ETests.Suites;

[TestClass]
public class MaintenanceAndUpkeepE2ETests : WhereHouseE2ETestBase
{
    [TestMethod]
    public async Task Maintenance_CreateSchedule_WithQuickPresets_AppearsInList()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"maint_user_{suffix}",
            $"maint_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Basement_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Dehumidifier_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Maintenance & Upkeep");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Open Add New Maintenance Schedule form
        var addBtn = dialog.Locator("button.add-header-btn");
        await addBtn.ClickAsync();

        // Select item from target inventory dropdown
        var itemSelect = dialog.Locator(".form-grid mat-select").First;
        await itemSelect.ClickAsync();
        var itemOpt = Page.Locator("mat-option", new() { HasText = item.Name });
        await itemOpt.ClickAsync();

        // Click quick preset "Replace Filter (6mo)"
        var presetChip = dialog.Locator(".preset-chip", new() { HasText = "Replace Filter (6mo)" });
        await presetChip.ClickAsync();

        // Verify title prefilled
        var titleInput = dialog.Locator("input[placeholder*='Inspect Air Filter']");
        await Expect(titleInput).ToHaveValueAsync("Replace Filter");

        // Click Save Schedule
        var saveBtn = dialog.Locator("button", new() { HasText = "Save Schedule" });
        await saveBtn.ClickAsync();

        // Assert schedule appears in list
        var scheduleCard = dialog.Locator(".schedule-card", new() { HasText = "Replace Filter" });
        await Expect(scheduleCard).ToBeVisibleAsync();

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Maintenance_DueOnlyFilter_FiltersTasksByDueDate()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"filter_user_{suffix}",
            $"filter_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Garage_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Lawn Tractor_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        using var client = CreateAuthenticatedApiClient(token);

        // Seed Overdue schedule
        var overdueReq = new CreateMaintenanceScheduleRequest(
            Title: $"Overdue Oil Change_{suffix}",
            IntervalValue: 30,
            IntervalUnit: MaintenanceIntervalUnit.Days,
            FirstDueAt: DateTimeOffset.UtcNow.AddDays(-10)
        );
        var resp1 = await client.PostAsJsonAsync(
            $"/api/maintenance/items/{item.Id}/schedules",
            overdueReq
        );
        resp1.EnsureSuccessStatusCode();

        // Seed Future schedule
        var futureReq = new CreateMaintenanceScheduleRequest(
            Title: $"Future Blade Sharpening_{suffix}",
            IntervalValue: 90,
            IntervalUnit: MaintenanceIntervalUnit.Days,
            FirstDueAt: DateTimeOffset.UtcNow.AddDays(45)
        );
        var resp2 = await client.PostAsJsonAsync(
            $"/api/maintenance/items/{item.Id}/schedules",
            futureReq
        );
        resp2.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Maintenance & Upkeep");
        var dialog = await WaitForActiveDialogAsync(Page);

        // Both initially present
        var overdueCard = dialog.Locator(
            ".schedule-card",
            new() { HasText = $"Overdue Oil Change_{suffix}" }
        );
        var futureCard = dialog.Locator(
            ".schedule-card",
            new() { HasText = $"Future Blade Sharpening_{suffix}" }
        );
        await Expect(overdueCard).ToBeVisibleAsync();
        await Expect(futureCard).ToBeVisibleAsync();

        // Toggle Due & Overdue Only chip
        var filterChip = dialog.Locator(
            "mat-chip-option",
            new() { HasText = "Due & Overdue Only" }
        );
        await filterChip.ClickAsync();

        // Assert overdue remains, future is hidden
        await Expect(overdueCard).ToBeVisibleAsync();
        await Expect(futureCard).ToBeHiddenAsync();

        await CloseActiveDialogAsync(Page);
    }

    [TestMethod]
    public async Task Maintenance_CompleteTask_LogsHistoryAndRollsDueDate()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"complete_user_{suffix}",
            $"comp_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Hallway_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Smoke Detector_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        using var client = CreateAuthenticatedApiClient(token);

        // Seed due schedule
        var req = new CreateMaintenanceScheduleRequest(
            Title: $"Battery Check_{suffix}",
            IntervalValue: 90,
            IntervalUnit: MaintenanceIntervalUnit.Days,
            FirstDueAt: DateTimeOffset.UtcNow.AddDays(-2)
        );
        var resp = await client.PostAsJsonAsync($"/api/maintenance/items/{item.Id}/schedules", req);
        resp.EnsureSuccessStatusCode();

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".top-bar");

        await OpenToolsMenuAndSelectAsync(Page, "Maintenance & Upkeep");
        var dialog = await WaitForActiveDialogAsync(Page);

        var card = dialog.Locator(".schedule-card", new() { HasText = $"Battery Check_{suffix}" });
        await Expect(card).ToBeVisibleAsync();

        // Click Complete button on card
        var completeBtn = card.Locator("button", new() { HasText = "Complete" });
        await completeBtn.ClickAsync();

        // Fill completion notes
        var notesInput = card.Locator(".complete-notes input");
        await notesInput.FillAsync("Replaced 9V lithium battery and tested 85dB alarm");

        // Click Confirm Done
        var confirmBtn = card.Locator("button", new() { HasText = "Confirm Done" });
        await confirmBtn.ClickAsync();

        // Wait for card to update to Up to Date
        var duePill = card.Locator(".due-pill");
        await Expect(duePill).ToContainTextAsync("Up to Date");

        // Switch to Completion History tab
        var historyTabBtn = dialog.Locator(
            "button.tab-btn",
            new() { HasText = "Completion History" }
        );
        await historyTabBtn.ClickAsync();

        // Verify history record with completion note
        var historyEntry = dialog.Locator(
            ".log-card, .history-card, p",
            new() { HasText = "Replaced 9V lithium battery" }
        );
        await Expect(historyEntry.First).ToBeVisibleAsync();

        await CloseActiveDialogAsync(Page);
    }
}
