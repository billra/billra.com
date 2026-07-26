import pako from 'https://esm.sh/pako@2.2.0';
import elm from './elements.mjs';

// --- Configuration & Constants ---
const CONFIG = {
    gridSize: 16
};
CONFIG.totalPixels = CONFIG.gridSize * CONFIG.gridSize;

// --- State Variables: The Single Source of Truth ---
// 1024 bytes: [R, G, B, A,  R, G, B, A, ...]
const pixelBuffer = new Uint8ClampedArray(CONFIG.totalPixels * 4);
const pixels = []; // DOM cache for the grid cells
const currentDownloads = { idxIco: null, idxPng: null, tcIco: null, tcPng: null };

/**
 * Safely manages Blob Object URLs to prevent memory leaks during rapid regeneration.
 */
const objectUrlManager = (() => {
    const urls = new Set();
    return {
        create(blob) {
            const url = URL.createObjectURL(blob);
            urls.add(url);
            return url;
        },
        revokeAll() {
            urls.forEach(url => URL.revokeObjectURL(url));
            urls.clear();
        }
    };
})();

// --- Inject Metadata ---
if (elm.pageTitle) elm.pageTitle.textContent = document.title;
const versionMeta = document.querySelector('meta[name="version"]');
if (versionMeta && elm.version) elm.version.textContent = `v${versionMeta.content}`;

// --- UI Updaters ---
function updatePixelUI(index, color) {
    if (pixels[index]) {
        pixels[index].style.backgroundColor = color || 'transparent';
    }
}

function updateToolUI(color) {
    if (color === null) {
        elm.colorPicker.classList.remove('active-tool');
        elm.btnEraser.classList.add('active-tool');
    } else {
        elm.btnEraser.classList.remove('active-tool');
        elm.colorPicker.classList.add('active-tool');
        elm.colorPicker.value = color;
    }
}

// Helper to translate the UI color picker (#RRGGBB) to an RGBA array
function hexToRGBA(hex) {
    if (!hex) return [0, 0, 0, 0]; // Eraser / transparent
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 255];
}

const state = new Proxy({
    currentColor: elm.colorPicker.value,
    currentRGBA: hexToRGBA(elm.colorPicker.value), // Cache the byte values
    isDrawing: false
}, {
    set(target, property, value) {
        if (target[property] === value) return true;
        target[property] = value;

        if (property === 'currentColor') {
            target.currentRGBA = hexToRGBA(value);
            updateToolUI(value);
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

        pixels.push(pixel);
        elm.gridContainer.appendChild(pixel);
    }
}

// --- Painting Logic ---
function setPixel(pixelIndex, rgba) {
    const offset = pixelIndex * 4;

    // 1. Bail early if the color isn't actually changing (saves DOM repaints)
    if (
        pixelBuffer[offset] === rgba[0] &&
        pixelBuffer[offset + 1] === rgba[1] &&
        pixelBuffer[offset + 2] === rgba[2] &&
        pixelBuffer[offset + 3] === rgba[3]
    ) return;

    // 2. Update the Source of Truth
    pixelBuffer[offset] = rgba[0];
    pixelBuffer[offset + 1] = rgba[1];
    pixelBuffer[offset + 2] = rgba[2];
    pixelBuffer[offset + 3] = rgba[3];

    // 3. Update the UI
    const hexColor = rgba[3] === 0 ? 'transparent' :
        `#${((1 << 24) + (rgba[0] << 16) + (rgba[1] << 8) + rgba[2]).toString(16).slice(1)}`;

    updatePixelUI(pixelIndex, hexColor);
}

// --- File Drag & Drop Handling ---
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

elm.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elm.dropzone.classList.add('dragover');
});

elm.dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    elm.dropzone.classList.remove('dragover');
});

elm.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    elm.dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]);
});

elm.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) processFile(e.target.files[0]);
});

