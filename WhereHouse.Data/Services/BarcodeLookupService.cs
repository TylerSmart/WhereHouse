using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Intake;
using WhereHouse.Core.Items;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class BarcodeLookupService(WhereHouseDbContext dbContext) : IBarcodeLookupService
{
    private sealed record CuratedProduct(
        string Name,
        string Brand,
        string? ModelNumber,
        string? Description,
        string SuggestedCategoryName,
        ItemType SuggestedItemType,
        string? SuggestedUnit
    );

    private static readonly Dictionary<string, CuratedProduct> CuratedCatalog = new(
        StringComparer.OrdinalIgnoreCase
    )
    {
        ["0885911362757"] = new(
            "20V MAX XR Brushless 3-Speed Hammer Drill",
            "DeWalt",
            "DCD996B",
            "High performance 3-speed all-metal transmission hammer drill bare tool.",
            "Power Tools",
            ItemType.Unique,
            null
        ),
        ["885911362757"] = new(
            "20V MAX XR Brushless 3-Speed Hammer Drill",
            "DeWalt",
            "DCD996B",
            "High performance 3-speed all-metal transmission hammer drill bare tool.",
            "Power Tools",
            ItemType.Unique,
            null
        ),
        ["0045242507979"] = new(
            "M18 FUEL 1/4\" Hex Impact Driver",
            "Milwaukee",
            "2853-20",
            "Compact brushless impact driver delivering up to 2,000 in-lbs of torque.",
            "Power Tools",
            ItemType.Unique,
            null
        ),
        ["045242507979"] = new(
            "M18 FUEL 1/4\" Hex Impact Driver",
            "Milwaukee",
            "2853-20",
            "Compact brushless impact driver delivering up to 2,000 in-lbs of torque.",
            "Power Tools",
            ItemType.Unique,
            null
        ),
        ["0041333415017"] = new(
            "Coppertop AA Alkaline Batteries (20-Pack)",
            "Duracell",
            "MN1500",
            "Long lasting 1.5V alkaline AA bulk pack with POWER BOOST ingredients.",
            "Batteries & Power",
            ItemType.Quantity,
            "pcs"
        ),
        ["041333415017"] = new(
            "Coppertop AA Alkaline Batteries (20-Pack)",
            "Duracell",
            "MN1500",
            "Long lasting 1.5V alkaline AA bulk pack with POWER BOOST ingredients.",
            "Batteries & Power",
            ItemType.Quantity,
            "pcs"
        ),
        ["0039800011329"] = new(
            "MAX AAA Alkaline Batteries (16-Pack)",
            "Energizer",
            "E92",
            "Leak-resistant 1.5V AAA alkaline household battery multipack.",
            "Batteries & Power",
            ItemType.Quantity,
            "pcs"
        ),
        ["039800011329"] = new(
            "MAX AAA Alkaline Batteries (16-Pack)",
            "Energizer",
            "E92",
            "Leak-resistant 1.5V AAA alkaline household battery multipack.",
            "Batteries & Power",
            ItemType.Quantity,
            "pcs"
        ),
        ["0848061059113"] = new(
            "Powerline III USB-C to USB-C Cable 6ft (100W)",
            "Anker",
            "A8753",
            "Durable braided USB 2.0 fast charging cable supporting up to 100W PD.",
            "Cables & Adapters",
            ItemType.Quantity,
            "pcs"
        ),
        ["848061059113"] = new(
            "Powerline III USB-C to USB-C Cable 6ft (100W)",
            "Anker",
            "A8753",
            "Durable braided USB 2.0 fast charging cable supporting up to 100W PD.",
            "Cables & Adapters",
            ItemType.Quantity,
            "pcs"
        ),
        ["0079567101109"] = new(
            "Multi-Use Product Lubricant Spray with Smart Straw 12oz",
            "WD-40",
            "110108",
            "Penetrating oil, water displacer, and rust preventative aerosol spray.",
            "Hardware & Consumables",
            ItemType.Quantity,
            "cans"
        ),
        ["079567101109"] = new(
            "Multi-Use Product Lubricant Spray with Smart Straw 12oz",
            "WD-40",
            "110108",
            "Penetrating oil, water displacer, and rust preventative aerosol spray.",
            "Hardware & Consumables",
            ItemType.Quantity,
            "cans"
        ),
        ["0051131919655"] = new(
            "Command Large Picture Hanging Strips (4 Pairs)",
            "3M",
            "17206",
            "Damage-free wall hanging adhesive mounting strips for framed art.",
            "Hardware & Consumables",
            ItemType.Quantity,
            "pairs"
        ),
        ["051131919655"] = new(
            "Command Large Picture Hanging Strips (4 Pairs)",
            "3M",
            "17206",
            "Damage-free wall hanging adhesive mounting strips for framed art.",
            "Hardware & Consumables",
            ItemType.Quantity,
            "pairs"
        ),
        ["0052427000033"] = new(
            "Super Glue Gel 20g",
            "Gorilla",
            "7700104",
            "No-run cyanoacrylate gel formula for vertical and irregular surfaces.",
            "Hardware & Consumables",
            ItemType.Quantity,
            "bottles"
        ),
        ["052427000033"] = new(
            "Super Glue Gel 20g",
            "Gorilla",
            "7700104",
            "No-run cyanoacrylate gel formula for vertical and irregular surfaces.",
            "Hardware & Consumables",
            ItemType.Quantity,
            "bottles"
        ),
        ["0073149940285"] = new(
            "27-Gallon Tough Storage Tote with Lid (Black/Yellow)",
            "HDX",
            "206127",
            "Heavy-duty stackable polypropylene storage container with snap-fit lid.",
            "Storage & Organization",
            ItemType.Unique,
            null
        ),
        ["073149940285"] = new(
            "27-Gallon Tough Storage Tote with Lid (Black/Yellow)",
            "HDX",
            "206127",
            "Heavy-duty stackable polypropylene storage container with snap-fit lid.",
            "Storage & Organization",
            ItemType.Unique,
            null
        ),
        ["5056561803258"] = new(
            "Raspberry Pi 5 (8GB RAM)",
            "Raspberry Pi",
            "RPI5-8GB",
            "Quad-core Arm Cortex-A76 64-bit single-board computer.",
            "Electronics & Computing",
            ItemType.Unique,
            null
        ),
    };

    public async Task<BarcodeProductLookupDto> LookupBarcodeAsync(
        Guid userId,
        string rawBarcode,
        CancellationToken cancellationToken = default
    )
    {
        var normalized = BarcodeFormatHelper.NormalizeBarcode(rawBarcode);

        // Step 1: Check existing accessible inventory in household
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var existingItem = await dbContext
            .InventoryItems.AsNoTracking()
            .Include(i => i.Category)
            .Where(i => i.BarcodeNumber == normalized)
            .FirstOrDefaultAsync(cancellationToken);

        if (existingItem is not null && IsItemAccessible(existingItem, userId, allLocations))
        {
            return new BarcodeProductLookupDto(
                normalized,
                Found: true,
                Source: "HouseholdCatalog",
                Name: existingItem.Name,
                Brand: existingItem.Brand,
                ModelNumber: existingItem.ModelNumber,
                Description: existingItem.Description,
                SuggestedCategoryName: existingItem.Category?.Name,
                MatchedCategoryId: existingItem.CategoryId,
                SuggestedItemType: existingItem.ItemType,
                SuggestedUnit: existingItem.Unit,
                ExistingItemId: existingItem.Id,
                ExistingItemShortCode: existingItem.ShortCode
            );
        }

        // Step 2: Check curated catalog
        if (CuratedCatalog.TryGetValue(normalized, out var curated))
        {
            var matchedCategory = await dbContext
                .Categories.AsNoTracking()
                .FirstOrDefaultAsync(
                    c => EF.Functions.Like(c.Name, curated.SuggestedCategoryName),
                    cancellationToken
                );

            return new BarcodeProductLookupDto(
                normalized,
                Found: true,
                Source: "CuratedCatalog",
                Name: curated.Name,
                Brand: curated.Brand,
                ModelNumber: curated.ModelNumber,
                Description: curated.Description,
                SuggestedCategoryName: curated.SuggestedCategoryName,
                MatchedCategoryId: matchedCategory?.Id,
                SuggestedItemType: curated.SuggestedItemType,
                SuggestedUnit: curated.SuggestedUnit
            );
        }

        // Step 3: Not found
        return new BarcodeProductLookupDto(normalized, Found: false, Source: "NotFound");
    }

    private static bool IsItemAccessible(
        InventoryItem item,
        Guid userId,
        IReadOnlyDictionary<Guid, LocationNode> allLocations
    )
    {
        if (item.IsPrivate && item.OwnerId != userId)
        {
            return false;
        }

        if (!item.HomeLocationId.HasValue)
        {
            return true;
        }

        var curId = item.HomeLocationId;
        while (curId.HasValue)
        {
            if (!allLocations.TryGetValue(curId.Value, out var loc))
            {
                break;
            }

            if (loc.IsPrivate && loc.OwnerId != userId)
            {
                return false;
            }

            curId = loc.ParentId;
        }

        return true;
    }
}
