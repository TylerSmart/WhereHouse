namespace WhereHouse.Core.Storage;

public interface IFileStorageService
{
    Task<StoredFileResult> SaveFileAsync(
        Stream content,
        string originalFileName,
        CancellationToken cancellationToken = default
    );

    Task<Stream?> OpenReadAsync(
        string storageRelativePath,
        CancellationToken cancellationToken = default
    );

    Task DeleteFileAsync(string storageRelativePath, CancellationToken cancellationToken = default);
}
