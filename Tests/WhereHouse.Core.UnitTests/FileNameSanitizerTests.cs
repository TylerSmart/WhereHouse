using WhereHouse.Core.Storage;

namespace WhereHouse.Core.UnitTests;

[TestClass]
public sealed class FileNameSanitizerTests
{
    [TestMethod]
    public void Sanitize_NullOrWhitespace_ReturnsDefaultName()
    {
        Assert.AreEqual("attachment.bin", FileNameSanitizer.Sanitize(null));
        Assert.AreEqual("attachment.bin", FileNameSanitizer.Sanitize(string.Empty));
        Assert.AreEqual("attachment.bin", FileNameSanitizer.Sanitize("   \t  "));
    }

    [TestMethod]
    public void Sanitize_PathTraversal_StripsDirectorySeparators()
    {
        var sanitized = FileNameSanitizer.Sanitize("../../etc/passwd");
        Assert.AreEqual("passwd", sanitized);

        var winSanitized = FileNameSanitizer.Sanitize(@"..\..\windows\system32\cmd.exe");
        Assert.AreEqual("cmd.exe", winSanitized);
    }

    [TestMethod]
    public void Sanitize_ReservedCharacters_ReplacedWithUnderscores()
    {
        var sanitized = FileNameSanitizer.Sanitize("my<cool>:file*name?.pdf");
        Assert.DoesNotContain('<', sanitized);
        Assert.DoesNotContain('>', sanitized);
        Assert.DoesNotContain(':', sanitized);
        Assert.DoesNotContain('*', sanitized);
        Assert.DoesNotContain('?', sanitized);
        Assert.IsTrue(sanitized.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void Sanitize_Whitespace_IsTrimmed()
    {
        var sanitized = FileNameSanitizer.Sanitize("   receipt-2026.pdf   ");
        Assert.AreEqual("receipt-2026.pdf", sanitized);
    }

    [TestMethod]
    public void Sanitize_DotsAndUnderscoresOnly_ReturnsDefaultName()
    {
        Assert.AreEqual("attachment.bin", FileNameSanitizer.Sanitize("..."));
        Assert.AreEqual("attachment.bin", FileNameSanitizer.Sanitize(".."));
        Assert.AreEqual("attachment.bin", FileNameSanitizer.Sanitize("."));
        Assert.AreEqual("attachment.bin", FileNameSanitizer.Sanitize("____"));
    }

    [TestMethod]
    public void Sanitize_LongFileName_TruncatesWhilePreservingExtension()
    {
        var longBase = new string('a', 250);
        var raw = $"{longBase}.jpeg";

        var sanitized = FileNameSanitizer.Sanitize(raw);

        Assert.IsLessThanOrEqualTo(sanitized.Length, 200);
        Assert.IsTrue(sanitized.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase));
    }
}
