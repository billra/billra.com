import dom from './dom.mjs';

// --- Internal State ---
const generatedAssets = {
    indexedIco: null,
    indexedPng: null,
    truecolorIco: null,
    truecolorPng: null
};

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

// --- Magnifier Initialization ---
const magnifier = document.createElement('div');
magnifier.className = 'magnifier';
const magnifierImg = document.createElement('img');
magnifier.appendChild(magnifierImg);
document.body.appendChild(magnifier);

// --- Render Previews ---
function renderPreviews(icoBuffer, containerElement) {
    containerElement.innerHTML = '';
    if (!icoBuffer) return;

    const label = document.createElement('span');
    label.className = 'preview-label';
    label.textContent = '🔍 samples:';
    containerElement.appendChild(label);

    const blob = new Blob([icoBuffer], { type: 'image/x-icon' });
    const url = objectUrlManager.create(blob);
    const backgrounds = ['bg-white', 'bg-grey', 'bg-black', 'bg-red', 'bg-green', 'bg-blue'];

    backgrounds.forEach(bgClass => {
        const box = document.createElement('div');
        box.className = `preview-box ${bgClass}`;

        const img = document.createElement('img');
        img.src = url;

        box.appendChild(img);
        containerElement.appendChild(box);

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

// --- Main Exported UI Updater ---
export function updateOutputUI({ truecolorResult, indexedResult }) {
    objectUrlManager.revokeAll();

    dom.titleTruecolor.textContent = `Truecolor RGBA: ${truecolorResult.icoBuffer.length} bytes`;
    dom.logTruecolor.textContent = truecolorResult.log;
    renderPreviews(truecolorResult.icoBuffer, dom.previewTruecolor);

    generatedAssets.truecolorIco = truecolorResult.icoBuffer;
    generatedAssets.truecolorPng = truecolorResult.pngBuffer;
    dom.sizeTcIco.textContent = `${truecolorResult.icoBuffer.length.toLocaleString()} bytes`;
    dom.sizeTcPng.textContent = `${truecolorResult.pngBuffer.length.toLocaleString()} bytes`;

    if (indexedResult) {
        dom.titleIndexed.textContent = `Optimized Indexed (${indexedResult.bitDepth}-bit): ${indexedResult.icoBuffer.length} bytes`;
        dom.logIndexed.textContent = indexedResult.log;
        renderPreviews(indexedResult.icoBuffer, dom.previewIndexed);

        generatedAssets.indexedIco = indexedResult.icoBuffer;
        generatedAssets.indexedPng = indexedResult.pngBuffer;
        dom.sizeIdxIco.textContent = `${indexedResult.icoBuffer.length.toLocaleString()} bytes`;
        dom.sizeIdxPng.textContent = `${indexedResult.pngBuffer.length.toLocaleString()} bytes`;

        dom.btnSaveIdxIco.disabled = false;
        dom.btnSaveIdxPng.disabled = false;
    } else {
        dom.titleIndexed.textContent = `Optimized Indexed: N/A`;
        dom.logIndexed.textContent = `Skipped: Image has more than 16 colors.`;
        renderPreviews(null, dom.previewIndexed);

        generatedAssets.indexedIco = null;
        generatedAssets.indexedPng = null;
        dom.sizeIdxIco.textContent = `N/A`;
        dom.sizeIdxPng.textContent = `N/A`;

        dom.btnSaveIdxIco.disabled = true;
        dom.btnSaveIdxPng.disabled = true;
    }

    dom.outputPanel.style.display = 'flex';
}

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

dom.btnSaveIdxIco.addEventListener('click', () => triggerDownload(generatedAssets.indexedIco, 'favicon-indexed.ico', 'image/x-icon'));
dom.btnSaveIdxPng.addEventListener('click', () => triggerDownload(generatedAssets.indexedPng, 'favicon-indexed.png', 'image/png'));
dom.btnSaveTcIco.addEventListener('click', () => triggerDownload(generatedAssets.truecolorIco, 'favicon-truecolor.ico', 'image/x-icon'));
dom.btnSaveTcPng.addEventListener('click', () => triggerDownload(generatedAssets.truecolorPng, 'favicon-truecolor.png', 'image/png'));
