namespace WhereHouse.Core.Categories;

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<CategoryDto?> GetCategoryByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );

    Task<CategoryDto> CreateCategoryAsync(
        Guid userId,
        CreateCategoryRequest request,
        CancellationToken cancellationToken = default
    );

    Task<CategoryDto?> UpdateCategoryAsync(
        Guid userId,
        Guid id,
        UpdateCategoryRequest request,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteCategoryAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );
}
