using WhereHouse.Core.Items;

namespace WhereHouse.Core.Checkouts;

public interface ICheckoutService
{
    Task<ItemDto?> CheckoutItemAsync(
        Guid userId,
        Guid itemId,
        CheckoutItemRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> ReturnItemAsync(
        Guid userId,
        Guid itemId,
        ReturnItemRequest request,
        CancellationToken cancellationToken = default
    );

    Task<BatchCheckoutResultDto> BatchCheckoutItemsAsync(
        Guid userId,
        BatchCheckoutRequest request,
        CancellationToken cancellationToken = default
    );

    Task<BatchCheckoutResultDto> BatchReturnItemsAsync(
        Guid userId,
        BatchReturnRequest request,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<ItemDto>> GetActiveCheckoutsAsync(
        Guid userId,
        bool? externalLoansOnly = null,
        bool? overdueOnly = null,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<CheckoutLogDto>> GetItemCheckoutHistoryAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    );
}
