using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Locations;

namespace WhereHouse.Client.E2ETests.Suites;

#pragma warning disable MSTEST0037

[TestClass]
public class LocationsAndContainersE2ETests : WhereHouseE2ETestBase
{
    [ClassInitialize]
    public static void ClassInit(TestContext context) => BaseClassInit(context);

    [ClassCleanup]
    public static void ClassCleanup() => BaseClassCleanup();

    [TestMethod]
    public async Task Locations_CreateFixedLocation_AppearsInTreeAndGrid()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var locationName = $"Workshop_{suffix}";
        await AuthenticateAsync(Page, $"loc_user_{suffix}", $"loc_{suffix}@example.com");

        // Open Add Fixed Location dialog
        await OpenQuickAddAndSelectAsync(Page, "Fixed Location");
        var dialog = await WaitForActiveDialogAsync(Page);

        await dialog.Locator("input[formControlName='name']").FillAsync(locationName);
        await dialog.Locator("textarea[formControlName='description']").FillAsync("Main tool area");

        // Submit form
        await dialog
            .Locator("mat-dialog-actions button", new() { HasText = "Create" })
            .ClickAsync();

        // Verify location appears in tree sidebar and click it to select
        var treeNode = Page.Locator(".tree-node-item", new() { HasText = locationName });
        await Expect(treeNode).ToBeVisibleAsync();
        await treeNode.ClickAsync();

