namespace WhereHouse.Core.Search;

public interface ISearchService
{
    Task<SmartSearchResponseDto> SearchAsync(
        Guid userId,
        SmartSearchQuery searchQuery,
        CancellationToken cancellationToken = default
    );
}
