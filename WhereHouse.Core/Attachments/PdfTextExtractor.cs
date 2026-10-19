using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;

namespace WhereHouse.Core.Attachments;

public static partial class PdfTextExtractor
{
    public const int MaxExtractedTextLength = 32000;

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();

    public static string? ExtractText(byte[]? fileBytes, string? contentType, string? fileName)
    {
        if (fileBytes == null || fileBytes.Length == 0)
        {
            return null;
        }

        var isPdf =
            (contentType != null && contentType.Contains("pdf", StringComparison.OrdinalIgnoreCase))
            || (fileName != null && fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            || StartsWithAscii(fileBytes, "%PDF-");

        if (isPdf)
        {
            return ExtractPdfText(fileBytes);
        }

        var isText =
            (
                contentType != null
                && contentType.StartsWith("text/", StringComparison.OrdinalIgnoreCase)
            )
            || (
                fileName != null
                && (
                    fileName.EndsWith(".txt", StringComparison.OrdinalIgnoreCase)
                    || fileName.EndsWith(".md", StringComparison.OrdinalIgnoreCase)
                    || fileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)
                )
            );

        if (isText)
        {
            return NormalizeText(Encoding.UTF8.GetString(fileBytes));
        }

        return null;
    }

    private static string? ExtractPdfText(byte[] pdfBytes)
    {
        var sb = new StringBuilder();
        var streamBlocks = ExtractStreams(pdfBytes);

        foreach (var stream in streamBlocks)
        {
            var text = ExtractTextFromStream(stream);
            if (!string.IsNullOrWhiteSpace(text))
            {
                sb.Append(' ').Append(text);
                if (sb.Length >= MaxExtractedTextLength)
                {
                    break;
                }
            }
        }

        // Also scan raw bytes outside or inside uncompressed streams for literal string tokens (e.g. (Hello World) Tj)
        if (sb.Length == 0)
        {
            var rawText = ExtractTextFromStream(pdfBytes);
            if (!string.IsNullOrWhiteSpace(rawText))
            {
                sb.Append(rawText);
            }
        }

        return NormalizeText(sb.ToString());
    }

    private static List<byte[]> ExtractStreams(byte[] bytes)
    {
        var streams = new List<byte[]>();
        var streamMarker = Encoding.ASCII.GetBytes("stream");
        var endstreamMarker = Encoding.ASCII.GetBytes("endstream");

        var index = 0;
        while (index < bytes.Length)
        {
            var streamStart = FindSequence(bytes, streamMarker, index);
            if (streamStart == -1)
            {
                break;
            }

            var contentStart = streamStart + streamMarker.Length;
            if (contentStart < bytes.Length && bytes[contentStart] == '\r')
            {
                contentStart++;
            }
            if (contentStart < bytes.Length && bytes[contentStart] == '\n')
            {
                contentStart++;
            }

            var streamEnd = FindSequence(bytes, endstreamMarker, contentStart);
            if (streamEnd == -1)
            {
                break;
            }

            var length = streamEnd - contentStart;
            if (length > 0 && length <= bytes.Length - contentStart)
            {
                var streamBytes = new byte[length];
                Buffer.BlockCopy(bytes, contentStart, streamBytes, 0, length);

                // Attempt zlib / deflate decompression
                var decompressed = TryDecompress(streamBytes);
                streams.Add(decompressed ?? streamBytes);
            }

            index = streamEnd + endstreamMarker.Length;
        }

        return streams;
    }

    private static byte[]? TryDecompress(byte[] compressedBytes)
    {
        if (compressedBytes.Length < 2)
        {
            return null;
        }

        // Try ZLibStream first
        try
        {
            using var msInput = new MemoryStream(compressedBytes);
            using var zlib = new ZLibStream(msInput, CompressionMode.Decompress);
            using var msOutput = new MemoryStream();
            zlib.CopyTo(msOutput);
            return msOutput.ToArray();
        }
        catch
        {
            // Fallback: try raw DeflateStream (skipping 2-byte header if present)
            try
            {
                var offset = (compressedBytes[0] == 0x78) ? 2 : 0;
                using var msInput = new MemoryStream(
                    compressedBytes,
                    offset,
                    compressedBytes.Length - offset
                );
                using var deflate = new DeflateStream(msInput, CompressionMode.Decompress);
                using var msOutput = new MemoryStream();
                deflate.CopyTo(msOutput);
                return msOutput.ToArray();
            }
            catch
            {
                return null;
            }
        }
    }

