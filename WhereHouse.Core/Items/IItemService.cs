namespace WhereHouse.Core.Items;

public interface IItemService
{
    Task<IReadOnlyList<ItemDto>> GetItemsAsync(
        Guid userId,
        Guid? locationId = null,
        bool includeSubtreeLocations = false,
        Guid? categoryId = null,
        ItemType? itemType = null,
        ItemStatus? status = null,
        bool? lowStockOnly = null,
        string? search = null,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> GetItemByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto> CreateItemAsync(
        Guid userId,
        CreateItemRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> UpdateItemAsync(
        Guid userId,
        Guid id,
        UpdateItemRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> AdjustItemQuantityAsync(
        Guid userId,
        Guid id,
        AdjustItemQuantityRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> DuplicateItemAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteItemAsync(Guid userId, Guid id, CancellationToken cancellationToken = default);
}
