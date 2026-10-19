using Microsoft.Extensions.Options;
using WhereHouse.Core.Storage;

namespace WhereHouse.Infrastructure.Storage;

public sealed class LocalDiskFileStorageService : IFileStorageService
{
    private readonly string _rootPath;

    public LocalDiskFileStorageService(IOptions<FileStorageOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var configured = options.Value.RootPath;
        _rootPath = Path.GetFullPath(
            string.IsNullOrWhiteSpace(configured) ? "App_Data/uploads" : configured
        );
    }

    public async Task<StoredFileResult> SaveFileAsync(
        Stream content,
        string originalFileName,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(content);

        var sanitized = FileNameSanitizer.Sanitize(originalFileName);
        var partition = DateTime.UtcNow.ToString("yyyy/MM");
        var relativePath = $"{partition}/{Guid.NewGuid():N}_{sanitized}";
        var fullPath = GetSafeFullPath(relativePath);

        var directory = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        await using (
            var fileStream = new FileStream(
                fullPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None
            )
        )
        {
            await content.CopyToAsync(fileStream, cancellationToken);
        }

        var fileInfo = new FileInfo(fullPath);
        return new StoredFileResult(relativePath, sanitized, fileInfo.Length);
    }

    public Task<Stream?> OpenReadAsync(
        string storageRelativePath,
        CancellationToken cancellationToken = default
    )
    {
        var fullPath = GetSafeFullPath(storageRelativePath);
        if (!File.Exists(fullPath))
        {
            return Task.FromResult<Stream?>(null);
        }

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult<Stream?>(stream);
    }

    public Task DeleteFileAsync(
        string storageRelativePath,
        CancellationToken cancellationToken = default
    )
    {
        var fullPath = GetSafeFullPath(storageRelativePath);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }

        return Task.CompletedTask;
    }

    private string GetSafeFullPath(string storageRelativePath)
    {
        if (string.IsNullOrWhiteSpace(storageRelativePath))
        {
            throw new ArgumentException(
                "Storage relative path cannot be empty.",
                nameof(storageRelativePath)
            );
        }

        var normalizedRelative = storageRelativePath.Replace('\\', '/').TrimStart('/');
        var combined = Path.GetFullPath(Path.Combine(_rootPath, normalizedRelative));

        if (!combined.StartsWith(_rootPath, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Path traversal attempt detected.");
        }

        return combined;
    }
}
