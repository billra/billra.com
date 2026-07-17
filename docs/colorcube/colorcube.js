/// --- Configuration & Constants ---
const CONFIG = {
    viewBoxWidth: 1000,
    viewBoxHeight: 800,
    baseEdgeLength: 320,
    LEVELS: 16, // Scale the resolution of the entire application
    get MAX_LEVEL() { return this.LEVELS - 1; },
    get MULTIPLIER() { return 255 / this.MAX_LEVEL; },
    SVG_NS: 'http://www.w3.org/2000/svg'
};

// --- State Management ---
let currentLevel = CONFIG.MAX_LEVEL;
let baseRay = [15, 7, 0];
let isZoomed = false;

// --- DOM Elements ---
const svg = document.getElementById('app-svg');
const coreGroup = document.getElementById('core-sample-group');
const cubeGroup = document.getElementById('cube-group');
const highlightGroup = document.getElementById('highlight-group');
const hoverCube = document.getElementById('hover-cube');
const hoverCore = document.getElementById('hover-core');
const zoomCheckbox = document.getElementById('zoom');
const pointerDisplay = document.getElementById('pointer-display');

// --- Inject Title and Version ---
document.getElementById('page-title').textContent = document.title;
const versionMeta = document.querySelector('meta[name="version"]');
document.getElementById('version').textContent = `v${versionMeta.content}`;

// --- Math Helpers ---
function rgbToShortHex(r, g, b) {
    const hexDigit = (c) => Math.floor(c / 17).toString(16).toUpperCase();
    return `#${hexDigit(r)}${hexDigit(g)}${hexDigit(b)}`;
}

// --- DOM Generators ---
function createSVGElement(tag, attributes = {}) {
    const el = document.createElementNS(CONFIG.SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) {
        el.setAttribute(key, value);
    }
    return el;
}

// --- Render Logic ---
function renderScene() {
    // Clear previous renders
    coreGroup.innerHTML = '';
    cubeGroup.innerHTML = '';
    highlightGroup.innerHTML = '';

    renderCoreSample();
    renderCube();
}

function renderCoreSample() {
    const blockSize = 38;
    const spacing = 2;
    const totalHeight = CONFIG.LEVELS * (blockSize + spacing);

    const startX = 60;
    const startY = (CONFIG.viewBoxHeight - totalHeight) / 2;

    for (let i = CONFIG.MAX_LEVEL; i >= 0; i--) {
        const r = Math.round((baseRay[0] * i) / CONFIG.MAX_LEVEL);
        const g = Math.round((baseRay[1] * i) / CONFIG.MAX_LEVEL);
        const b = Math.round((baseRay[2] * i) / CONFIG.MAX_LEVEL);

        const dispR = r * CONFIG.MULTIPLIER;
        const dispG = g * CONFIG.MULTIPLIER;
        const dispB = b * CONFIG.MULTIPLIER;

        const yPos = startY + ((CONFIG.MAX_LEVEL - i) * (blockSize + spacing));
        const hexColor = rgbToShortHex(dispR, dispG, dispB);

        const rect = createSVGElement('rect', {
            x: startX,
            y: yPos,
            width: blockSize,
            height: blockSize,
            fill: hexColor,
            class: 'core-block',
            'data-level': i,
            'data-hex': hexColor
        });

        coreGroup.appendChild(rect);

        // Render the white active highlight purely in the foreground group
        if (i === currentLevel) {
            const highlight = createSVGElement('rect', {
                x: startX,
                y: yPos,
                width: blockSize,
                height: blockSize,
                class: 'highlight-outline'
            });
            highlightGroup.appendChild(highlight);
        }
    }
}

