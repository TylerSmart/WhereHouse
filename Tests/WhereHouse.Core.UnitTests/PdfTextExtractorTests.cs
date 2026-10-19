using System.IO.Compression;
using System.Text;
using WhereHouse.Core.Attachments;

namespace WhereHouse.Core.UnitTests;

[TestClass]
public sealed class PdfTextExtractorTests
{
    [TestMethod]
    public void ExtractText_EmptyOrNull_ReturnsNull()
    {
        Assert.IsNull(PdfTextExtractor.ExtractText(null, "application/pdf", "manual.pdf"));
        Assert.IsNull(
            PdfTextExtractor.ExtractText(Array.Empty<byte>(), "application/pdf", "manual.pdf")
        );
    }

    [TestMethod]
    public void ExtractText_NonPdfOrText_ReturnsNull()
    {
        var bytes = Encoding.UTF8.GetBytes("Some random bytes for an image");
        Assert.IsNull(PdfTextExtractor.ExtractText(bytes, "image/jpeg", "photo.jpg"));
        Assert.IsNull(PdfTextExtractor.ExtractText(bytes, "application/octet-stream", "data.bin"));
    }

    [TestMethod]
    public void ExtractText_PlainTextFile_ReturnsTrimmedText()
    {
        var content = "This is a user manual readme with essential instructions.";
        var bytes = Encoding.UTF8.GetBytes(content);

        var result = PdfTextExtractor.ExtractText(bytes, "text/plain", "readme.txt");

        Assert.IsNotNull(result);
        Assert.AreEqual(content, result);
    }

    [TestMethod]
    public void ExtractText_PlainPdfWithLiteralStrings_ExtractsText()
    {
        var rawPdf = """
            %PDF-1.4
            1 0 obj
            << /Type /Page >>
            stream
            BT
            /F1 12 Tf
            100 700 Td
            (Makita 18V Cordless Drill Manual) Tj
            ET
            endstream
            endobj
            %%EOF
            """;

        var bytes = Encoding.UTF8.GetBytes(rawPdf);
        var result = PdfTextExtractor.ExtractText(bytes, "application/pdf", "makita.pdf");

        Assert.IsNotNull(result);
        Assert.Contains("Makita 18V Cordless Drill Manual", result);
    }

    [TestMethod]
    public void ExtractText_PdfWithHexStrings_ExtractsDecodedAscii()
    {
        // <446557616C74> is "DeWalt" in hex
        var rawPdf = """
            %PDF-1.4
            1 0 obj
            stream
            BT
            <446557616C74> Tj
            ET
            endstream
            endobj
            %%EOF
            """;

        var bytes = Encoding.UTF8.GetBytes(rawPdf);
        var result = PdfTextExtractor.ExtractText(bytes, "application/pdf", "dewalt.pdf");

        Assert.IsNotNull(result);
        Assert.Contains("DeWalt", result);
    }

    [TestMethod]
    public void ExtractText_PdfWithFlateDecodeStream_DecompressesAndExtracts()
    {
        var textInsideStream = "BT /F1 12 Tf (Bosch Professional 12V Battery Pack) Tj ET";
        var uncompressedBytes = Encoding.UTF8.GetBytes(textInsideStream);

        byte[] compressed;
        using (var ms = new MemoryStream())
        {
            // Write standard zlib header (0x78, 0x9C)
            ms.WriteByte(0x78);
            ms.WriteByte(0x9C);
            using (var deflate = new DeflateStream(ms, CompressionMode.Compress, leaveOpen: true))
            {
                deflate.Write(uncompressedBytes, 0, uncompressedBytes.Length);
            }
            compressed = ms.ToArray();
        }

        var header = Encoding.ASCII.GetBytes(
            "%PDF-1.4\n1 0 obj\n<< /Length "
                + compressed.Length
                + " /Filter /FlateDecode >>\nstream\r\n"
        );
        var footer = Encoding.ASCII.GetBytes("\r\nendstream\nendobj\n%%EOF");

        using var fullPdf = new MemoryStream();
        fullPdf.Write(header, 0, header.Length);
        fullPdf.Write(compressed, 0, compressed.Length);
        fullPdf.Write(footer, 0, footer.Length);

        var result = PdfTextExtractor.ExtractText(
            fullPdf.ToArray(),
            "application/pdf",
            "bosch.pdf"
        );

        Assert.IsNotNull(result);
        Assert.Contains("Bosch Professional 12V Battery Pack", result);
    }

    [TestMethod]
    public void ExtractText_VeryLongDocument_IsCappedAt32000Characters()
    {
        var sb = new StringBuilder();
        sb.AppendLine("%PDF-1.4\n1 0 obj\nstream");
        for (var i = 0; i < 2000; i++)
        {
            sb.AppendLine(
                $"({i:D4} The quick brown fox jumps over the lazy dog and tests PDF manual indexing extensively.) Tj"
            );
        }
        sb.AppendLine("endstream\nendobj\n%%EOF");

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var result = PdfTextExtractor.ExtractText(bytes, "application/pdf", "large.pdf");

        Assert.IsNotNull(result);
        Assert.IsLessThanOrEqualTo(result.Length, 32000);
    }
}
