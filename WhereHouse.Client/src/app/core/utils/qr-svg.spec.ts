import { describe, expect, it } from 'vitest';
import { generateQrMatrix, generateQrSvgDataUrl, generateQrSvgString } from './qr-svg';

describe('qr-svg utility', () => {
  it('generates a 21x21 matrix for short codes (Version 1)', () => {
    const matrix = generateQrMatrix('BIN-042');
    expect(matrix.length).toBe(21);
    expect(matrix[0].length).toBe(21);

    // Top-left finder center is dark
    expect(matrix[3][3]).toBe(true);
    // Top-left finder border is dark
    expect(matrix[0][0]).toBe(true);
    // Separator module between finder and content is white
    expect(matrix[0][7]).toBe(false);
  });

  it('generates larger matrices for longer deep link URLs (Version 2+)', () => {
    const matrix = generateQrMatrix('https://wherehouse.yourdomain.lan/scan/BIN-042?foo=bar');
    expect(matrix.length).toBeGreaterThanOrEqual(25);
    expect(matrix[0].length).toBe(matrix.length);
  });

  it('generates valid SVG string with crisp rendering and quiet zone', () => {
    const svg = generateQrSvgString('QR-0001', 150, 4);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 29 29"');
    expect(svg).toContain('width="150"');
    expect(svg).toContain('height="150"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('</svg>');
  });

  it('generates data URL with svg mime type', () => {
    const dataUrl = generateQrSvgDataUrl('ITM-005');
    expect(dataUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(dataUrl).toContain('%3Csvg');
  });

  it('throws error if payload exceeds Version 6 capacity', () => {
    const longString = 'A'.repeat(250);
    expect(() => generateQrMatrix(longString)).toThrowError();
  });
});
