using System.Text;
using Microsoft.Extensions.Options;
using WhereHouse.Core.Storage;
using WhereHouse.Infrastructure.Storage;

namespace WhereHouse.Infrastructure.UnitTests;

[TestClass]
public sealed class LocalDiskFileStorageServiceTests : IDisposable
{
    private readonly string _testRoot;
    private readonly LocalDiskFileStorageService _storageService;

    public LocalDiskFileStorageServiceTests()
    {
        _testRoot = Path.Combine(
            Path.GetTempPath(),
            "wherehouse_tests_" + Guid.NewGuid().ToString("N")
        );
        Directory.CreateDirectory(_testRoot);

        var options = Options.Create(new FileStorageOptions { RootPath = _testRoot });
        _storageService = new LocalDiskFileStorageService(options);
    }

    public void Dispose()
    {
        if (Directory.Exists(_testRoot))
        {
            try
            {
                Directory.Delete(_testRoot, true);
            }
            catch
            {
                // Ignore cleanup errors in temporary test directories
            }
        }
    }

    [TestMethod]
    public async Task SaveFileAsync_StoresFile_AndReturnsValidResult()
    {
        var content = "Hello WhereHouse Attachment"u8.ToArray();
        using var stream = new MemoryStream(content);

        var result = await _storageService.SaveFileAsync(stream, "test-document.txt");

        Assert.IsNotNull(result);
        Assert.AreEqual("test-document.txt", result.SanitizedFileName);
        Assert.AreEqual(content.Length, result.FileSizeBytes);
        Assert.Contains("test-document.txt", result.StorageRelativePath);

        // Verify readable
        using var readStream = await _storageService.OpenReadAsync(result.StorageRelativePath);
        Assert.IsNotNull(readStream);
        using var ms = new MemoryStream();
        await readStream.CopyToAsync(ms);
        Assert.AreEqual(Encoding.UTF8.GetString(content), Encoding.UTF8.GetString(ms.ToArray()));
    }

    [TestMethod]
    public async Task DeleteFileAsync_DeletesStoredFile_AndSubsequentReadReturnsNull()
    {
        var content = "To be deleted"u8.ToArray();
        using var stream = new MemoryStream(content);

        var result = await _storageService.SaveFileAsync(stream, "to-delete.txt");
        await _storageService.DeleteFileAsync(result.StorageRelativePath);

        var readStream = await _storageService.OpenReadAsync(result.StorageRelativePath);
        Assert.IsNull(readStream);
    }

    [TestMethod]
    public async Task DeleteFileAsync_NonExistentFile_DoesNotThrow()
    {
        await _storageService.DeleteFileAsync("non_existent/path/file.txt");
    }

    [TestMethod]
    public async Task OpenReadAsync_NonExistentFile_ReturnsNull()
    {
        var stream = await _storageService.OpenReadAsync("does_not_exist.bin");
        Assert.IsNull(stream);
    }

    [TestMethod]
    public async Task SaveFileAsync_PathTraversalInFilename_SanitizesPath()
    {
        var content = "Safe file"u8.ToArray();
        using var stream = new MemoryStream(content);

        var result = await _storageService.SaveFileAsync(stream, "../../../etc/passwd");
        Assert.AreEqual("passwd", result.SanitizedFileName);
        Assert.DoesNotContain("..", result.StorageRelativePath);
    }

    [TestMethod]
    public async Task OpenReadAsync_PathTraversalInStorageRelativePath_ThrowsInvalidOperationException()
    {
        await Assert.ThrowsExactlyAsync<InvalidOperationException>(async () =>
        {
            await _storageService.OpenReadAsync("../../../outside_root.txt");
        });
    }
}
