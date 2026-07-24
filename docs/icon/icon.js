import pako from 'https://esm.sh/pako@2.2.0';

// --- Configuration & Constants ---
const CONFIG = {
    gridSize: 16
};
CONFIG.totalPixels = CONFIG.gridSize * CONFIG.gridSize;

// --- DOM Element Cache ---
const elements = {
    grid: document.getElementById('grid-container'),
    colorPicker: document.getElementById('colorPicker'),
    btnEraser: document.getElementById('btn-eraser'),
    btnGenerate: document.getElementById('btn-generate'),
    outputPanel: document.getElementById('output-panel'),
    logIndexed: document.getElementById('log-indexed'),
    logTruecolor: document.getElementById('log-truecolor'),
    titleIndexed: document.getElementById('title-indexed'),
    titleTruecolor: document.getElementById('title-truecolor'),
    previewIndexed: document.getElementById('preview-indexed'),
    previewTruecolor: document.getElementById('preview-truecolor'),
    pixels: []
};

// Keeps track of active object URLs so we don't leak memory on regeneration
let activeObjectUrls = [];

// --- Inject Metadata ---
document.getElementById('page-title').textContent = document.title;
const versionMeta = document.querySelector('meta[name="version"]');
if (versionMeta) document.getElementById('version').textContent = `v${versionMeta.content}`;

// --- State Management ---
const pixelsProxy = new Proxy(new Array(CONFIG.totalPixels).fill(null), {
    set(target, index, value) {
        if (target[index] === value) return true;
        target[index] = value;

        const numIndex = parseInt(index, 10);
        if (!isNaN(numIndex) && elements.pixels[numIndex]) {
            elements.pixels[numIndex].style.backgroundColor = value || 'transparent';
        }
        return true;
    }
});

const state = new Proxy({
    currentColor: elements.colorPicker.value,
    isDrawing: false,
    pixels: pixelsProxy
}, {
    set(target, property, value) {
        if (target[property] === value) return true;
        target[property] = value;

        if (property === 'currentColor') {
            if (value === null) {
                elements.colorPicker.classList.remove('active-tool');
                elements.btnEraser.classList.add('active-tool');
            } else {
                elements.btnEraser.classList.remove('active-tool');
                elements.colorPicker.classList.add('active-tool');
                elements.colorPicker.value = value;
            }
        }
        return true;
    }
});

// --- Initialization ---
function initGrid() {
    for (let i = 0; i < CONFIG.totalPixels; i++) {
        const pixel = document.createElement('div');
        pixel.className = 'pixel';
        pixel.dataset.index = i;

        elements.pixels.push(pixel);
        elements.grid.appendChild(pixel);
    }
}

// --- Interaction Handlers ---
const handlePaint = (e) => {
    if (!state.isDrawing) return;
    const target = e.target.closest('.pixel');
    if (target) {
        const index = parseInt(target.dataset.index, 10);
        state.pixels[index] = state.currentColor;
    }
};

elements.colorPicker.addEventListener('input', (e) => state.currentColor = e.target.value);
elements.colorPicker.addEventListener('click', (e) => state.currentColor = e.target.value);
elements.btnEraser.addEventListener('click', () => state.currentColor = null);

elements.grid.addEventListener('pointerdown', (e) => {
    state.isDrawing = true;
    handlePaint(e);
});
elements.grid.addEventListener('pointerover', handlePaint);
window.addEventListener('pointerup', () => state.isDrawing = false);

// --- Generation Logic ---

function parseColor(val) {
    if (val === null) return { r: 0, g: 0, b: 0, a: 0 };
    const r = parseInt(val.substr(1, 2), 16);
    const g = parseInt(val.substr(3, 2), 16);
    const b = parseInt(val.substr(5, 2), 16);
    return { r, g, b, a: 255 };
}

const toHex = (val, bytes = 1) => val.toString(16).padStart(bytes * 2, '0');

const STRATEGY_NAMES = { 0: 'Default', 1: 'Filtered', 2: 'Huffman Only', 3: 'RLE' };

function bestDeflate(data) {
    let best = null;
    let bestStrategy = 0;

    for (let strategy = 0; strategy <= 3; strategy++) {
        const compressed = pako.deflate(data, { level: 9, strategy });
        if (!best || compressed.length < best.length) {
            best = compressed;
            bestStrategy = strategy;
        }
    }

    return { data: best, strategy: bestStrategy };
}

