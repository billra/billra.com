import { buildPNG, formatPNGLog } from './png.mjs';

// ==========================================
// PRIVATE INTERNALS
// ==========================================

const toHex = (value, byteLength = 1) => value.toString(16).padStart(byteLength * 2, '0');

const findColorIndex = (palette, r, g, b, a) =>
    palette.findIndex(c => c.r === r && c.g === g && c.b === b && c.a === a);

function extractPalette(rgbaPixels) {
    const palette = [];
    let transparentIndex = -1;

    for (const { r, g, b, a } of rgbaPixels) {
        if (findColorIndex(palette, r, g, b, a) === -1) {
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

function assembleICO(pngBuffer, colorCount, bitDepth) {
    const icoBuffer = new Uint8Array(22 + pngBuffer.length);
    const view = new DataView(icoBuffer.buffer);
    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, 1, true);
    icoBuffer[6] = 16;
    icoBuffer[7] = 16;
    icoBuffer[8] = colorCount;
    icoBuffer[9] = 0;
    view.setUint16(10, 1, true);
    view.setUint16(12, bitDepth, true);
    view.setUint32(14, pngBuffer.length, true);
    view.setUint32(18, 22, true);
    icoBuffer.set(pngBuffer, 22);
    return icoBuffer;
}

function generateTruecolor(rgbaPixels) {
    const truecolorPixels = new Uint8Array(16 * (1 + 16 * 4));
    let writeOffset = 0;
    for (let y = 0; y < 16; y++) {
        truecolorPixels[writeOffset++] = 0;
        for (let x = 0; x < 16; x++) {
            const rgbaObject = rgbaPixels[y * 16 + x];
            truecolorPixels[writeOffset++] = rgbaObject.r;
            truecolorPixels[writeOffset++] = rgbaObject.g;
            truecolorPixels[writeOffset++] = rgbaObject.b;
            truecolorPixels[writeOffset++] = rgbaObject.a;
        }
    }

    const { pngBuffer, deflateStats } = buildPNG({
        width: 16,
        height: 16,
        bitDepth: 8,
        colorType: 6,
        uncompressedPixels: truecolorPixels
    });

    const icoBuffer = assembleICO(pngBuffer, 0, 32);
    const log = generateLogForIco(icoBuffer, deflateStats);

    return { icoBuffer, pngBuffer, deflateStats, log };
}

function generateIndexed(rgbaPixels, palette, transparentIndex) {
    if (palette.length > 16) return null;

    let bitDepth = 0;
    if (palette.length <= 2) bitDepth = 1;
    else if (palette.length <= 4) bitDepth = 2;
    else bitDepth = 4;

    const pixelsPerByte = 8 / bitDepth;
    const bytesPerRow = Math.ceil(16 / pixelsPerByte);
    const packedPixels = new Uint8Array(16 * (1 + bytesPerRow));

    let writeOffset = 0;
    for (let y = 0; y < 16; y++) {
        packedPixels[writeOffset++] = 0;

        let currentByte = 0;
        for (let x = 0; x < 16; x++) {
            const rgbaObject = rgbaPixels[y * 16 + x];
            const paletteIndex = findColorIndex(palette, rgbaObject.r, rgbaObject.g, rgbaObject.b, rgbaObject.a);

            const bitOffset = 8 - bitDepth - ((x % pixelsPerByte) * bitDepth);
            currentByte |= (paletteIndex << bitOffset);

            if ((x + 1) % pixelsPerByte === 0 || x === 15) {
                packedPixels[writeOffset++] = currentByte;
                currentByte = 0;
            }
        }
    }

    const transparentAlpha = transparentIndex === 0 ? palette[0].a : null;

    const { pngBuffer, deflateStats } = buildPNG({
        width: 16,
        height: 16,
        bitDepth: bitDepth,
        colorType: 3,
        uncompressedPixels: packedPixels,
        palette: palette,
        transparentAlpha: transparentAlpha
    });

    const icoBuffer = assembleICO(pngBuffer, palette.length, bitDepth);
    const log = generateLogForIco(icoBuffer, deflateStats);

    return { icoBuffer, pngBuffer, deflateStats, bitDepth, log };
}

// ==========================================
// PUBLIC API
// ==========================================

export function generateLogForIco(icoBuffer, deflateStats) {
    const view = new DataView(icoBuffer.buffer, icoBuffer.byteOffset, icoBuffer.byteLength);

    const readHex = (start, len) => {
        let hexBytes = [];
        for (let i = 0; i < len; i++) hexBytes.push(toHex(view.getUint8(start + i)));
        return hexBytes.join(' ');
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

    const pngBuffer = icoBuffer.subarray(22);
    log += formatPNGLog(pngBuffer);

    return log;
}

/**
 * Main orchestrator for generating all relevant ICO assets.
 * Takes raw 32-bit pixel data, analyzes it, and returns the final payloads and logs.
 */
export function generateIcons(rgbaPixels) {
    const { palette, transparentIndex } = extractPalette(rgbaPixels);

    const truecolorResult = generateTruecolor(rgbaPixels);
    const indexedResult = generateIndexed(rgbaPixels, palette, transparentIndex);

    return { truecolorResult, indexedResult };
}
