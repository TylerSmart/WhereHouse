using WhereHouse.Core.Items;

namespace WhereHouse.Core.Intake;

public interface IRapidIntakeService
{
    Task<ItemDto> CreateRapidItemAsync(
        Guid userId,
        RapidIntakeItemRequest request,
        CancellationToken cancellationToken = default
    );

    Task<RapidBatchIntakeResponseDto> CreateRapidBatchAsync(
        Guid userId,
        RapidBatchIntakeRequest request,
        CancellationToken cancellationToken = default
    );
}
