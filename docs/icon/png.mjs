import pako from 'https://esm.sh/pako@2.2.0';

// ==========================================
// COMPRESSION INTERNALS (Pako-Specific)
// ==========================================

const STRATEGY_MAP = {
    [pako.constants.Z_DEFAULT_STRATEGY]: 'Default',
    [pako.constants.Z_FILTERED]: 'Filtered',
    [pako.constants.Z_HUFFMAN_ONLY]: 'Huffman Only',
    [pako.constants.Z_RLE]: 'RLE',
    [pako.constants.Z_FIXED]: 'Fixed'
};
const STRATEGIES = Object.keys(STRATEGY_MAP).map(Number);

function bestDeflate(uncompressedData) {
    let best = null;
    let bestStrategy = null;

    for (const strategy of STRATEGIES) {
        const compressed = pako.deflate(uncompressedData, {
            level: pako.constants.Z_BEST_COMPRESSION,
            strategy
        });

        if (!best || compressed.length < best.length) {
            best = compressed;
            bestStrategy = strategy;
        }
    }

    return { data: best, strategy: bestStrategy };
}

// ==========================================
// PRIVATE INTERNALS (Not Exported)
// ==========================================

const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        table[i] = c;
    }
    return table;
})();

function crc32(type, data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < 4; i++) crc = crcTable[(crc ^ type.charCodeAt(i)) & 0xFF] ^ (crc >>> 8);
    for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
    const chunk = new Uint8Array(4 + 4 + data.length + 4);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
    chunk.set(data, 8);
    view.setUint32(8 + data.length, crc32(type, data), false);
    return chunk;
}

// Helper for hex formatting in the logger
const toHex = (value, byteLength = 1) => value.toString(16).padStart(byteLength * 2, '0');

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Builds a valid PNG binary from uncompressed pixel data and raw configuration.
 * Automatically handles zlib compression and strategy optimization.
 */
export function buildPNG({ width, height, bitDepth, colorType, uncompressedPixels, palette = null, transparentAlpha = null }) {
    const pngSignature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    const ihdrData = new Uint8Array(13);
    const ihdrView = new DataView(ihdrData.buffer);
    ihdrView.setUint32(0, width, false);
    ihdrView.setUint32(4, height, false);
    ihdrData[8] = bitDepth;
    ihdrData[9] = colorType;
    const ihdrChunk = createChunk('IHDR', ihdrData);

    let plteChunk = null;
    let trnsChunk = null;

    if (colorType === 3 && palette) {
        const plteData = new Uint8Array(palette.length * 3);
        palette.forEach((c, i) => {
            plteData[i*3] = c.r; plteData[i*3+1] = c.g; plteData[i*3+2] = c.b;
        });
        plteChunk = createChunk('PLTE', plteData);

        if (transparentAlpha !== null) {
            trnsChunk = createChunk('tRNS', new Uint8Array([transparentAlpha]));
        }
    }

    // Handle compression natively inside the PNG module
    const { data: compressedIdat, strategy } = bestDeflate(uncompressedPixels);
    const idatChunk = createChunk('IDAT', compressedIdat);

    const iendChunk = createChunk('IEND', new Uint8Array(0));

    const chunks = [pngSignature, ihdrChunk, plteChunk, trnsChunk, idatChunk, iendChunk].filter(Boolean);
    const size = chunks.reduce((sum, c) => sum + c.length, 0);
    const pngBuffer = new Uint8Array(size);

    let offset = 0;
    chunks.forEach(c => { pngBuffer.set(c, offset); offset += c.length; });

    return {
        pngBuffer,
        deflateStats: {
            strategy,
            strategyName: STRATEGY_MAP[strategy]
        }
    };
}

/**
 * Parses a PNG buffer and returns a formatted audit log of its chunks.
 */
export function formatPNGLog(pngBuffer) {
    const view = new DataView(pngBuffer.buffer, pngBuffer.byteOffset, pngBuffer.byteLength);

    const readHex = (start, len) => {
        let hexBytes = [];
        for (let i = 0; i < len; i++) hexBytes.push(toHex(view.getUint8(start + i)));
        return hexBytes.join(' ');
    };
    const readAscii = (start, len) => {
        let res = '';
        for (let i = 0; i < len; i++) res += String.fromCharCode(view.getUint8(start + i));
        return res;
    };

    let log = `\n--- PNG Payload (${pngBuffer.length} Bytes) ---\n\n`;
    log += `[SIGNATURE] (8 Bytes)\n`;
    log += `- ${readHex(0, 8)}: PNG Magic Number\n`;

    let offset = 8;
    while (offset < pngBuffer.length) {
        const chunkLen = view.getUint32(offset, false);
        const chunkType = readAscii(offset + 4, 4);

        const chunkLenHex = toHex(chunkLen, 4).match(/.{2}/g).join(' ');
        const chunkTypeHex = readHex(offset + 4, 4);
        const crcHex = readHex(offset + 8 + chunkLen, 4);

        log += `\n[${chunkType} CHUNK] (${chunkLen + 12} Bytes)\n`;
        log += `- ${chunkLenHex}: Chunk Length = ${chunkLen}\n`;
        log += `- ${chunkTypeHex}: Chunk Type = "${chunkType}"\n`;

        if (chunkType === 'PLTE') {
            for (let i = 0; i < chunkLen; i += 3) {
                const hexCode = readHex(offset + 8 + i, 3).replace(/ /g, '');
                log += `- ${readHex(offset + 8 + i, 3)}: Index ${i / 3} (#${hexCode})\n`;
            }
        } else if (chunkType === 'tRNS') {
            for (let i = 0; i < chunkLen; i++) {
                const alpha = view.getUint8(offset + 8 + i);
                log += `- ${readHex(offset + 8 + i, 1)}: Alpha for Index ${i} = ${alpha}\n`;
            }
        } else if (chunkType === 'IHDR') {
            log += `- ... ${chunkLen} bytes of image headers ...\n`;
        } else if (chunkType === 'IDAT') {
            log += `- ... ${chunkLen} bytes of compressed image data ...\n`;
        }

        log += `- ${crcHex}: CRC32\n`;

        offset += 12 + chunkLen;
        if (chunkType === 'IEND') break;
    }

    return log;
}
