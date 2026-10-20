using System;
using System.IO;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.Client.E2ETests.Suites;

#pragma warning disable MSTEST0037

[TestClass]
public class ItemAttachmentsE2ETests : WhereHouseE2ETestBase
{
    [ClassInitialize]
    public static void ClassInit(TestContext context) => BaseClassInit(context);

    [ClassCleanup]
    public static void ClassCleanup() => BaseClassCleanup();

    [TestMethod]
    public async Task Attachments_UploadDocumentAndPhoto_IncrementsBadgeCount()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"att_user_{suffix}",
            $"att_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Workbench_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Impact Driver_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".selected-node-banner");

        // Locate item card
        var itemCard = Page.Locator(".item-card", new() { HasText = item.Name });
        await Expect(itemCard).ToBeVisibleAsync();

        // Click attachment trigger button
        var attachBtn = itemCard.Locator("button.attachment-trigger-btn");
        await attachBtn.ClickAsync();

        var dialog = await WaitForActiveDialogAsync(Page);
        await Expect(dialog.Locator(".dialog-title")).ToContainTextAsync("Attachments Vault");

        // Upload a dummy document file
        var tempFilePath = Path.Combine(Path.GetTempPath(), $"manual_{suffix}.txt");
        await File.WriteAllTextAsync(
            tempFilePath,
            "Sample instruction manual contents for testing."
        );

        try
        {
            var fileInput = dialog.Locator("input[type='file'].hidden-file-input");
            await fileInput.SetInputFilesAsync(tempFilePath);

            // Click Upload Attachment button
            var uploadBtn = dialog.Locator("button", new() { HasText = "Upload Attachment" });
            await uploadBtn.ClickAsync();

            // Verify attachment appears in the list
            var attCard = dialog.Locator(
                ".attachment-card",
                new() { HasText = $"manual_{suffix}.txt" }
            );
            await Expect(attCard).ToBeVisibleAsync();

            // Close dialog
            await dialog
                .Locator("mat-dialog-actions button", new() { HasText = "Close" })
                .ClickAsync();

            // Card badge should now reflect 1 attachment
            var badge = itemCard.Locator(".attachment-count-bubble");
            await Expect(badge).ToContainTextAsync("1");
        }
        finally
        {
            if (File.Exists(tempFilePath))
            {
                File.Delete(tempFilePath);
            }
        }
    }

    [TestMethod]
    public async Task Attachments_DownloadFile_ServesOriginalStream()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(Page, $"dl_user_{suffix}", $"dl_{suffix}@example.com");

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Closet_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(token, $"Vacuum_{suffix}", ItemType.Unique, loc.Id);

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".selected-node-banner");

        var itemCard = Page.Locator(".item-card", new() { HasText = item.Name });
        var attachBtn = itemCard.Locator("button.attachment-trigger-btn");
        await attachBtn.ClickAsync();

        var dialog = await WaitForActiveDialogAsync(Page);

        var tempFilePath = Path.Combine(Path.GetTempPath(), $"spec_{suffix}.txt");
        await File.WriteAllTextAsync(tempFilePath, "Vacuum technical specifications.");

        try
        {
            var fileInput = dialog.Locator("input[type='file'].hidden-file-input");
            await fileInput.SetInputFilesAsync(tempFilePath);

            var uploadBtn = dialog.Locator("button", new() { HasText = "Upload Attachment" });
            await uploadBtn.ClickAsync();

            var attCard = dialog.Locator(
                ".attachment-card",
                new() { HasText = $"spec_{suffix}.txt" }
            );
            await Expect(attCard).ToBeVisibleAsync();

            // Wait for download event or direct API stream response
            var downloadTask = Page.WaitForDownloadAsync();
            var downloadBtn = attCard.Locator("button[aria-label='Download Attachment']");
            await downloadBtn.ClickAsync();

            var download = await downloadTask;
            Assert.IsNotNull(download);
            Assert.AreEqual($"spec_{suffix}.txt", download.SuggestedFilename);
        }
        finally
        {
            if (File.Exists(tempFilePath))
            {
                File.Delete(tempFilePath);
            }
        }
    }

    [TestMethod]
    public async Task Attachments_DeleteAttachment_DecrementsBadgeCount()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"del_user_{suffix}",
            $"del_{suffix}@example.com"
        );

        var loc = await CreateLocationViaApiAsync(
            token,
            $"Garage_{suffix}",
            LocationNodeType.FixedLocation
        );
        var item = await CreateItemViaApiAsync(
            token,
            $"Lawn Mower_{suffix}",
            ItemType.Unique,
            loc.Id
        );

        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={loc.Id}");
        await Page.WaitForSelectorAsync(".selected-node-banner");

        var itemCard = Page.Locator(".item-card", new() { HasText = item.Name });
        var attachBtn = itemCard.Locator("button.attachment-trigger-btn");
        await attachBtn.ClickAsync();

        var dialog = await WaitForActiveDialogAsync(Page);

        var tempFilePath = Path.Combine(Path.GetTempPath(), $"receipt_{suffix}.txt");
        await File.WriteAllTextAsync(tempFilePath, "Receipt for Lawn Mower purchase.");

        try
        {
            var fileInput = dialog.Locator("input[type='file'].hidden-file-input");
            await fileInput.SetInputFilesAsync(tempFilePath);

            var uploadBtn = dialog.Locator("button", new() { HasText = "Upload Attachment" });
            await uploadBtn.ClickAsync();

            var attCard = dialog.Locator(
                ".attachment-card",
                new() { HasText = $"receipt_{suffix}.txt" }
            );
            await Expect(attCard).ToBeVisibleAsync();

            // Delete the attachment
            var deleteBtn = attCard.Locator("button[aria-label='Delete Attachment']");
            await deleteBtn.ClickAsync();

            // Verify attachment removed from modal
            await Expect(
                    dialog.Locator(".attachment-card", new() { HasText = $"receipt_{suffix}.txt" })
                )
                .ToHaveCountAsync(0);

            // Close dialog
            await dialog
                .Locator("mat-dialog-actions button", new() { HasText = "Close" })
                .ClickAsync();

            // Badge count should no longer be present or be 0
            var bubble = itemCard.Locator(".attachment-count-bubble");
            await Expect(bubble).ToHaveCountAsync(0);
        }
        finally
        {
            if (File.Exists(tempFilePath))
            {
                File.Delete(tempFilePath);
            }
        }
    }
}
