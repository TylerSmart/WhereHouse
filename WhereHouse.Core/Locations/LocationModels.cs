using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace WhereHouse.Core.Locations;

public enum LocationNodeType
{
    FixedLocation = 0,
    MovableContainer = 1,
}

public sealed record LocationBreadcrumbDto(
    Guid Id,
    string Name,
    string ShortCode,
    LocationNodeType NodeType
);

public sealed record LocationNodeDto(
    Guid Id,
    Guid? ParentId,
    string Name,
    string? Description,
    LocationNodeType NodeType,
    string ShortCode,
    string? Icon,
    string? ContainerStyle,
    string? PrimaryColor,
    string? AccentColor,
    string? ColorLabel,
    bool IsPrivate,
    Guid OwnerId,
    string FullPath,
    IReadOnlyList<LocationBreadcrumbDto> Breadcrumbs,
    int ChildCount,
    int ItemCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt
);

public sealed record LocationTreeNodeDto(
    Guid Id,
    Guid? ParentId,
    string Name,
    LocationNodeType NodeType,
    string ShortCode,
    string? Icon,
    string? ContainerStyle,
    string? PrimaryColor,
    string? AccentColor,
    string? ColorLabel,
    bool IsPrivate,
    Guid OwnerId,
    string FullPath,
    IReadOnlyList<LocationTreeNodeDto> Children
);

public sealed record CreateLocationNodeRequest(
    [Required, MaxLength(150)] string Name,
    LocationNodeType NodeType = LocationNodeType.FixedLocation,
    Guid? ParentId = null,
    [MaxLength(1000)] string? Description = null,
    [MaxLength(32)] string? ShortCode = null,
    [MaxLength(64)] string? Icon = null,
    [MaxLength(100)] string? ContainerStyle = null,
    [MaxLength(32)] string? PrimaryColor = null,
    [MaxLength(32)] string? AccentColor = null,
    [MaxLength(100)] string? ColorLabel = null,
    bool IsPrivate = false
);

public sealed record UpdateLocationNodeRequest(
    [Required, MaxLength(150)] string Name,
    LocationNodeType NodeType,
    [MaxLength(1000)] string? Description = null,
    [MaxLength(64)] string? Icon = null,
    [MaxLength(100)] string? ContainerStyle = null,
    [MaxLength(32)] string? PrimaryColor = null,
    [MaxLength(32)] string? AccentColor = null,
    [MaxLength(100)] string? ColorLabel = null,
    bool IsPrivate = false
);

public sealed record MoveLocationNodeRequest(Guid? NewParentId);

public static partial class LocationShortCodeGenerator
{
    [GeneratedRegex(@"^([A-Z]+)-(\d+)$", RegexOptions.IgnoreCase)]
    private static partial Regex ShortCodePattern();

    public static string GetPrefix(LocationNodeType nodeType) =>
        nodeType == LocationNodeType.MovableContainer ? "BIN" : "LOC";

    public static string NormalizeShortCode(string rawCode)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rawCode);
        return rawCode.Trim().ToUpperInvariant();
    }

    public static string GenerateNextShortCode(
        LocationNodeType nodeType,
        IEnumerable<string> existingCodes
    )
    {
        var prefix = GetPrefix(nodeType);
        var maxNumber = 0;

        foreach (var code in existingCodes)
        {
            if (string.IsNullOrWhiteSpace(code))
            {
                continue;
            }

            var match = ShortCodePattern().Match(code.Trim());
            if (
                match.Success
                && string.Equals(match.Groups[1].Value, prefix, StringComparison.OrdinalIgnoreCase)
                && int.TryParse(match.Groups[2].Value, out var num)
            )
            {
                if (num > maxNumber)
                {
                    maxNumber = num;
                }
            }
        }

        return $"{prefix}-{(maxNumber + 1):D3}";
    }
}