        // Verify selected banner displays title
        var bannerHeading = Page.Locator(".title-with-shortcode h2");
        await Expect(bannerHeading).ToContainTextAsync(locationName);
    }

    [TestMethod]
    public async Task Locations_CreateMovableContainer_WithStyleAndColorSwatches_DisplaysVisualTags()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var containerName = $"Heavy Duty Bin_{suffix}";
        await AuthenticateAsync(Page, $"bin_user_{suffix}", $"bin_{suffix}@example.com");

        await OpenQuickAddAndSelectAsync(Page, "Movable Container");
        var dialog = await WaitForActiveDialogAsync(Page);

        await dialog.Locator("input[formControlName='name']").FillAsync(containerName);

        // Click style preset
        var styleChip = dialog.Locator(
            ".style-preset-chip",
            new() { HasText = "27-Gal Heavy Duty Tote" }
        );
        if (await styleChip.IsVisibleAsync())
        {
            await styleChip.ClickAsync();
        }

        // Verify swatches have no raw hex strings
        var swatchBtns = dialog.Locator(".color-swatch-btn");
        var count = await swatchBtns.CountAsync();
        Assert.IsTrue(count > 0, "Expected color swatches to be rendered");
        for (var i = 0; i < count; i++)
        {
            var text = await swatchBtns.Nth(i).InnerTextAsync();
            Assert.IsFalse(
                text.Contains('#'),
                $"Swatch should not display raw hex code, got: {text}"
            );
        }

        // Select primary body swatch (first swatch)
        await swatchBtns.First.ClickAsync();

        // Verify native color picker exists
        var nativePicker = dialog.Locator("input[type='color'].color-picker-native");
        await Expect(nativePicker.First).ToBeVisibleAsync();

        // Submit
        await dialog
            .Locator("mat-dialog-actions button", new() { HasText = "Create" })
            .ClickAsync();

        // Verify container appears with container-card styling
        var containerCard = Page.Locator(
            ".node-card.container-card",
            new() { HasText = containerName }
        );
        await Expect(containerCard).ToBeVisibleAsync();
    }

    [TestMethod]
    public async Task Locations_CoverPhoto_UploadThumbnailAndDeletion_WorksEndToEnd()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"photo_user_{suffix}",
            $"photo_{suffix}@example.com"
        );

        // Seed a container and select it
        var container = await CreateLocationViaApiAsync(
            token,
            $"CoverContainer_{suffix}",
            LocationNodeType.MovableContainer
        );
        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={container.Id}");
        await Page.WaitForSelectorAsync(".selected-node-banner");

        // Open Photos dialog
        await Page.Locator(".banner-actions button", new() { HasText = "Photos" }).ClickAsync();
        var photoDialog = await WaitForActiveDialogAsync(Page);

        var tempImg = Path.Combine(Path.GetTempPath(), $"test_cover_{suffix}.png");
        // 1x1 transparent PNG bytes
        await File.WriteAllBytesAsync(
            tempImg,
            new byte[]
            {
                0x89,
                0x50,
                0x4E,
                0x47,
                0x0D,
                0x0A,
                0x1A,
                0x0A,
                0x00,
                0x00,
                0x00,
                0x0D,
                0x49,
                0x48,
                0x44,
                0x52,
                0x00,
                0x00,
                0x00,
                0x01,
                0x00,
                0x00,
                0x00,
                0x01,
                0x08,
                0x06,
                0x00,
                0x00,
                0x00,
                0x1F,
                0x15,
                0xC4,
                0x89,
                0x00,
                0x00,
                0x00,
                0x0A,
                0x49,
                0x44,
                0x41,
                0x54,
                0x78,
                0x9C,
                0x63,
                0x00,
                0x01,
                0x00,
                0x00,
                0x05,
                0x00,
                0x01,
                0x0D,
                0x0A,
                0x2D,
                0xB4,
                0x00,
                0x00,
                0x00,
                0x00,
                0x49,
                0x45,
                0x4E,
                0x44,
                0xAE,
                0x42,
                0x60,
                0x82,
            }
        );

        try
        {
            var fileInput = photoDialog.Locator("input[type='file'].hidden-input");
            await fileInput.SetInputFilesAsync(tempImg);

            // Verify photo preview is displayed in dialog
            var previewImg = photoDialog.Locator(".cover-photo-img");
            await Expect(previewImg).ToBeVisibleAsync();

            // Close dialog
            await photoDialog
                .Locator("mat-dialog-actions button", new() { HasText = "Done" })
                .ClickAsync();

            // Verify cover photo thumbnail appears in banner
            var bannerThumb = Page.Locator(".banner-cover-photo");
            await Expect(bannerThumb).ToBeVisibleAsync();

            // Re-open and delete photo
            await Page.Locator(".banner-actions button", new() { HasText = "Photos" }).ClickAsync();
            photoDialog = await WaitForActiveDialogAsync(Page);

            Page.Dialog += async (_, d) => await d.AcceptAsync();
            await photoDialog.Locator("button", new() { HasText = "Delete Photo" }).ClickAsync();
            await photoDialog
                .Locator("mat-dialog-actions button", new() { HasText = "Done" })
                .ClickAsync();

            // Verify banner thumbnail is gone
            await Expect(bannerThumb).ToHaveCountAsync(0);
        }
        finally
        {
            if (File.Exists(tempImg))
                File.Delete(tempImg);
        }
    }

    [TestMethod]
    public async Task Locations_Reparenting_MoveLocationToNewParent_UpdatesFullPath()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"move_user_{suffix}",
            $"move_{suffix}@example.com"
        );

        var parent = await CreateLocationViaApiAsync(
            token,
            $"Garage_{suffix}",
            LocationNodeType.FixedLocation
        );
        var child = await CreateLocationViaApiAsync(
            token,
            $"Workbench_{suffix}",
            LocationNodeType.FixedLocation
        );

        // Navigate to child
        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={child.Id}");
        await Page.WaitForSelectorAsync(".selected-node-banner");

        // Click Move in banner
        await Page.Locator(".banner-actions button", new() { HasText = "Move" }).ClickAsync();
        var moveDialog = await WaitForActiveDialogAsync(Page);

        // Select new parent from dropdown
        var destSelect = moveDialog.Locator("mat-select");
        await destSelect.ClickAsync(new() { Force = true });
        var parentOption = Page.Locator("mat-option", new() { HasText = parent.Name });
        await parentOption.ClickAsync();

        // Confirm Move
        await moveDialog.Locator("button", new() { HasText = "Move Here" }).ClickAsync();

        // Verify banner path updates to include parent name
        var pathText = Page.Locator(".banner-path");
        await Expect(pathText).ToContainTextAsync(parent.Name);
    }

    [TestMethod]
    public async Task Locations_DeleteLocation_WithConfirmation_RemovesFromTree()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var token = await AuthenticateAsync(
            Page,
            $"del_user_{suffix}",
            $"del_{suffix}@example.com"
        );

        var location = await CreateLocationViaApiAsync(
            token,
            $"ToDelete_{suffix}",
            LocationNodeType.FixedLocation
        );
        await Page.GotoAsync($"{Fixture.RootUri}/?nodeId={location.Id}");
        await Page.WaitForSelectorAsync(".selected-node-banner");

        // Click delete button in banner
        await Page.Locator(".banner-actions button:has(mat-icon:text('delete'))").ClickAsync();
        var confirmDialog = await WaitForActiveDialogAsync(Page);

        // Confirm delete
        await confirmDialog.Locator("button", new() { HasText = "Delete" }).ClickAsync();

        // Verify location node is removed from tree
        var nodeInTree = Page.Locator(".tree-node-item", new() { HasText = location.Name });
        await Expect(nodeInTree).ToHaveCountAsync(0);
    }
}
