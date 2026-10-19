using WhereHouse.Core.QrCodes;

namespace WhereHouse.Core.UnitTests;

[TestClass]
public sealed class QrCodeTokenHelperTests
{
    [TestMethod]
    public void ExtractCodeFromScanInput_RawCodes_TrimsAndNormalizesToUpper()
    {
        Assert.AreEqual("BIN-042", QrCodeTokenHelper.ExtractCodeFromScanInput("BIN-042"));
        Assert.AreEqual("ITM-100", QrCodeTokenHelper.ExtractCodeFromScanInput("  itm-100  "));
        Assert.AreEqual("QR-0001", QrCodeTokenHelper.ExtractCodeFromScanInput("qr-0001"));
    }

    [TestMethod]
    public void ExtractCodeFromScanInput_FullScanUrls_ExtractsAndNormalizesToken()
    {
        Assert.AreEqual(
            "BIN-042",
            QrCodeTokenHelper.ExtractCodeFromScanInput(
                "https://wherehouse.yourdomain.lan/scan/bin-042"
            )
        );
        Assert.AreEqual(
            "QR-0005",
            QrCodeTokenHelper.ExtractCodeFromScanInput(
                "https://wherehouse.yourdomain.lan/scan/QR-0005?source=print"
            )
        );
        Assert.AreEqual(
            "ITM-007",
            QrCodeTokenHelper.ExtractCodeFromScanInput("http://localhost:4200/scan/ITM-007#top")
        );
        Assert.AreEqual(
            "CONTAINER 01",
            QrCodeTokenHelper.ExtractCodeFromScanInput(
                "https://wherehouse.lan/scan/container%2001?foo=bar"
            )
        );
    }

    [TestMethod]
    public void ExtractCodeFromScanInput_NullOrWhitespace_ThrowsArgumentException()
    {
        Assert.ThrowsExactly<ArgumentException>(() =>
            QrCodeTokenHelper.ExtractCodeFromScanInput(null)
        );
        Assert.ThrowsExactly<ArgumentException>(() =>
            QrCodeTokenHelper.ExtractCodeFromScanInput("   ")
        );
        Assert.ThrowsExactly<ArgumentException>(() =>
            QrCodeTokenHelper.ExtractCodeFromScanInput(string.Empty)
        );
    }

    [TestMethod]
    public void GenerateNextBlankToken_EmptyList_ReturnsDefault0001()
    {
        var token = QrCodeTokenHelper.GenerateNextBlankToken([]);
        Assert.AreEqual("QR-0001", token);
    }

    [TestMethod]
    public void GenerateNextBlankToken_ExistingSequentialTokens_ReturnsNextNumber()
    {
        var existing = new[] { "QR-0001", "QR-0002", "QR-0003", "BIN-001", "OTHER" };
        var token = QrCodeTokenHelper.GenerateNextBlankToken(existing);
        Assert.AreEqual("QR-0004", token);
    }

    [TestMethod]
    public void GenerateNextBlankToken_WithGaps_PicksMaxPlusOne()
    {
        var existing = new[] { "qr-0010", "QR-0002" };
        var token = QrCodeTokenHelper.GenerateNextBlankToken(existing);
        Assert.AreEqual("QR-0011", token);
    }

    [TestMethod]
    public void GenerateNextBlankToken_CustomPrefix_ReturnsFormattedToken()
    {
        var existing = new[] { "BOX-0001", "BOX-0005" };
        var token = QrCodeTokenHelper.GenerateNextBlankToken(existing, "box");
        Assert.AreEqual("BOX-0006", token);
    }
}
