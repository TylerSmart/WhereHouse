using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Categories;
using WhereHouse.Core.Exceptions;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class CategoryService(WhereHouseDbContext dbContext) : ICategoryService
{
    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    )
    {
        var categories = await dbContext
            .Categories.AsNoTracking()
            .Include(c => c.AttributeTemplates)
            .OrderBy(c => c.Name)
            .ToListAsync(cancellationToken);

        var allItems = await dbContext
            .InventoryItems.AsNoTracking()
            .Select(i => new
            {
                i.Id,
                i.CategoryId,
                i.HomeLocationId,
                i.IsPrivate,
                i.OwnerId,
            })
            .ToListAsync(cancellationToken);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .Select(l => new
            {
                l.Id,
                l.ParentId,
                l.IsPrivate,
                l.OwnerId,
            })
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        bool IsItemAccessible(Guid? homeLocationId, bool isPrivate, Guid ownerId)
        {
            if (isPrivate && ownerId != userId)
            {
                return false;
            }

            var currentLocId = homeLocationId;
            while (currentLocId.HasValue)
            {
                if (!allLocations.TryGetValue(currentLocId.Value, out var loc))
                {
                    break;
                }

                if (loc.IsPrivate && loc.OwnerId != userId)
                {
                    return false;
                }

                currentLocId = loc.ParentId;
            }

            return true;
        }

        var itemCounts = allItems
            .Where(i =>
                i.CategoryId.HasValue && IsItemAccessible(i.HomeLocationId, i.IsPrivate, i.OwnerId)
            )
            .GroupBy(i => i.CategoryId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        return categories.Select(c => MapToDto(c, itemCounts.GetValueOrDefault(c.Id, 0))).ToList();
    }

    public async Task<CategoryDto?> GetCategoryByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        var category = await dbContext
            .Categories.AsNoTracking()
            .Include(c => c.AttributeTemplates)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (category is null)
        {
            return null;
        }

        var allItems = await dbContext
            .InventoryItems.AsNoTracking()
            .Where(i => i.CategoryId == id)
            .Select(i => new
            {
                i.Id,
                i.HomeLocationId,
                i.IsPrivate,
                i.OwnerId,
            })
            .ToListAsync(cancellationToken);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .Select(l => new
            {
                l.Id,
                l.ParentId,
                l.IsPrivate,
                l.OwnerId,
            })
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var accessibleCount = allItems.Count(i =>
        {
            if (i.IsPrivate && i.OwnerId != userId)
            {
                return false;
            }

            var currentLocId = i.HomeLocationId;
            while (currentLocId.HasValue)
            {
                if (!allLocations.TryGetValue(currentLocId.Value, out var loc))
                {
                    break;
                }

                if (loc.IsPrivate && loc.OwnerId != userId)
                {
                    return false;
                }

                currentLocId = loc.ParentId;
            }

            return true;
        });

        return MapToDto(category, accessibleCount);
    }

    public async Task<CategoryDto> CreateCategoryAsync(
        Guid userId,
        CreateCategoryRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var nameTrimmed = request.Name.Trim();
        var exists = await dbContext.Categories.AnyAsync(
            c => c.Name.ToLower() == nameTrimmed.ToLower(),
            cancellationToken
        );
        if (exists)
        {
            throw new ConflictException(
                "A category with this name already exists.",
                "Duplicate category name"
            );
        }

        if (request.ParentId.HasValue)
        {
            var parentExists = await dbContext.Categories.AnyAsync(
                c => c.Id == request.ParentId.Value,
                cancellationToken
            );
            if (!parentExists)
            {
                throw new NotFoundException("Parent category not found.");
            }
        }

        var category = new Category
        {
            Id = Guid.NewGuid(),
            ParentId = request.ParentId,
            Name = nameTrimmed,
            Description = string.IsNullOrWhiteSpace(request.Description)
                ? null
                : request.Description.Trim(),
            Icon = string.IsNullOrWhiteSpace(request.Icon) ? "category" : request.Icon.Trim(),
            Color = string.IsNullOrWhiteSpace(request.Color) ? null : request.Color.Trim(),
        };

        if (request.AttributeTemplates is { Count: > 0 })
        {
            var sort = 0;
            foreach (var tmpl in request.AttributeTemplates)
            {
                category.AttributeTemplates.Add(
                    new CategoryAttributeTemplate
                    {
                        Id = Guid.NewGuid(),
                        CategoryId = category.Id,
                        Name = tmpl.Name.Trim(),
                        FieldType = tmpl.FieldType,
                        Unit = string.IsNullOrWhiteSpace(tmpl.Unit) ? null : tmpl.Unit.Trim(),
                        OptionsJson = tmpl.Options is { Count: > 0 }
                            ? JsonSerializer.Serialize(tmpl.Options)
                            : null,
                        IsRequired = tmpl.IsRequired,
                        SortOrder = tmpl.SortOrder != 0 ? tmpl.SortOrder : ++sort,
                    }
                );
            }
        }

        dbContext.Categories.Add(category);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(category, 0);
    }

    public async Task<CategoryDto?> UpdateCategoryAsync(
        Guid userId,
        Guid id,
        UpdateCategoryRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var category = await dbContext
            .Categories.Include(c => c.AttributeTemplates)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (category is null)
        {
            return null;
        }

        var nameTrimmed = request.Name.Trim();
        var nameCollision = await dbContext.Categories.AnyAsync(
            c => c.Id != id && c.Name.ToLower() == nameTrimmed.ToLower(),
            cancellationToken
        );
        if (nameCollision)
        {
            throw new ConflictException(
                "A category with this name already exists.",
                "Duplicate category name"
            );
        }

        if (request.ParentId.HasValue)
        {
            if (request.ParentId.Value == id)
            {
                throw new ConflictException(
                    "A category cannot be its own parent.",
                    "Invalid parent category"
                );
            }

            var allCategories = await dbContext
                .Categories.AsNoTracking()
                .ToDictionaryAsync(c => c.Id, cancellationToken);

            if (!allCategories.ContainsKey(request.ParentId.Value))
            {
                throw new NotFoundException("Parent category not found.");
            }

            var current = allCategories[request.ParentId.Value];
            while (current.ParentId.HasValue)
            {
                if (current.ParentId.Value == id)
                {
                    throw new ConflictException(
                        "A category cannot be moved into one of its own subcategories.",
                        "Circular category hierarchy"
                    );
                }

                if (!allCategories.TryGetValue(current.ParentId.Value, out var ancestor))
                {
                    break;
                }
                current = ancestor;
            }
        }

        category.Name = nameTrimmed;
        category.ParentId = request.ParentId;
        category.Description = string.IsNullOrWhiteSpace(request.Description)
            ? null
            : request.Description.Trim();
        category.Icon = string.IsNullOrWhiteSpace(request.Icon) ? "category" : request.Icon.Trim();
        category.Color = string.IsNullOrWhiteSpace(request.Color) ? null : request.Color.Trim();

        // Sync attribute templates
        dbContext.CategoryAttributeTemplates.RemoveRange(category.AttributeTemplates);
        category.AttributeTemplates.Clear();

        if (request.AttributeTemplates is { Count: > 0 })
        {
            var sort = 0;
            foreach (var tmpl in request.AttributeTemplates)
            {
                category.AttributeTemplates.Add(
                    new CategoryAttributeTemplate
                    {
                        Id = tmpl.Id ?? Guid.NewGuid(),
                        CategoryId = category.Id,
                        Name = tmpl.Name.Trim(),
                        FieldType = tmpl.FieldType,
                        Unit = string.IsNullOrWhiteSpace(tmpl.Unit) ? null : tmpl.Unit.Trim(),
                        OptionsJson = tmpl.Options is { Count: > 0 }
                            ? JsonSerializer.Serialize(tmpl.Options)
                            : null,
                        IsRequired = tmpl.IsRequired,
                        SortOrder = tmpl.SortOrder != 0 ? tmpl.SortOrder : ++sort,
                    }
                );
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var itemCount = await dbContext.InventoryItems.CountAsync(
            i => i.CategoryId == id,
            cancellationToken
        );
        return MapToDto(category, itemCount);
    }

    public async Task<bool> DeleteCategoryAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        var category = await dbContext
            .Categories.Include(c => c.AttributeTemplates)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (category is null)
        {
            return false;
        }

        var hasSubcategories = await dbContext.Categories.AnyAsync(
            c => c.ParentId == id,
            cancellationToken
        );
        if (hasSubcategories)
        {
            throw new ConflictException(
                "Cannot delete a category that still contains subcategories.",
                "Category has subcategories"
            );
        }

        var hasItems = await dbContext.InventoryItems.AnyAsync(
            i => i.CategoryId == id,
            cancellationToken
        );
        if (hasItems)
        {
            throw new ConflictException(
                "Cannot delete a category that is still assigned to items.",
                "Category in use"
            );
        }

        dbContext.Categories.Remove(category);
        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static CategoryDto MapToDto(Category c, int itemCount)
    {
        var templates = c
            .AttributeTemplates.OrderBy(t => t.SortOrder)
            .Select(t =>
            {
                var options = !string.IsNullOrWhiteSpace(t.OptionsJson)
                    ? JsonSerializer.Deserialize<List<string>>(t.OptionsJson) ?? []
                    : [];

                return new CategoryAttributeTemplateDto(
                    t.Id,
                    t.CategoryId,
                    t.Name,
                    t.FieldType,
                    t.Unit,
                    options,
                    t.IsRequired,
                    t.SortOrder
                );
            })
            .ToList();

        return new CategoryDto(
            c.Id,
            c.ParentId,
            c.Name,
            c.Description,
            c.Icon,
            c.Color,
            templates,
            itemCount,
            c.CreatedAt,
            c.ModifiedAt
        );
    }
}
