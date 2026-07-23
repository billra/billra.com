import pako from 'https://esm.sh/pako@2.2.0';

/// --- Configuration & Constants ---
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
    outputLog: document.getElementById('output-log'),
    pixels: []
};

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

function generateLogForIco(name, ico, pngStats, deflateStats, colorCount) {
    const view = new DataView(ico.buffer);
    const pngSize = ico.length - 22;
    let log = `--- ${name} ---\n`;
    log += `Total File Size: ${ico.length} bytes\n`;
    log += `Winning zlib Strategy: ${deflateStats.strategy} (${STRATEGY_NAMES[deflateStats.strategy]})\n\n`;

    log += `[ICO HEADER] (22 Bytes)\n`;
    log += `- ${toHex(ico[0])} ${toHex(ico[1])}: Reserved\n`;
    log += `- ${toHex(ico[2])} ${toHex(ico[3])}: Type = 1 (icon)\n`;
    log += `- ${toHex(ico[4])} ${toHex(ico[5])}: Image count = 1\n`;
    log += `- ${toHex(ico[6])}: Width = 16\n`;
    log += `- ${toHex(ico[7])}: Height = 16\n`;
    log += `- ${toHex(ico[8])}: Color count = ${colorCount >= 256 ? 0 : colorCount}\n`;
    log += `- ${toHex(ico[9])}: Reserved\n`;
    log += `- ${toHex(ico[10])} ${toHex(ico[11])}: Planes = 1\n`;
    log += `- ${toHex(ico[12])} ${toHex(ico[13])}: Bit count = ${view.getUint16(12, true)}\n`;
    log += `- ${toHex(view.getUint32(14, true), 4)}: Image data size = 0x${toHex(pngSize, 4)} = ${pngSize} bytes\n`;
    log += `- ${toHex(view.getUint32(18, true), 4)}: Offset to image = 0x16 = 22 bytes\n\n`;

    log += `[PNG PAYLOAD] (${pngSize} Bytes)\n`;
    log += `- Signature: 8 bytes\n`;
    log += `- IHDR Chunk: ${pngStats.ihdr} bytes\n`;
    if (pngStats.plte) log += `- PLTE Chunk: ${pngStats.plte} bytes\n`;
    if (pngStats.trns) log += `- tRNS Chunk: ${pngStats.trns} bytes\n`;
    log += `- IDAT Chunk: ${pngStats.idat} bytes (Compressed Data)\n`;
    log += `- IEND Chunk: ${pngStats.iend} bytes\n\n`;

    return log;
}

elements.btnGenerate.addEventListener('click', () => {
    try {
        const colors = state.pixels.map(parseColor);
        const palette = [];
        let transparentIndex = -1;

        const findColor = (r, g, b, a) => palette.findIndex(c => c.r === r && c.g === g && c.b === b && c.a === a);

        // 1. Extract Palette
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

        // Handle empty canvas
        if (palette.length === 0) {
            palette.push({ r: 0, g: 0, b: 0, a: 0 });
            transparentIndex = 0;
        }

        let mainLog = `=== PALETTE EXTRACTED ===\n`;
        mainLog += `Colors Used: ${palette.length}\n`;
        palette.forEach((c, i) => {
            const hex = `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
            const isTransparent = (i === 0 && transparentIndex === 0) ? " <-- tRNS (Transparent)" : "";
            mainLog += `  [${i}] ${hex}${isTransparent}\n`;
        });
        mainLog += `\n`;

        // --- PATH A: TRUECOLOR (32-bit RGBA) ---
        const truecolorPixels = new Uint8Array(16 * (1 + 16 * 4));
        let tcWritePos = 0;
        for (let y = 0; y < 16; y++) {
            truecolorPixels[tcWritePos++] = 0; // Filter 0
            for (let x = 0; x < 16; x++) {
                const c = colors[y * 16 + x];
                truecolorPixels[tcWritePos++] = c.r;
                truecolorPixels[tcWritePos++] = c.g;
                truecolorPixels[tcWritePos++] = c.b;
                truecolorPixels[tcWritePos++] = c.a;
            }
        }

        const tcDeflate = bestDeflate(truecolorPixels);
        const tcPng = buildPNG(16, 16, 8, 6, tcDeflate.data, null, null);
        const tcIco = assembleICO(tcPng.payload, 0, 32);

        // --- PATH B: OPTIMAL INDEXED ---
        let idxIco = null;
        let idxPng = null;
        let bitDepth = 0;
        let idxDeflate = null;

        if (palette.length <= 16) {
            if (palette.length <= 2) bitDepth = 1;
            else if (palette.length <= 4) bitDepth = 2;
            else bitDepth = 4;

            const pixelsPerByte = 8 / bitDepth;
            const bytesPerRow = Math.ceil(16 / pixelsPerByte);
            const packedPixels = new Uint8Array(16 * (1 + bytesPerRow));

            let idxWritePos = 0;
            for (let y = 0; y < 16; y++) {
                packedPixels[idxWritePos++] = 0; // Filter 0

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

            idxDeflate = bestDeflate(packedPixels);
            idxPng = buildPNG(16, 16, bitDepth, 3, idxDeflate.data, palette, transparentIndex === 0 ? palette[0].a : null);
            idxIco = assembleICO(idxPng.payload, palette.length, bitDepth);
        }

        // --- RENDER LOG ---
        if (idxIco) {
            mainLog += generateLogForIco(`OPTIMAL INDEXED (${bitDepth}-bit)`, idxIco, idxPng.stats, idxDeflate, palette.length);
        } else {
            mainLog += `--- OPTIMAL INDEXED ---\nSkipped: Image has more than 16 colors.\n\n`;
        }

        mainLog += generateLogForIco(`TRUECOLOR (32-bit RGBA)`, tcIco, tcPng.stats, tcDeflate, 0);

        const winner = (idxIco && idxIco.length < tcIco.length) ? `Indexed (${bitDepth}-bit)` : 'Truecolor (32-bit)';
        mainLog += `=================================\n`;
        mainLog += `WINNING COMPRESSION: ${winner}\n`;
        mainLog += `=================================\n`;

        elements.outputLog.textContent = mainLog;
        elements.outputPanel.style.display = 'block';

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
