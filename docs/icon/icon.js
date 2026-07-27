import elm from './elements.mjs';
import { buildPNG, formatPNGLog } from './png.mjs';

// --- Configuration & Constants ---
const CONFIG = {
    gridSize: 16
};
CONFIG.totalPixels = CONFIG.gridSize * CONFIG.gridSize;

// --- State Variables: The Single Source of Truth ---
// 1024 bytes: [R, G, B, A,  R, G, B, A, ...]
const pixelBuffer = new Uint8ClampedArray(CONFIG.totalPixels * 4);
const pixelView = new DataView(pixelBuffer.buffer); // 32-bit accessor for the buffer

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

// Convert #RRGGBB to a single 32-bit unsigned integer: 0xRRGGBBAA
function hexToColor32(hex) {
    if (!hex) return 0x00000000; // Eraser / transparent
    const rgb = parseInt(hex.slice(1), 16);
    // Shift RGB left by 8 bits to make room for 0xFF Alpha, force unsigned
    return ((rgb << 8) | 0xFF) >>> 0;
}

const state = new Proxy({
    currentColor: elm.colorPicker.value,
    currentColor32: hexToColor32(elm.colorPicker.value), // Cache the 32-bit integer
    isDrawing: false
}, {
    set(target, property, value) {
        if (target[property] === value) return true;
        target[property] = value;

        if (property === 'currentColor') {
            target.currentColor32 = hexToColor32(value);
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
function setPixel(pixelIndex, color32) {
    const byteOffset = pixelIndex * 4;

    // 1. One fast 32-bit equality check!
    if (pixelView.getUint32(byteOffset) === color32) return;

    // 2. One fast 32-bit assignment!
    pixelView.setUint32(byteOffset, color32);

    // 3. Update the UI
    const hexColor = color32 === 0 ? 'transparent' :
        `#${(color32 >>> 8).toString(16).padStart(6, '0')}`;

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
                setPixel(i, 0);
            } else {
                const r = imgData[offset];
                const g = imgData[offset + 1];
                const b = imgData[offset + 2];

                // Solid pixel: Shift R, G, B into their respective 32-bit slots, add 0xFF for Alpha, force unsigned
                const color32 = ((r << 24) | (g << 16) | (b << 8) | 0xFF) >>> 0;
                setPixel(i, color32);
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
        setPixel(index, state.currentColor32);
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

function generateLogForIco(ico, deflateStats) {
    const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);

    // Utilities to safely read bytes from the binary and convert to hex
    const readHex = (start, len) => {
        let res = [];
        for (let i = 0; i < len; i++) res.push(toHex(view.getUint8(start + i)));
        return res.join(' ');
    };

    // --- Parse ICO Header (Little Endian) ---
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

    // Delegate PNG parsing to png.mjs (Zero-copy subarray)
    const pngSlice = ico.subarray(22);
    log += formatPNGLog(pngSlice);

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

    const { payload: pngPayload, deflateStats } = buildPNG({
        width: 16,
        height: 16,
        bitDepth: 8,
        colorType: 6,
        uncompressedPixels: truecolorPixels
    });

    const ico = assembleICO(pngPayload, 0, 32);

    return { ico, pngPayload, deflateStats };
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

    return { ico, pngPayload, deflateStats, bitDepth };
}

function updateOutputUI({ truecolorResult, indexedResult }) {
    objectUrlManager.revokeAll();

    elm.titleTruecolor.textContent = `Truecolor RGBA: ${truecolorResult.ico.length} bytes`;
    elm.logTruecolor.textContent = generateLogForIco(truecolorResult.ico, truecolorResult.deflateStats);
    renderPreviews(truecolorResult.ico, elm.previewTruecolor);

    currentDownloads.tcIco = truecolorResult.ico;
    currentDownloads.tcPng = truecolorResult.pngPayload;
    elm.sizeTcIco.textContent = `${truecolorResult.ico.length.toLocaleString()} bytes`;
    elm.sizeTcPng.textContent = `${truecolorResult.pngPayload.length.toLocaleString()} bytes`;

    if (indexedResult) {
        elm.titleIndexed.textContent = `Optimized Indexed (${indexedResult.bitDepth}-bit): ${indexedResult.ico.length} bytes`;
        elm.logIndexed.textContent = generateLogForIco(indexedResult.ico, indexedResult.deflateStats);
        renderPreviews(indexedResult.ico, elm.previewIndexed);

        currentDownloads.idxIco = indexedResult.ico;
        currentDownloads.idxPng = indexedResult.pngPayload;
        elm.sizeIdxIco.textContent = `${indexedResult.ico.length.toLocaleString()} bytes`;
        elm.sizeIdxPng.textContent = `${indexedResult.pngPayload.length.toLocaleString()} bytes`;

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

        updateOutputUI({ truecolorResult, indexedResult });
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

// --- ICO Assembler ---
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

// --- Boot ---
initGrid();
