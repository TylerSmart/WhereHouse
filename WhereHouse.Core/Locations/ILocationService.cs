namespace WhereHouse.Core.Locations;

public interface ILocationService
{
    Task<IReadOnlyList<LocationTreeNodeDto>> GetLocationTreeAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<LocationNodeDto>> GetLocationNodesAsync(
        Guid userId,
        Guid? parentId = null,
        bool includeAllDepths = false,
        string? search = null,
        CancellationToken cancellationToken = default
    );

    Task<LocationNodeDto?> GetLocationNodeByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );

    Task<LocationNodeDto> CreateLocationNodeAsync(
        Guid userId,
        CreateLocationNodeRequest request,
        CancellationToken cancellationToken = default
    );

    Task<LocationNodeDto?> UpdateLocationNodeAsync(
        Guid userId,
        Guid id,
        UpdateLocationNodeRequest request,
        CancellationToken cancellationToken = default
    );

    Task<LocationNodeDto?> MoveLocationNodeAsync(
        Guid userId,
        Guid id,
        MoveLocationNodeRequest request,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteLocationNodeAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );
}
