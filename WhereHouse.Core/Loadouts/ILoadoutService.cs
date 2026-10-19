namespace WhereHouse.Core.Loadouts;

public interface ILoadoutService
{
    Task<IReadOnlyList<LoadoutDto>> GetLoadoutsAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<LoadoutDto?> GetLoadoutByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );

    Task<LoadoutDto> CreateLoadoutAsync(
        Guid userId,
        CreateLoadoutRequest request,
        CancellationToken cancellationToken = default
    );

    Task<LoadoutDto?> UpdateLoadoutAsync(
        Guid userId,
        Guid id,
        UpdateLoadoutRequest request,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteLoadoutAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );

    Task<LoadoutDto?> CheckoutLoadoutAsync(
        Guid userId,
        Guid id,
        CheckoutLoadoutRequest request,
        CancellationToken cancellationToken = default
    );

    Task<LoadoutDto?> PackBackLoadoutAsync(
        Guid userId,
        Guid id,
        PackBackLoadoutRequest request,
        CancellationToken cancellationToken = default
    );
}
