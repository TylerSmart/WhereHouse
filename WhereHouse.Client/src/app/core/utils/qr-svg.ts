/**
 * Lightweight, zero-dependency, self-contained QR Code SVG generator.
 * Encodes strings into ISO/IEC 18004 QR codes (Byte Mode, Error Correction Level M, Versions 1-6).
 * Safe for air-gapped offline environments and crisp vector printing.
 */

// GF(2^8) tables with primitive polynomial 0x11D (285)
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(() => {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    EXP_TABLE[i + 255] = val;
    LOG_TABLE[val] = i;
    val = (val << 1) ^ (val & 0x80 ? 0x11d : 0);
  }
})();

function gfMul(x: number, y: number): number {
  return x === 0 || y === 0 ? 0 : EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], root);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsComputeEcc(data: Uint8Array, eccCount: number): Uint8Array {
  const gen = rsGeneratorPoly(eccCount);
  const msg = new Uint8Array(data.length + eccCount);
  msg.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

interface VersionSpec {
  version: number;
  totalDataCodewords: number;
  alignCoords: number[];
  blocks: { count: number; dataCodewords: number; eccCodewords: number }[];
}

// Error Correction Level M specifications for Versions 1-6
const VERSION_SPECS: VersionSpec[] = [
  {
    version: 1,
    totalDataCodewords: 16,
    alignCoords: [],
    blocks: [{ count: 1, dataCodewords: 16, eccCodewords: 10 }],
  },
  {
    version: 2,
    totalDataCodewords: 28,
    alignCoords: [6, 18],
    blocks: [{ count: 1, dataCodewords: 28, eccCodewords: 16 }],
  },
  {
    version: 3,
    totalDataCodewords: 44,
    alignCoords: [6, 22],
    blocks: [{ count: 1, dataCodewords: 44, eccCodewords: 26 }],
  },
  {
    version: 4,
    totalDataCodewords: 64,
    alignCoords: [6, 26],
    blocks: [{ count: 2, dataCodewords: 32, eccCodewords: 18 }],
  },
  {
    version: 5,
    totalDataCodewords: 86,
    alignCoords: [6, 30],
    blocks: [{ count: 2, dataCodewords: 43, eccCodewords: 24 }],
  },
  {
    version: 6,
    totalDataCodewords: 108,
    alignCoords: [6, 34],
    blocks: [{ count: 4, dataCodewords: 27, eccCodewords: 16 }],
  },
];

class BitBuffer {
  private buffer: number[] = [];
  public length = 0;

  put(num: number, length: number): void {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }

  putBit(bit: boolean): void {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    if (bit) {
      this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    }
    this.length++;
  }

  getBuffer(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

function selectVersion(dataLength: number): VersionSpec {
  for (const spec of VERSION_SPECS) {
    // Mode indicator (4 bits) + Character count indicator (8 bits for v1-9 byte mode) = 12 bits = 1.5 bytes
    const requiredCodewords = dataLength + 2;
    if (requiredCodewords <= spec.totalDataCodewords) {
      return spec;
    }
  }
  throw new Error(`Data too long for QR versions 1-6 (${dataLength} bytes).`);
}

function getFormatBits(ecLevelBits: number, mask: number): number {
  const data = (ecLevelBits << 3) | mask;
  let rem = data << 10;
  const poly = 0x537;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= poly << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

export function generateQrMatrix(payload: string): boolean[][] {
  const utf8Encoder = new TextEncoder();
  const rawBytes = utf8Encoder.encode(payload);
  const spec = selectVersion(rawBytes.length);
  const size = 21 + 4 * (spec.version - 1);

  // 1. Bit Stream Encoding (Byte Mode = 0100)
  const bitBuffer = new BitBuffer();
  bitBuffer.put(0b0100, 4); // Byte mode indicator
  bitBuffer.put(rawBytes.length, 8); // 8-bit character count indicator for v1-9
  for (const byte of rawBytes) {
    bitBuffer.put(byte, 8);
  }

  // Terminator bits (up to 4 zeroes)
  const maxDataBits = spec.totalDataCodewords * 8;
  const terminatorLen = Math.min(4, maxDataBits - bitBuffer.length);
  if (terminatorLen > 0) {
    bitBuffer.put(0, terminatorLen);
  }

  // Byte alignment
  while (bitBuffer.length % 8 !== 0) {
    bitBuffer.putBit(false);
  }

  // Pad bytes alternating 0xEC and 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bitBuffer.length < maxDataBits) {
    bitBuffer.put(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  const dataBytes = bitBuffer.getBuffer();

  // 2. Block division and Reed-Solomon Error Correction
  const blocksData: Uint8Array[] = [];
  const blocksEcc: Uint8Array[] = [];
  let byteOffset = 0;

  for (const blockInfo of spec.blocks) {
    for (let b = 0; b < blockInfo.count; b++) {
      const bData = dataBytes.slice(byteOffset, byteOffset + blockInfo.dataCodewords);
      byteOffset += blockInfo.dataCodewords;
      const bEcc = rsComputeEcc(bData, blockInfo.eccCodewords);
      blocksData.push(bData);
      blocksEcc.push(bEcc);
    }
  }

  // Interleave data codewords
  const finalCodewords: number[] = [];
  const maxBlockDataLen = Math.max(...blocksData.map((b) => b.length));
  for (let i = 0; i < maxBlockDataLen; i++) {
    for (const bData of blocksData) {
      if (i < bData.length) {
        finalCodewords.push(bData[i]);
      }
    }
  }

  // Interleave ECC codewords
  const maxBlockEccLen = Math.max(...blocksEcc.map((b) => b.length));
  for (let i = 0; i < maxBlockEccLen; i++) {
    for (const bEcc of blocksEcc) {
      if (i < bEcc.length) {
        finalCodewords.push(bEcc[i]);
      }
    }
  }

  // 3. Matrix construction
  // null = unassigned, true = black, false = white
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  // Finder pattern helper
  function drawFinder(row: number, col: number): void {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isDark =
              r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
            matrix[nr][nc] = isDark;
          } else {
            matrix[nr][nc] = false; // separator
          }
          isFunction[nr][nc] = true;
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) {
      matrix[6][i] = i % 2 === 0;
      isFunction[6][i] = true;
    }
    if (!isFunction[i][6]) {
      matrix[i][6] = i % 2 === 0;
      isFunction[i][6] = true;
    }
  }

  // Alignment patterns
  if (spec.alignCoords.length >= 2) {
    const coords = spec.alignCoords;
    for (const r of coords) {
      for (const c of coords) {
        // Skip finders
        if (
          (r === 6 && c === 6) ||
          (r === 6 && c === coords[coords.length - 1]) ||
          (r === coords[coords.length - 1] && c === 6)
        ) {
          continue;
        }
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            const isDark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            matrix[nr][nc] = isDark;
            isFunction[nr][nc] = true;
          }
        }
      }
    }
  }

  // Dark module
  matrix[4 * spec.version + 9][8] = true;
  isFunction[4 * spec.version + 9][8] = true;

  // Format info area reservation
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true;
    if (!isFunction[i][8]) isFunction[i][8] = true;
  }
  for (let i = size - 8; i < size; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true;
    if (!isFunction[i][8]) isFunction[i][8] = true;
  }

  // 4. Data bit placement
  let bitIdx = 0;
  const totalBits = finalCodewords.length * 8;
  let dir = -1; // -1: up, +1: down
  let col = size - 1;

  while (col > 0) {
    if (col === 6) {
      col--; // Skip vertical timing line
    }
    const rStart = dir === -1 ? size - 1 : 0;
    const rEnd = dir === -1 ? -1 : size;
    const rStep = dir === -1 ? -1 : 1;

    for (let r = rStart; r !== rEnd; r += rStep) {
      for (let c = 0; c < 2; c++) {
        const curCol = col - c;
        if (!isFunction[r][curCol]) {
          let bit = false;
          if (bitIdx < totalBits) {
            const byte = finalCodewords[Math.floor(bitIdx / 8)];
            bit = ((byte >>> (7 - (bitIdx % 8))) & 1) === 1;
            bitIdx++;
          }
          // Mask 0: (row + col) % 2 === 0
          const mask = (r + curCol) % 2 === 0;
          matrix[r][curCol] = bit !== mask;
        }
      }
    }
    dir = -dir;
    col -= 2;
  }

  // 5. Format information placement (Level M = 00, Mask 0 = 000)
  const formatBits = getFormatBits(0, 0);
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >>> i) & 1) === 1;
    // Around top-left finder
    if (i <= 5) {
      matrix[8][i] = bit;
    } else if (i === 6) {
      matrix[8][7] = bit;
    } else if (i === 7) {
      matrix[8][8] = bit;
    } else if (i === 8) {
      matrix[7][8] = bit;
    } else {
      matrix[14 - i][8] = bit;
    }

    // Split across bottom-left and top-right finders
    if (i < 8) {
      matrix[size - 1 - i][8] = bit;
    } else {
      matrix[8][size - 15 + i] = bit;
    }
  }

  // Return non-nullable boolean matrix
  return matrix.map((row) => row.map((cell) => cell ?? false));
}

export function generateQrSvgString(payload: string, sizePx = 200, quietZone = 4): string {
  const matrix = generateQrMatrix(payload);
  const matrixSize = matrix.length;
  const totalModules = matrixSize + quietZone * 2;

  let pathD = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = c + quietZone;
        const y = r + quietZone;
        pathD += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="${pathD.trim()}" fill="#000000"/></svg>`;
}

export function generateQrSvgDataUrl(payload: string, sizePx = 200, quietZone = 4): string {
  const svg = generateQrSvgString(payload, sizePx, quietZone);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
