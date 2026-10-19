using WhereHouse.Core.Items;

namespace WhereHouse.Core.Lifecycle;

public interface ILifecycleService
{
    Task<ItemDto?> StageItemAsync(
        Guid userId,
        Guid itemId,
        StageItemRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> UnstageItemAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> ArchiveItemAsync(
        Guid userId,
        Guid itemId,
        ArchiveItemRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> RestoreArchivedItemAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> TouchItemAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    );

    Task<BulkLifecycleResultDto> BulkArchiveItemsAsync(
        Guid userId,
        BulkArchiveRequest request,
        CancellationToken cancellationToken = default
    );

    Task<BulkLifecycleResultDto> BulkUnstageItemsAsync(
        Guid userId,
        BulkUnstageRequest request,
        CancellationToken cancellationToken = default
    );

    Task<DeclutterStagingSummaryDto> GetStagedItemsAsync(
        Guid userId,
        ItemStatus? statusFilter = null,
        Guid? locationId = null,
        bool includeSubtreeLocations = true,
        CancellationToken cancellationToken = default
    );

    Task<GraveyardSummaryDto> GetGraveyardItemsAsync(
        Guid userId,
        DispositionReason? dispositionReason = null,
        string? search = null,
        CancellationToken cancellationToken = default
    );

    Task<DustCollectorInsightsDto> GetDustCollectorsAsync(
        Guid userId,
        int minUntouchedDays = 365,
        Guid? locationId = null,
        bool includeSubtreeLocations = true,
        Guid? categoryId = null,
        CancellationToken cancellationToken = default
    );
}
