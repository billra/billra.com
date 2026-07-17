/// --- Configuration & Constants ---
const CONFIG = {
    // Fixed internal coordinate system
    viewBoxWidth: 1000,
    viewBoxHeight: 800,
    baseEdgeLength: 320,
    LEVELS: 16,
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
const zoomCheckbox = document.getElementById('zoom');
const pointerDisplay = document.getElementById('pointer-display');

// --- Inject Title and Version ---
document.getElementById('page-title').textContent = document.title;
const versionMeta = document.querySelector('meta[name="version"]');
document.getElementById('version').textContent = `v${versionMeta.content}`;

// --- Math Helpers ---
/**
 * Converts standard 0-255 RGB values into a shorthand 3-digit hex string (#RGB).
 * * Why divide by 17?
 * A short hex string uses 4 bits per color channel (0-15).
 * A standard RGB color uses 8 bits per channel (0-255).
 * To scale evenly from a max of 255 down to a max of 15, we use the ratio: 255 / 15 = 17.
 * Therefore, valid inputs should always be exact multiples of 17 (0, 17, 34 ... 255).
 */
function rgbToShortHex(r, g, b) {
    const hexDigit = (c) => {
        // Early detection for out-of-bounds values
        if (c < 0 || c > 255) {
            console.warn(`rgbToShortHex Warning: Value ${c} is out of 8-bit bounds (0-255).`);
        }

        // Early detection for values not aligned to the expected 16-level scale
        if (c % 17 !== 0) {
            console.warn(`rgbToShortHex Warning: Value ${c} is not a multiple of 17. Expected cleanly scaled integer.`);
        }

        // Map the 0-255 scale down to a 0-15 integer
        const scaled = Math.floor(c / 17);

        // Convert to base-16 and capitalize
        return scaled.toString(16).toUpperCase();
    };

    return `#${hexDigit(r)}${hexDigit(g)}${hexDigit(b)}`;
}

// --- DOM Generators ---
// Helper to create an SVG element with attributes
function createSVGElement(tag, attributes = {}) {
    const el = document.createElementNS(CONFIG.SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) {
        el.setAttribute(key, value);
    }
    return el;
}

// --- Render Logic ---
function renderScene() {
    // Clear previous render
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
            'data-level': i // Store data directly on the DOM node for event delegation
        });

        // Add visual pop for the active level
        if (i === currentLevel) {
            rect.setAttribute('transform', `scale(1.3) translate(${startX * -0.23}, ${yPos * -0.23})`);
            rect.style.stroke = '#fff';
            rect.style.strokeWidth = '3px';
        }

        coreGroup.appendChild(rect);
    }
}

function renderCube() {
    const L = isZoomed ? CONFIG.baseEdgeLength : (CONFIG.baseEdgeLength * (currentLevel / CONFIG.MAX_LEVEL));

    // Shift center slightly right to accommodate the core sample
    const cx = (CONFIG.viewBoxWidth / 2) + 60;
    const cy = CONFIG.viewBoxHeight / 2 - 20;

    // Isometric Axes
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

                // If active, clone the polygon into the highlight group so it renders on top
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

    // Build the 3 visible faces
    buildFace(axYellow, axMagenta, (i, j) => [currentLevel, currentLevel - j, currentLevel - i]); // Right
    buildFace(axCyan, axMagenta, (i, j) => [currentLevel - i, currentLevel - j, currentLevel]);   // Left
    buildFace(axCyan, axYellow, (i, j) => [currentLevel - i, currentLevel, currentLevel - j]);    // Top
}

// --- Interactive Logic (Event Delegation) ---

// Core Sample Interactivity
coreGroup.addEventListener('click', (e) => {
    const block = e.target.closest('.core-block');
    if (!block) return;

    currentLevel = parseInt(block.getAttribute('data-level'), 10);
    renderScene();
});

// Cube Interactivity
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

// Tooltip Logic
cubeGroup.addEventListener('pointerover', (e) => {
    const face = e.target.closest('.cube-face');
    if (!face) return;

    pointerDisplay.innerText = face.getAttribute('data-hex');
    pointerDisplay.style.display = 'block';
});

cubeGroup.addEventListener('pointermove', (e) => {
    if (pointerDisplay.style.display === 'block') {
        pointerDisplay.style.left = `${e.clientX + 15}px`;
        pointerDisplay.style.top = `${e.clientY + 15}px`;
    }
});

cubeGroup.addEventListener('pointerout', () => {
    pointerDisplay.style.display = 'none';
});

// Scroll Logic for Level Changes
window.addEventListener('wheel', (e) => {
    // Only intercept scroll if the mouse is over the SVG to avoid blocking page scroll unnecessarily
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