function processFile(file) {
    if (!file.type.startsWith('image/')) {
        alert("Please drop an image file.");
        return;
    }

    elm.outputPanel.style.display = 'none';
    const sizeBytes = file.size.toLocaleString();

    const img = new Image();
    img.onload = () => {
        elm.dropzoneText.innerHTML = `
            <span style="color: #0f0;">Loaded: ${file.name}</span><br>
            ${img.width}x${img.height} pixels • ${sizeBytes} bytes
        `;

        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, 16, 16);

        // Extract the raw RGBA array from the canvas
        const imgData = ctx.getImageData(0, 0, 16, 16).data;

        for (let i = 0; i < CONFIG.totalPixels; i++) {
            const offset = i * 4;
            const a = imgData[offset + 3];

            if (a < 128) {
                // Transparent threshold
                setPixel(i, [0, 0, 0, 0]);
            } else {
                // Solid pixel: grab RGB from the canvas data, force Alpha to 255
                setPixel(i, [imgData[offset], imgData[offset + 1], imgData[offset + 2], 255]);
            }
        }

        URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
}

// --- Interaction Handlers ---
const handlePaint = (e) => {
    if (!state.isDrawing) return;
    const target = e.target.closest('.pixel');
    if (target) {
        const index = parseInt(target.dataset.index, 10);
        setPixel(index, state.currentRGBA);
    }
};

elm.colorPicker.addEventListener('input', (e) => state.currentColor = e.target.value);
elm.colorPicker.addEventListener('click', (e) => state.currentColor = e.target.value);
elm.btnEraser.addEventListener('click', () => state.currentColor = null);

elm.gridContainer.addEventListener('pointerdown', (e) => {
    state.isDrawing = true;
    handlePaint(e);
});
elm.gridContainer.addEventListener('pointerover', handlePaint);
window.addEventListener('pointerup', () => state.isDrawing = false);

// --- Generation Logic ---
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

// --- Magnifier Initialization ---
const magnifier = document.createElement('div');
magnifier.className = 'magnifier';
const magnifierImg = document.createElement('img');
magnifier.appendChild(magnifierImg);
document.body.appendChild(magnifier);

// --- Render Previews ---
function renderPreviews(icoBytes, container) {
    container.innerHTML = '';
    if (!icoBytes) return;

    const label = document.createElement('span');
    label.className = 'preview-label';
    label.textContent = '🔍 samples:';
    container.appendChild(label);

    const blob = new Blob([icoBytes], { type: 'image/x-icon' });
    const url = objectUrlManager.create(blob);
    const backgrounds = ['bg-white', 'bg-grey', 'bg-black', 'bg-red', 'bg-green', 'bg-blue'];

    backgrounds.forEach(bgClass => {
        const box = document.createElement('div');
        box.className = `preview-box ${bgClass}`;

        const img = document.createElement('img');
        img.src = url;

        box.appendChild(img);
        container.appendChild(box);

        box.addEventListener('mouseenter', () => {
            magnifier.style.display = 'block';
            magnifier.className = `magnifier ${bgClass}`;
            magnifierImg.src = url;
        });

        box.addEventListener('mousemove', (e) => {
            magnifier.style.left = `${e.clientX + 15}px`;
            magnifier.style.top = `${e.clientY - 15}px`;
        });

        box.addEventListener('mouseleave', () => {
            magnifier.style.display = 'none';
        });
    });
}

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

    const deflateStats = bestDeflate(truecolorPixels);
    const png = buildPNG(16, 16, 8, 6, deflateStats.data, null, null);
    const ico = assembleICO(png.payload, 0, 32);

    return { ico, png, deflateStats };
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

    const deflateStats = bestDeflate(packedPixels);
    const tAlpha = transparentIndex === 0 ? palette[0].a : null;
    const png = buildPNG(16, 16, bitDepth, 3, deflateStats.data, palette, tAlpha);
    const ico = assembleICO(png.payload, palette.length, bitDepth);

    return { ico, png, deflateStats, bitDepth };
}