function generateLogForIco(ico, pngStats, deflateStats, colorCount, palette = null) {
    const view = new DataView(ico.buffer);
    const pngSize = ico.length - 22;

    const sizeHex = toHex(view.getUint32(14, true), 4).match(/.{2}/g).join(' ');
    const offsetHex = toHex(view.getUint32(18, true), 4).match(/.{2}/g).join(' ');

    let log = `[ICO HEADER] (22 Bytes)\n`;
    log += `- ${toHex(ico[0])} ${toHex(ico[1])}: Reserved\n`;
    log += `- ${toHex(ico[2])} ${toHex(ico[3])}: Type = 1 (icon)\n`;
    log += `- ${toHex(ico[4])} ${toHex(ico[5])}: Image count = 1\n`;
    log += `- ${toHex(ico[6])}: Width = 16\n`;
    log += `- ${toHex(ico[7])}: Height = 16\n`;
    log += `- ${toHex(ico[8])}: Color count = ${colorCount >= 256 ? 0 : colorCount}\n`;
    log += `- ${toHex(ico[9])}: Reserved\n`;
    log += `- ${toHex(ico[10])} ${toHex(ico[11])}: Planes = 1\n`;
    log += `- ${toHex(ico[12])} ${toHex(ico[13])}: Bit count = ${view.getUint16(12, true)}\n`;
    log += `- ${sizeHex}: Image data size = ${pngSize}\n`;
    log += `- ${offsetHex}: Offset to image = 22\n\n`;

    log += `Optimal zlib Strategy: ${deflateStats.strategy} (${STRATEGY_NAMES[deflateStats.strategy]})\n\n`;

    log += `[PNG PAYLOAD SUMMARY] (${pngSize} Bytes)\n`;
    log += `- Signature: 8 bytes\n`;
    log += `- IHDR Chunk: ${pngStats.ihdr} bytes\n`;
    if (pngStats.plte) log += `- PLTE Chunk: ${pngStats.plte} bytes\n`;
    if (pngStats.trns) log += `- tRNS Chunk: ${pngStats.trns} bytes\n`;
    log += `- IDAT Chunk: ${pngStats.idat} bytes (Compressed)\n`;
    log += `- IEND Chunk: ${pngStats.iend} bytes\n`;

    if (palette) {
        const plteDataLen = palette.length * 3;
        const plteTotalLen = plteDataLen + 12;
        const plteData = new Uint8Array(plteDataLen);

        log += `\n[PLTE CHUNK] (${plteTotalLen} Bytes)\n`;
        log += `- ${toHex(plteDataLen, 4).match(/.{2}/g).join(' ')}: Chunk Length = ${plteDataLen}\n`;
        log += `- 50 4C 54 45: Chunk Type = "PLTE"\n`;

        palette.forEach((c, i) => {
            plteData[i*3] = c.r; plteData[i*3+1] = c.g; plteData[i*3+2] = c.b;
            log += `- ${toHex(c.r)} ${toHex(c.g)} ${toHex(c.b)}: Index ${i} (#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)})\n`;
        });

        const plteCrc = crc32("PLTE", plteData);
        log += `- ${toHex(plteCrc, 4).match(/.{2}/g).join(' ')}: CRC32\n`;

        // If the transparent color exists (and our logic assigns it to Index 0)
        if (palette.length > 0 && palette[0].a < 255) {
            const tAlpha = palette[0].a;
            log += `\n[tRNS CHUNK] (13 Bytes)\n`;
            log += `- 00 00 00 01: Chunk Length = 1\n`;
            log += `- 74 52 4E 53: Chunk Type = "tRNS"\n`;
            log += `- ${toHex(tAlpha)}: Alpha for Index 0\n`;

            const trnsData = new Uint8Array([tAlpha]);
            const trnsCrc = crc32("tRNS", trnsData);
            log += `- ${toHex(trnsCrc, 4).match(/.{2}/g).join(' ')}: CRC32\n`;
        }
    }

    return log;
}

function renderPreviews(icoBytes, container) {
    container.innerHTML = '';
    if (!icoBytes) return;

    const blob = new Blob([icoBytes], { type: 'image/x-icon' });
    const url = URL.createObjectURL(blob);
    activeObjectUrls.push(url);

    ['bg-white', 'bg-grey', 'bg-black'].forEach(bgClass => {
        const box = document.createElement('div');
        box.className = `preview-box ${bgClass}`;

        const img = document.createElement('img');
        img.src = url;

        box.appendChild(img);
        container.appendChild(box);
    });
}

/**
 * Extracts a unique palette from the given pixels.
 * Prioritizes placing the first transparent color at index 0 for optimal PNG tRNS chunk encoding.
 */
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

/**
 * Generates a 32-bit Truecolor (RGBA) ICO payload.
 * Guarantees high fidelity for images exceeding indexed color limits.
 */