function renderCube() {
    const L = isZoomed ? CONFIG.baseEdgeLength : (CONFIG.baseEdgeLength * (currentLevel / CONFIG.MAX_LEVEL));

    const cx = (CONFIG.viewBoxWidth / 2) + 60;
    const cy = CONFIG.viewBoxHeight / 2 - 20;

    const axCyan = { x: L * Math.cos(7 * Math.PI / 6), y: L * Math.sin(7 * Math.PI / 6) };
    const axYellow = { x: L * Math.cos(11 * Math.PI / 6), y: L * Math.sin(11 * Math.PI / 6) };
    const axMagenta = { x: L * Math.cos(Math.PI / 2), y: L * Math.sin(Math.PI / 2) };

    const targetR = Math.round((baseRay[0] * currentLevel) / CONFIG.MAX_LEVEL);
    const targetG = Math.round((baseRay[1] * currentLevel) / CONFIG.MAX_LEVEL);
    const targetB = Math.round((baseRay[2] * currentLevel) / CONFIG.MAX_LEVEL);

    function buildFace(uAx, vAx, colorFn) {
        const steps = currentLevel + 1;

        for (let i = 0; i <= currentLevel; i++) {
            for (let j = 0; j <= currentLevel; j++) {
                const u1 = i / steps, u2 = (i + 1) / steps;
                const v1 = j / steps, v2 = (j + 1) / steps;

                const p1 = `${cx + u1*uAx.x + v1*vAx.x},${cy + u1*uAx.y + v1*vAx.y}`;
                const p2 = `${cx + u2*uAx.x + v1*vAx.x},${cy + u2*uAx.y + v1*vAx.y}`;
                const p3 = `${cx + u2*uAx.x + v2*vAx.x},${cy + u2*uAx.y + v2*vAx.y}`;
                const p4 = `${cx + u1*uAx.x + v2*vAx.x},${cy + u1*uAx.y + v2*vAx.y}`;
                const pointsStr = `${p1} ${p2} ${p3} ${p4}`;

                const [r, g, b] = colorFn(i, j);
                const isActive = (r === targetR && g === targetG && b === targetB);

                const dispR = r * CONFIG.MULTIPLIER;
                const dispG = g * CONFIG.MULTIPLIER;
                const dispB = b * CONFIG.MULTIPLIER;
                const hexColor = rgbToShortHex(dispR, dispG, dispB);

                const polygon = createSVGElement('polygon', {
                    points: pointsStr,
                    fill: `rgb(${dispR},${dispG},${dispB})`,
                    class: 'cube-face',
                    'data-r': r,
                    'data-g': g,
                    'data-b': b,
                    'data-hex': hexColor
                });

                cubeGroup.appendChild(polygon);

                if (isActive) {
                    const highlight = createSVGElement('polygon', {
                        points: pointsStr,
                        class: 'highlight-outline'
                    });
                    highlightGroup.appendChild(highlight);
                }
            }
        }
    }

    buildFace(axYellow, axMagenta, (i, j) => [currentLevel, currentLevel - j, currentLevel - i]); // Right
    buildFace(axCyan, axMagenta, (i, j) => [currentLevel - i, currentLevel - j, currentLevel]);   // Left
    buildFace(axCyan, axYellow, (i, j) => [currentLevel - i, currentLevel, currentLevel - j]);    // Top
}

// --- Interactive Logic ---

// Clicks: Core Sample
coreGroup.addEventListener('click', (e) => {
    const block = e.target.closest('.core-block');
    if (!block) return;

    currentLevel = parseInt(block.getAttribute('data-level'), 10);
    renderScene();
});

// Clicks: Cube
cubeGroup.addEventListener('click', (e) => {
    if (currentLevel === 0) return;

    const face = e.target.closest('.cube-face');
    if (!face) return;

    const r = parseInt(face.getAttribute('data-r'), 10);
    const g = parseInt(face.getAttribute('data-g'), 10);
    const b = parseInt(face.getAttribute('data-b'), 10);

    baseRay[0] = Math.min(CONFIG.MAX_LEVEL, Math.max(0, Math.round((r * CONFIG.MAX_LEVEL) / currentLevel)));
    baseRay[1] = Math.min(CONFIG.MAX_LEVEL, Math.max(0, Math.round((g * CONFIG.MAX_LEVEL) / currentLevel)));
    baseRay[2] = Math.min(CONFIG.MAX_LEVEL, Math.max(0, Math.round((b * CONFIG.MAX_LEVEL) / currentLevel)));

    renderScene();
});

// Hovers & Tooltips (Delegated from the parent SVG)
svg.addEventListener('pointerover', (e) => {
    const face = e.target.closest('.cube-face');
    const block = e.target.closest('.core-block');

    if (face) {
        hoverCube.setAttribute('points', face.getAttribute('points'));
        hoverCube.style.opacity = '1';

        pointerDisplay.innerText = face.getAttribute('data-hex');
        pointerDisplay.style.display = 'block';
    }
    else if (block) {
        hoverCore.setAttribute('x', block.getAttribute('x'));
        hoverCore.setAttribute('y', block.getAttribute('y'));
        hoverCore.setAttribute('width', block.getAttribute('width'));
        hoverCore.setAttribute('height', block.getAttribute('height'));
        hoverCore.style.opacity = '1';

        pointerDisplay.innerText = block.getAttribute('data-hex');
        pointerDisplay.style.display = 'block';
    }
});

svg.addEventListener('pointermove', (e) => {
    if (pointerDisplay.style.display === 'block') {
        pointerDisplay.style.left = `${e.clientX + 15}px`;
        pointerDisplay.style.top = `${e.clientY + 15}px`;
    }
});

svg.addEventListener('pointerout', (e) => {
    // We only hide everything if the pointer actually left a valid shape,
    // avoiding flicker when moving between adjacent blocks.
    const newTarget = e.relatedTarget?.closest('.cube-face, .core-block');
    if (!newTarget) {
        pointerDisplay.style.display = 'none';
        hoverCube.style.opacity = '0';
        hoverCore.style.opacity = '0';
    }
});

// Scroll Logic for Level Changes
window.addEventListener('wheel', (e) => {
    if (!e.target.closest('svg')) return;

    e.preventDefault();

    if (e.deltaY < 0 && currentLevel < CONFIG.MAX_LEVEL) {
        currentLevel++;
        renderScene();
    } else if (e.deltaY > 0 && currentLevel > 0) {
        currentLevel--;
        renderScene();
    }
}, { passive: false });

// Zoom Toggle
zoomCheckbox.addEventListener('change', (e) => {
    isZoomed = e.target.checked;
    renderScene();
});

// --- Initialization ---
renderScene();