function updateOutputUI({ truecolorResult, indexedResult, palette }) {
    objectUrlManager.revokeAll();

    elm.titleTruecolor.textContent = `Truecolor RGBA: ${truecolorResult.ico.length} bytes`;
    elm.logTruecolor.textContent = generateLogForIco(truecolorResult.ico, truecolorResult.png.stats, truecolorResult.deflateStats, 0);
    renderPreviews(truecolorResult.ico, elm.previewTruecolor);

    currentDownloads.tcIco = truecolorResult.ico;
    currentDownloads.tcPng = truecolorResult.png.payload;
    elm.sizeTcIco.textContent = `${truecolorResult.ico.length.toLocaleString()} bytes`;
    elm.sizeTcPng.textContent = `${truecolorResult.png.payload.length.toLocaleString()} bytes`;

    if (indexedResult) {
        elm.titleIndexed.textContent = `Optimized Indexed (${indexedResult.bitDepth}-bit): ${indexedResult.ico.length} bytes`;
        elm.logIndexed.textContent = generateLogForIco(indexedResult.ico, indexedResult.png.stats, indexedResult.deflateStats, palette.length, palette);
        renderPreviews(indexedResult.ico, elm.previewIndexed);

        currentDownloads.idxIco = indexedResult.ico;
        currentDownloads.idxPng = indexedResult.png.payload;
        elm.sizeIdxIco.textContent = `${indexedResult.ico.length.toLocaleString()} bytes`;
        elm.sizeIdxPng.textContent = `${indexedResult.png.payload.length.toLocaleString()} bytes`;

        elm.btnSaveIdxIco.disabled = false;
        elm.btnSaveIdxPng.disabled = false;
    } else {
        elm.titleIndexed.textContent = `Optimized Indexed: N/A`;
        elm.logIndexed.textContent = `Skipped: Image has more than 16 colors.`;
        renderPreviews(null, elm.previewIndexed);

        currentDownloads.idxIco = null;
        currentDownloads.idxPng = null;
        elm.sizeIdxIco.textContent = `N/A`;
        elm.sizeIdxPng.textContent = `N/A`;

        elm.btnSaveIdxIco.disabled = true;
        elm.btnSaveIdxPng.disabled = true;
    }

    elm.outputPanel.style.display = 'flex';
}

elm.btnGenerate.addEventListener('click', () => {
    try {
        const colors = [];
        for (let i = 0; i < CONFIG.totalPixels; i++) {
            const offset = i * 4;
            colors.push({
                r: pixelBuffer[offset],
                g: pixelBuffer[offset + 1],
                b: pixelBuffer[offset + 2],
                a: pixelBuffer[offset + 3]
            });
        }

        const { palette, transparentIndex } = extractPalette(colors);
        const truecolorResult = generateTruecolor(colors);
        const indexedResult = generateIndexed(colors, palette, transparentIndex);

        updateOutputUI({ truecolorResult, indexedResult, palette });
    } catch (err) {
        console.error(err);
        alert("An error occurred during generation.");
    }
});

// --- Save & Download Logic ---
function triggerDownload(data, filename, type) {
    if (!data) return;
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

elm.btnSaveIdxIco.addEventListener('click', () => triggerDownload(currentDownloads.idxIco, 'favicon-indexed.ico', 'image/x-icon'));
elm.btnSaveIdxPng.addEventListener('click', () => triggerDownload(currentDownloads.idxPng, 'favicon-indexed.png', 'image/png'));
elm.btnSaveTcIco.addEventListener('click', () => triggerDownload(currentDownloads.tcIco, 'favicon-truecolor.ico', 'image/x-icon'));
elm.btnSaveTcPng.addEventListener('click', () => triggerDownload(currentDownloads.tcPng, 'favicon-truecolor.png', 'image/png'));

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

// --- Boot ---
initGrid();