    private static string ExtractTextFromStream(byte[] streamBytes)
    {
        var sb = new StringBuilder();
        var i = 0;

        while (i < streamBytes.Length)
        {
            var b = streamBytes[i];

            // Parenthesized string: (Hello World)
            if (b == '(')
            {
                i++;
                var depth = 1;
                var strBuilder = new StringBuilder();

                while (i < streamBytes.Length && depth > 0)
                {
                    var ch = (char)streamBytes[i];
                    if (ch == '\\' && i + 1 < streamBytes.Length)
                    {
                        i++;
                        var esc = (char)streamBytes[i];
                        switch (esc)
                        {
                            case 'n':
                                strBuilder.Append('\n');
                                break;
                            case 'r':
                                strBuilder.Append('\r');
                                break;
                            case 't':
                                strBuilder.Append('\t');
                                break;
                            case 'b':
                                strBuilder.Append('\b');
                                break;
                            case 'f':
                                strBuilder.Append('\f');
                                break;
                            case '(':
                                strBuilder.Append('(');
                                break;
                            case ')':
                                strBuilder.Append(')');
                                break;
                            case '\\':
                                strBuilder.Append('\\');
                                break;
                            default:
                                if (
                                    char.IsDigit(esc)
                                    && i + 2 < streamBytes.Length
                                    && char.IsDigit((char)streamBytes[i + 1])
                                    && char.IsDigit((char)streamBytes[i + 2])
                                )
                                {
                                    var octal = new string([
                                        (char)streamBytes[i],
                                        (char)streamBytes[i + 1],
                                        (char)streamBytes[i + 2],
                                    ]);
                                    try
                                    {
                                        var octalVal = Convert.ToInt32(octal, 8);
                                        strBuilder.Append((char)octalVal);
                                        i += 2;
                                    }
                                    catch
                                    {
                                        strBuilder.Append(esc);
                                    }
                                }
                                else
                                {
                                    strBuilder.Append(esc);
                                }
                                break;
                        }
                    }
                    else if (ch == '(')
                    {
                        depth++;
                        strBuilder.Append('(');
                    }
                    else if (ch == ')')
                    {
                        depth--;
                        if (depth > 0)
                        {
                            strBuilder.Append(')');
                        }
                    }
                    else
                    {
                        strBuilder.Append(ch);
                    }
                    i++;
                }

                var text = strBuilder.ToString().Trim();
                if (text.Length > 0 && IsPrintable(text))
                {
                    sb.Append(' ').Append(text);
                }
            }
            // Hex string: <48656C6C6F>
            else if (b == '<' && i + 1 < streamBytes.Length && streamBytes[i + 1] != '<')
            {
                i++;
                var hexBuilder = new StringBuilder();
                while (i < streamBytes.Length && streamBytes[i] != '>')
                {
                    var c = (char)streamBytes[i];
                    if (Uri.IsHexDigit(c))
                    {
                        hexBuilder.Append(c);
                    }
                    i++;
                }
                if (i < streamBytes.Length && streamBytes[i] == '>')
                {
                    i++;
                }

                var hexStr = hexBuilder.ToString();
                if (hexStr.Length % 2 != 0)
                {
                    hexStr += "0";
                }

                if (hexStr.Length >= 2)
                {
                    var decoded = DecodeHex(hexStr);
                    if (decoded.Length > 0 && IsPrintable(decoded))
                    {
                        sb.Append(' ').Append(decoded);
                    }
                }
            }
            else
            {
                i++;
            }
        }

        return sb.ToString();
    }

    private static string DecodeHex(string hex)
    {
        try
        {
            var bytes = new byte[hex.Length / 2];
            for (var i = 0; i < bytes.Length; i++)
            {
                bytes[i] = Convert.ToByte(hex.Substring(i * 2, 2), 16);
            }

            // If big-endian UTF-16 marker FE FF
            if (bytes.Length >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF)
            {
                return Encoding.BigEndianUnicode.GetString(bytes, 2, bytes.Length - 2);
            }

            // If UTF-8 / ASCII
            var text = Encoding.UTF8.GetString(bytes);
            return text;
        }
        catch
        {
            return string.Empty;
        }
    }

    private static bool IsPrintable(string text)
    {
        var printable = 0;
        foreach (var c in text)
        {
            if (char.IsLetterOrDigit(c) || char.IsPunctuation(c) || char.IsWhiteSpace(c))
            {
                printable++;
            }
        }
        return text.Length > 0 && (printable / (double)text.Length) >= 0.7;
    }

    private static string? NormalizeText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var normalized = WhitespaceRegex().Replace(text, " ").Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        if (normalized.Length > MaxExtractedTextLength)
        {
            normalized = normalized[..MaxExtractedTextLength];
        }

        return normalized;
    }

    private static bool StartsWithAscii(byte[] bytes, string prefix)
    {
        if (bytes.Length < prefix.Length)
        {
            return false;
        }

        for (var i = 0; i < prefix.Length; i++)
        {
            if (bytes[i] != (byte)prefix[i])
            {
                return false;
            }
        }

        return true;
    }

    private static int FindSequence(byte[] source, byte[] sequence, int startIndex)
    {
        if (source.Length == 0 || sequence.Length == 0 || startIndex >= source.Length)
        {
            return -1;
        }

        for (var i = startIndex; i <= source.Length - sequence.Length; i++)
        {
            var match = true;
            for (var j = 0; j < sequence.Length; j++)
            {
                if (source[i + j] != sequence[j])
                {
                    match = false;
                    break;
                }
            }

            if (match)
            {
                return i;
            }
        }

        return -1;
    }
}