function generateTruecolor(colors) {
    const truecolorPixels = new Uint8Array(16 * (1 + 16 * 4));
    let tcWritePos = 0;
    for (let y = 0; y < 16; y++) {
        truecolorPixels[tcWritePos++] = 0; // Filter 0 (None)
        for (let x = 0; x < 16; x++) {
            const c = colors[y * 16 + x];
            truecolorPixels[tcWritePos++] = c.r;
            truecolorPixels[tcWritePos++] = c.g;
            truecolorPixels[tcWritePos++] = c.b;
            truecolorPixels[tcWritePos++] = c.a;
        }
    }

    const deflateStats = bestDeflate(truecolorPixels);
    const png = buildPNG(16, 16, 8, 6, deflateStats.data, null, null);
    const ico = assembleICO(png.payload, 0, 32);

    return { ico, png, deflateStats };
}

/**
 * Generates an optimized 1, 2, or 4-bit Indexed ICO payload.
 * Returns null if the palette exceeds the 16-color limit.
 */
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
        packedPixels[idxWritePos++] = 0; // Filter 0 (None)

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

    const deflateStats = bestDeflate(packedPixels);
    const tAlpha = transparentIndex === 0 ? palette[0].a : null;
    const png = buildPNG(16, 16, bitDepth, 3, deflateStats.data, palette, tAlpha);
    const ico = assembleICO(png.payload, palette.length, bitDepth);

    return { ico, png, deflateStats, bitDepth };
}

/**
 * Updates the DOM and visualization panels based on generated binary payloads.
 */
function updateOutputUI({ truecolorResult, indexedResult, palette }) {
    // Clear old URLs to prevent memory leaks during rapid regeneration
    activeObjectUrls.forEach(url => URL.revokeObjectURL(url));
    activeObjectUrls = [];

    // Update Truecolor UI
    elements.titleTruecolor.textContent = `Truecolor RGBA: ${truecolorResult.ico.length} bytes`;
    elements.logTruecolor.textContent = generateLogForIco(
        truecolorResult.ico,
        truecolorResult.png.stats,
        truecolorResult.deflateStats,
        0
    );
    renderPreviews(truecolorResult.ico, elements.previewTruecolor);

    // Update Indexed UI
    if (indexedResult) {
        elements.titleIndexed.textContent = `Optimized Indexed (${indexedResult.bitDepth}-bit): ${indexedResult.ico.length} bytes`;
        elements.logIndexed.textContent = generateLogForIco(
            indexedResult.ico,
            indexedResult.png.stats,
            indexedResult.deflateStats,
            palette.length,
            palette
        );
        renderPreviews(indexedResult.ico, elements.previewIndexed);
    } else {
        elements.titleIndexed.textContent = `Optimized Indexed: N/A`;
        elements.logIndexed.textContent = `Skipped: Image has more than 16 colors.`;
        renderPreviews(null, elements.previewIndexed);
    }

    elements.outputPanel.style.display = 'grid';
}

elements.btnGenerate.addEventListener('click', () => {
    try {
        const colors = state.pixels.map(parseColor);
        const { palette, transparentIndex } = extractPalette(colors);

        const truecolorResult = generateTruecolor(colors);
        const indexedResult = generateIndexed(colors, palette, transparentIndex);

        updateOutputUI({ truecolorResult, indexedResult, palette });
    } catch (err) {
        console.error(err);
        alert("An error occurred during generation.");
    }
});

// --- PNG & ICO Assemblers ---

function buildPNG(w, h, bitDepth, colorType, compressedIdat, palette, transparentAlpha) {
    const pngSignature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    const ihdrData = new Uint8Array(13);
    const ihdrView = new DataView(ihdrData.buffer);
    ihdrView.setUint32(0, w, false);
    ihdrView.setUint32(4, h, false);
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

    const idatChunk = createChunk('IDAT', compressedIdat);
    const iendChunk = createChunk('IEND', new Uint8Array(0));

    const chunks = [pngSignature, ihdrChunk, plteChunk, trnsChunk, idatChunk, iendChunk].filter(Boolean);
    const size = chunks.reduce((sum, c) => sum + c.length, 0);
    const payload = new Uint8Array(size);
    let offset = 0;
    chunks.forEach(c => { payload.set(c, offset); offset += c.length; });

    return {
        payload,
        stats: {
            ihdr: ihdrChunk.length,
            plte: plteChunk ? plteChunk.length : 0,
            trns: trnsChunk ? trnsChunk.length : 0,
            idat: idatChunk.length,
            iend: iendChunk.length
        }
    };
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

function createChunk(type, data) {
    const chunk = new Uint8Array(4 + 4 + data.length + 4);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
    chunk.set(data, 8);
    view.setUint32(8 + data.length, crc32(type, data), false);
    return chunk;
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    crcTable[i] = c;
}

function crc32(type, data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < 4; i++) crc = crcTable[(crc ^ type.charCodeAt(i)) & 0xFF] ^ (crc >>> 8);
    for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// --- Boot ---
initGrid();
