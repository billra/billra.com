/// --- Configuration & Constants ---
const CONFIG = {
    viewBoxWidth: 1000,
    viewBoxHeight: 800,
    baseEdgeLength: 320,
    layoutOffsetX: 60,
    LEVELS: 16, // Scale the resolution of the entire application (e.g., 8, 32, 64)
    get MAX_LEVEL() { return this.LEVELS - 1; },
    get MULTIPLIER() { return 255 / this.MAX_LEVEL; },
    SVG_NS: 'http://www.w3.org/2000/svg'
};

// --- State Management ---
let currentLevel = CONFIG.MAX_LEVEL;
let baseRay = [15, 7, 0];
let isZoomed = false;
let mouseX = -1; // Tracks global X coordinate for layout change evaluations
let mouseY = -1; // Tracks global Y coordinate for layout change evaluations

// --- DOM Elements ---
const svg = document.getElementById('app-svg');
svg.setAttribute(
    'viewBox',
    `0 0 ${CONFIG.viewBoxWidth} ${CONFIG.viewBoxHeight}`
);
const coreGroup = document.getElementById('core-sample-group');
const cubeGroup = document.getElementById('cube-group');
const highlightGroup = document.getElementById('highlight-group');
const hoverGroup = document.getElementById('hover-group');
const zoomCheckbox = document.getElementById('zoom');
const pointerDisplay = document.getElementById('pointer-display');

// --- Inject Title and Version ---
document.getElementById('page-title').textContent = document.title;
const versionMeta = document.querySelector('meta[name="version"]');
document.getElementById('version').textContent = `v${versionMeta.content}`;

// --- Math Helpers ---
/**
 * Converts standard 0-255 RGB values into a shorthand 3-digit hex string (#RGB).
 * Assumes inputs are perfectly scaled multiples of (255 / 15).
 */
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
    // Clear previous renders to prepare for new geometry
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

    // Position on the left side, vertically centered
    const startX = CONFIG.layoutOffsetX;
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

        // 1. Draw the base core block
        const rect = createSVGElement('rect', {
            x: startX,
            y: yPos,
            width: blockSize,
            height: blockSize,
            fill: hexColor,
            class: 'core-block', // styling
            'data-action': 'setLevel', // action
            'data-level': i,
            'data-hex': hexColor
        });

        coreGroup.appendChild(rect);

        // 2. Clone active geometry to the highlight layer to avoid clipping
        if (i === currentLevel) {
            const highlight = rect.cloneNode();
            highlight.setAttribute('class', 'highlight-outline');
            highlight.removeAttribute('fill');
            highlightGroup.appendChild(highlight);
        }
    }
}

function renderCube() {
    const L = isZoomed ? CONFIG.baseEdgeLength : (CONFIG.baseEdgeLength * (currentLevel / CONFIG.MAX_LEVEL));

    // Shift center slightly right to accommodate the core sample
    const cx = (CONFIG.viewBoxWidth / 2) + CONFIG.layoutOffsetX;
    const cy = CONFIG.viewBoxHeight / 2 - 20;

    // Isometric Axes Math
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

                // 1. Draw the base face polygon
                const polygon = createSVGElement('polygon', {
                    points: pointsStr,
                    fill: `rgb(${dispR},${dispG},${dispB})`,
                    class: 'cube-face', // styling
                    'data-action': 'setBaseRay', // action
                    'data-r': r,
                    'data-g': g,
                    'data-b': b,
                    'data-hex': hexColor
                });

                cubeGroup.appendChild(polygon);

                // 2. Clone active geometry to the highlight layer to avoid clipping
                if (isActive) {
                    const highlight = polygon.cloneNode();
                    highlight.setAttribute('class', 'highlight-outline');
                    highlight.removeAttribute('fill');
                    highlightGroup.appendChild(highlight);
                }
            }
        }
    }

    // Build the 3 visible isometric faces
    buildFace(axYellow, axMagenta, (i, j) => [currentLevel, currentLevel - j, currentLevel - i]); // Right
    buildFace(axCyan, axMagenta, (i, j) => [currentLevel - i, currentLevel - j, currentLevel]);   // Left
    buildFace(axCyan, axYellow, (i, j) => [currentLevel - i, currentLevel, currentLevel - j]);    // Top
}

// --- Hover State Management ---
function updateHoverUI(target) {
    // Clear previous hover
    hoverGroup.innerHTML = '';

    if (!target) {
        // We are pointing at empty space; hide everything
        pointerDisplay.style.display = 'none';
        return;
    }

    // Unify: Clone the shape and override styling
    const clone = target.cloneNode();
    clone.setAttribute('class', 'hover-outline');
    clone.removeAttribute('fill');
    hoverGroup.appendChild(clone);

    pointerDisplay.innerText = target.dataset.hex; // dataset API
    pointerDisplay.style.display = 'block';
}

function refreshHoverState() {
    if (mouseX === -1) return;

    // Ask the browser what element is physically under the cursor right now.
    const el = document.elementFromPoint(mouseX, mouseY);
    const target = el ? el.closest('.interactive-shape') : null;

    updateHoverUI(target);
}

// --- Interactive Events ---

// 1. Define the behaviors based on data-actions
const INTERACTION_HANDLERS = {
    setLevel: (target) => {
        currentLevel = parseInt(target.dataset.level, 10);
    },
    setBaseRay: (target) => {
        if (currentLevel === 0) return;

        const r = parseInt(target.dataset.r, 10);
        const g = parseInt(target.dataset.g, 10);
        const b = parseInt(target.dataset.b, 10);

        // Concise scaling function to clean up the math
        const scale = (val) => Math.min(CONFIG.MAX_LEVEL, Math.max(0, Math.round((val * CONFIG.MAX_LEVEL) / currentLevel)));

        baseRay = [scale(r), scale(g), scale(b)];
    }
};

// Global mouse tracker (needed for refreshHoverState)
window.addEventListener('pointermove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

// 2. The unified click dispatcher
svg.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    // Execute the bound action if it exists
    if (INTERACTION_HANDLERS[action]) {
        INTERACTION_HANDLERS[action](target);
        renderScene();
        refreshHoverState();
    }
});

svg.addEventListener('pointerover', (e) => {
    updateHoverUI(e.target.closest('[data-action]'));
});

svg.addEventListener('pointermove', (e) => {
    if (pointerDisplay.style.display === 'block') {
        pointerDisplay.style.left = `${e.clientX}px`;
        pointerDisplay.style.top = `${e.clientY}px`;
    }
});

svg.addEventListener('pointerout', (e) => {
    // We only hide everything if the pointer actually left a valid shape entirely
    const newTarget = e.relatedTarget?.closest('[data-action]');
    if (!newTarget) {
        updateHoverUI(null);
    }
});

// Scroll Logic for Level Changes
window.addEventListener('wheel', (e) => {
    if (!e.target.closest('svg')) return;

    e.preventDefault();

    let levelChanged = false;
    if (e.deltaY < 0 && currentLevel < CONFIG.MAX_LEVEL) {
        currentLevel++;
        levelChanged = true;
    } else if (e.deltaY > 0 && currentLevel > 0) {
        currentLevel--;
        levelChanged = true;
    }

    if (levelChanged) {
        renderScene();
        refreshHoverState();
    }
}, { passive: false });

// Zoom Toggle
zoomCheckbox.addEventListener('change', (e) => {
    isZoomed = e.target.checked;
    renderScene();
    refreshHoverState();
});

// --- Initialization ---
renderScene();
