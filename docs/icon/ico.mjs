import { buildPNG, formatPNGLog } from './png.mjs';

// ==========================================
// PRIVATE INTERNALS
// ==========================================

const toHex = (val, bytes = 1) => val.toString(16).padStart(bytes * 2, '0');

function extractPalette(colors) {
    const palette = [];
    let transparentIndex = -1;
    const findColor = (r, g, b, a) => palette.findIndex(c => c.r === r && c.g === g && c.b === b && c.a === a);

    for (const { r, g, b, a } of colors) {
        if (findColor(r, g, b, a) === -1) {
            if (a < 255 && transparentIndex === -1 && palette.length < 16) {
                palette.unshift({ r, g, b, a });
                transparentIndex = 0;
            } else {
                palette.push({ r, g, b, a });
            }
        }
    }

    if (palette.length === 0) {
        palette.push({ r: 0, g: 0, b: 0, a: 0 });
        transparentIndex = 0;
    }

    return { palette, transparentIndex };
}

function assembleICO(pngPayload, colorCount, bitDepth) {
    const ico = new Uint8Array(22 + pngPayload.length);
    const view = new DataView(ico.buffer);
    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, 1, true);
    ico[6] = 16;
    ico[7] = 16;
    ico[8] = colorCount;
    ico[9] = 0;
    view.setUint16(10, 1, true);
    view.setUint16(12, bitDepth, true);
    view.setUint32(14, pngPayload.length, true);
    view.setUint32(18, 22, true);
    ico.set(pngPayload, 22);
    return ico;
}

function generateTruecolor(colors) {
    const truecolorPixels = new Uint8Array(16 * (1 + 16 * 4));
    let tcWritePos = 0;
    for (let y = 0; y < 16; y++) {
        truecolorPixels[tcWritePos++] = 0;
        for (let x = 0; x < 16; x++) {
            const c = colors[y * 16 + x];
            truecolorPixels[tcWritePos++] = c.r;
            truecolorPixels[tcWritePos++] = c.g;
            truecolorPixels[tcWritePos++] = c.b;
            truecolorPixels[tcWritePos++] = c.a;
        }
    }

    const { payload: pngPayload, deflateStats } = buildPNG({
        width: 16,
        height: 16,
        bitDepth: 8,
        colorType: 6,
        uncompressedPixels: truecolorPixels
    });

    const ico = assembleICO(pngPayload, 0, 32);
    const log = generateLogForIco(ico, deflateStats);

    return { ico, pngPayload, deflateStats, log };
}

function generateIndexed(colors, palette, transparentIndex) {
    if (palette.length > 16) return null;

    let bitDepth = 0;
    if (palette.length <= 2) bitDepth = 1;
    else if (palette.length <= 4) bitDepth = 2;
    else bitDepth = 4;

    const pixelsPerByte = 8 / bitDepth;
    const bytesPerRow = Math.ceil(16 / pixelsPerByte);
    const packedPixels = new Uint8Array(16 * (1 + bytesPerRow));
    const findColor = (r, g, b, a) => palette.findIndex(c => c.r === r && c.g === g && c.b === b && c.a === a);

    let idxWritePos = 0;
    for (let y = 0; y < 16; y++) {
        packedPixels[idxWritePos++] = 0;

        let currentByte = 0;
        for (let x = 0; x < 16; x++) {
            const c = colors[y * 16 + x];
            const pIdx = findColor(c.r, c.g, c.b, c.a);

            const bitOffset = 8 - bitDepth - ((x % pixelsPerByte) * bitDepth);
            currentByte |= (pIdx << bitOffset);

            if ((x + 1) % pixelsPerByte === 0 || x === 15) {
                packedPixels[idxWritePos++] = currentByte;
                currentByte = 0;
            }
        }
    }

    const tAlpha = transparentIndex === 0 ? palette[0].a : null;

    const { payload: pngPayload, deflateStats } = buildPNG({
        width: 16,
        height: 16,
        bitDepth: bitDepth,
        colorType: 3,
        uncompressedPixels: packedPixels,
        palette: palette,
        transparentAlpha: tAlpha
    });

    const ico = assembleICO(pngPayload, palette.length, bitDepth);
    const log = generateLogForIco(ico, deflateStats);

    return { ico, pngPayload, deflateStats, bitDepth, log };
}

// ==========================================
// PUBLIC API
// ==========================================

export function generateLogForIco(ico, deflateStats) {
    const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);

    const readHex = (start, len) => {
        let res = [];
        for (let i = 0; i < len; i++) res.push(toHex(view.getUint8(start + i)));
        return res.join(' ');
    };

    const pngSize = view.getUint32(14, true);
    const offsetHex = toHex(view.getUint32(18, true), 4).match(/.{2}/g).join(' ');
    const sizeHex = toHex(pngSize, 4).match(/.{2}/g).join(' ');

    let log = `[ICO HEADER] (22 Bytes)\n`;
    log += `- ${readHex(0, 2)}: Reserved\n`;
    log += `- ${readHex(2, 2)}: Type = ${view.getUint16(2, true)} (icon)\n`;
    log += `- ${readHex(4, 2)}: Image count = ${view.getUint16(4, true)}\n`;
    log += `- ${readHex(6, 1)}: Width = ${view.getUint8(6) || 256}\n`;
    log += `- ${readHex(7, 1)}: Height = ${view.getUint8(7) || 256}\n`;
    log += `- ${readHex(8, 1)}: Color count = ${view.getUint8(8)}\n`;
    log += `- ${readHex(9, 1)}: Reserved\n`;
    log += `- ${readHex(10, 2)}: Planes = ${view.getUint16(10, true)}\n`;
    log += `- ${readHex(12, 2)}: Bit count = ${view.getUint16(12, true)}\n`;
    log += `- ${sizeHex}: Image data size = ${pngSize}\n`;
    log += `- ${offsetHex}: Offset to image = ${view.getUint32(18, true)}\n\n`;

    log += `Optimal zlib Strategy: ${deflateStats.strategy} (${deflateStats.strategyName})\n\n`;

    const pngSlice = ico.subarray(22);
    log += formatPNGLog(pngSlice);

    return log;
}

/**
 * Main orchestrator for generating all relevant ICO assets.
 * Takes raw 32-bit pixel data, analyzes it, and returns the final payloads and logs.
 */
export function generateIcons(colors) {
    const { palette, transparentIndex } = extractPalette(colors);

    const truecolorResult = generateTruecolor(colors);
    const indexedResult = generateIndexed(colors, palette, transparentIndex);

    return { truecolorResult, indexedResult };
}
