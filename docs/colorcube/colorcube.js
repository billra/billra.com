/// --- Configuration & Constants ---
const CONFIG = {
    viewBoxWidth: 1000,
    viewBoxHeight: 800,
    baseEdgeLength: 320,
    layoutOffsetX: 60,
    levels: 16,
    svgNs: 'http://www.w3.org/2000/svg'
};

// Computed configuration constants
CONFIG.maxLevel = CONFIG.levels - 1;
CONFIG.colorScaleFactor = 255 / CONFIG.maxLevel;

// Isometric Math Constants (Computed once)
const ANGLE_CYAN_RAD = 7 * Math.PI / 6;
const ANGLE_YELLOW_RAD = 11 * Math.PI / 6;
const ANGLE_MAGENTA_RAD = Math.PI / 2;

const AXES = {
    cyan: { x: Math.cos(ANGLE_CYAN_RAD), y: Math.sin(ANGLE_CYAN_RAD) },
    yellow: { x: Math.cos(ANGLE_YELLOW_RAD), y: Math.sin(ANGLE_YELLOW_RAD) },
    magenta: { x: Math.cos(ANGLE_MAGENTA_RAD), y: Math.sin(ANGLE_MAGENTA_RAD) }
};

// --- State Management ---
// Single source of truth. Contains both logical data and pointer state to allow
// unidirectional data flow and guarantee perfectly accurate hover states.
const state = new Proxy({
    level: CONFIG.maxLevel,
    baseRay: [15, 7, 0],
    isZoomed: false,
    pointerX: -1,
    pointerY: -1
}, {
    set(target, property, value) {
        if (target[property] === value) return true;

        // Fail Fast: Enforce strict preconditions on state data
        if (property === 'level' && (!Number.isInteger(value) || value < 0 || value > CONFIG.maxLevel)) {
            throw new RangeError(`Invalid level: ${value}. Must be an integer between 0 and ${CONFIG.maxLevel}.`);
        }
        if (property === 'baseRay' && (!Array.isArray(value) || value.length !== 3)) {
            throw new TypeError('baseRay must be an array of three numeric values.');
        }

        target[property] = value;

        // Pointer movements only require a lightweight hover refresh
        if (property === 'pointerX' || property === 'pointerY') {
            if (!this.hoverScheduled) {
                this.hoverScheduled = true;
                requestAnimationFrame(() => {
                    refreshHoverState();
                    this.hoverScheduled = false;
                });
            }
            return true;
        }

        // Logical state changes require a full scene update
        if (!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                updateScene();

                // Double-RAF: Defers the hover read (elementFromPoint) until after
                // the browser has painted the new geometry, eliminating layout thrashing.
                requestAnimationFrame(() => refreshHoverState());

                this.renderScheduled = false;
            });
        }
        return true;
    }
});

// --- DOM Cache (Object Pooling) ---
// Pre-allocated SVG nodes. We update their attributes rather than destroying the DOM.
const elementPool = {
    coreBlocks: [],
    cubePolygons: [],
    overlays: {
        highlight: {},
        hover: {}
    }
};

const svg = document.getElementById('app-svg');
svg.setAttribute('viewBox', `0 0 ${CONFIG.viewBoxWidth} ${CONFIG.viewBoxHeight}`);
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

// --- Math & String Helpers ---

/**
 * Scales a 3-component color ray from a source resolution to a target resolution.
 * Ensures output is always bounded within the 0 to CONFIG.maxLevel range.
 */
function scaleRay(ray, sourceLevel, targetLevel) {
    if (sourceLevel === 0) return [0, 0, 0];
    return ray.map(val => {
        const scaled = Math.round((val * targetLevel) / sourceLevel);
        return Math.min(CONFIG.maxLevel, Math.max(0, scaled));
    });
}

/**
 * Converts standard 0-255 RGB values into a hex string. Returns a compact
 * 3-digit format (#RGB) if possible, otherwise falls back to the standard
 * 6-digit format (#RRGGBB).
 */
function rgbToHex(r, g, b) {
    const toHex = (c) => Math.round(c).toString(16).padStart(2, '0').toUpperCase();

    const hexR = toHex(r);
    const hexG = toHex(g);
    const hexB = toHex(b);

    // If both digits of every channel are identical (e.g., 'FF', '00', 'AA'), use the 3-digit short form.
    if (hexR[0] === hexR[1] && hexG[0] === hexG[1] && hexB[0] === hexB[1]) {
        return `#${hexR[0]}${hexG[0]}${hexB[0]}`;
    }

    return `#${hexR}${hexG}${hexB}`;
}

function createSVGElement(tag, attributes = {}) {
    const el = document.createElementNS(CONFIG.svgNs, tag);
    for (const [key, value] of Object.entries(attributes)) {
        el.setAttribute(key, value);
    }
    return el;
}

// --- Initialization (Upfront Allocation) ---
function initScene() {
    // 1. Allocate Core Blocks (Max Level)
    for (let i = CONFIG.maxLevel; i >= 0; i--) {
        const rect = createSVGElement('rect', {
            class: 'core-block',
            'data-action': 'setLevel',
            'data-level': i
        });
        elementPool.coreBlocks.push({ dom: rect, logicalLevel: i });
        coreGroup.appendChild(rect);
    }

    // 2. Allocate Cube Polygons (Max Matrix for 3 Faces)
    const createFacePool = (faceId, uAxis, vAxis, colorFn) => {
        for (let i = 0; i <= CONFIG.maxLevel; i++) {
            for (let j = 0; j <= CONFIG.maxLevel; j++) {
                const poly = createSVGElement('polygon', {
                    class: 'cube-face',
                    'data-action': 'setBaseRay'
                });
                // We store the math references statically on the cached object
                elementPool.cubePolygons.push({ dom: poly, faceId, i, j, uAxis, vAxis, colorFn });
                cubeGroup.appendChild(poly);
            }
        }
    };

    createFacePool('right', AXES.yellow, AXES.magenta, (lvl, i, j) => [lvl, lvl - j, lvl - i]);
    createFacePool('left', AXES.cyan, AXES.magenta, (lvl, i, j) => [lvl - i, lvl - j, lvl]);
    createFacePool('top', AXES.cyan, AXES.yellow, (lvl, i, j) => [lvl - i, lvl, lvl - j]);

    // 3. Allocate Stacked Overlays for Highlighting and Hovering (Replaces filter: drop-shadow)
    const createOverlay = (tag, type, container) => {
        const bg = createSVGElement(tag, { class: `${type}-bg`, style: 'display: none;' });
        const fg = createSVGElement(tag, { class: `${type}-fg`, style: 'display: none;' });
        container.appendChild(bg);
        container.appendChild(fg);
        return { bg, fg };
    };

    elementPool.overlays.highlight.rect = createOverlay('rect', 'highlight', highlightGroup);
    // Modified: use a <path> for the 3D highlight so we can compound multiple faces seamlessly
    elementPool.overlays.highlight.path = createOverlay('path', 'highlight', highlightGroup);

    elementPool.overlays.hover.rect = createOverlay('rect', 'hover', hoverGroup);
    elementPool.overlays.hover.polygon = createOverlay('polygon', 'hover', hoverGroup);

    // Apply the initial visual state
    updateScene();
}

// --- Render Updates ---
function updateScene() {
    updateCoreSample();
    updateCube();
}

function hideOverlay(overlay) {
    overlay.bg.style.display = 'none';
    overlay.fg.style.display = 'none';
}

function showOverlay(overlay, attributes) {
    for (const [key, val] of Object.entries(attributes)) {
        overlay.bg.setAttribute(key, val);
        overlay.fg.setAttribute(key, val);
    }
    overlay.bg.style.display = '';
    overlay.fg.style.display = '';
}

function updateCoreSample() {
    const blockSize = 38;
    const spacing = 2;
    const totalHeight = CONFIG.levels * (blockSize + spacing);
    const startX = CONFIG.layoutOffsetX;
    const startY = (CONFIG.viewBoxHeight - totalHeight) / 2;

    hideOverlay(elementPool.overlays.highlight.rect);

    for (const item of elementPool.coreBlocks) {
        const i = item.logicalLevel;
        const dom = item.dom;

        const [r, g, b] = scaleRay(state.baseRay, CONFIG.maxLevel, i);
        const dispR = r * CONFIG.colorScaleFactor;
        const dispG = g * CONFIG.colorScaleFactor;
        const dispB = b * CONFIG.colorScaleFactor;

        const yPos = startY + ((CONFIG.maxLevel - i) * (blockSize + spacing));
        const hexColor = rgbToHex(dispR, dispG, dispB);

        dom.setAttribute('x', startX);
        dom.setAttribute('y', yPos);
        dom.setAttribute('width', blockSize);
        dom.setAttribute('height', blockSize);
        dom.setAttribute('fill', hexColor);
        dom.dataset.hex = hexColor;

        if (i === state.level) {
            showOverlay(elementPool.overlays.highlight.rect, {
                x: startX, y: yPos, width: blockSize, height: blockSize
            });
        }
    }
}

function updateCube() {
    const edgeLength = state.isZoomed ? CONFIG.baseEdgeLength : (CONFIG.baseEdgeLength * (state.level / CONFIG.maxLevel));
    const centerX = (CONFIG.viewBoxWidth / 2) + CONFIG.layoutOffsetX;
    const centerY = CONFIG.viewBoxHeight / 2 - 20;

    const targetRay = scaleRay(state.baseRay, CONFIG.maxLevel, state.level);
    const steps = state.level + 1;

    hideOverlay(elementPool.overlays.highlight.path);
    let highlightPath = '';

    for (const item of elementPool.cubePolygons) {
        const { dom, i, j, uAxis, vAxis, colorFn } = item;

        // Cull geometry outside the current resolution boundary
        if (i > state.level || j > state.level) {
            dom.style.display = 'none';
            continue;
        }

        dom.style.display = ''; // Ensure visible

        const u1 = i / steps, u2 = (i + 1) / steps;
        const v1 = j / steps, v2 = (j + 1) / steps;

        const p1X = centerX + (u1 * uAxis.x + v1 * vAxis.x) * edgeLength;
        const p1Y = centerY + (u1 * uAxis.y + v1 * vAxis.y) * edgeLength;

        const p2X = centerX + (u2 * uAxis.x + v1 * vAxis.x) * edgeLength;
        const p2Y = centerY + (u2 * uAxis.y + v1 * vAxis.y) * edgeLength;

        const p3X = centerX + (u2 * uAxis.x + v2 * vAxis.x) * edgeLength;
        const p3Y = centerY + (u2 * uAxis.y + v2 * vAxis.y) * edgeLength;

        const p4X = centerX + (u1 * uAxis.x + v2 * vAxis.x) * edgeLength;
        const p4Y = centerY + (u1 * uAxis.y + v2 * vAxis.y) * edgeLength;

        const pointsAttr = `${p1X},${p1Y} ${p2X},${p2Y} ${p3X},${p3Y} ${p4X},${p4Y}`;
        const [r, g, b] = colorFn(state.level, i, j);
        const dispR = r * CONFIG.colorScaleFactor;
        const dispG = g * CONFIG.colorScaleFactor;
        const dispB = b * CONFIG.colorScaleFactor;
        const hexColor = rgbToHex(dispR, dispG, dispB);

        dom.setAttribute('points', pointsAttr);
        dom.setAttribute('fill', hexColor);

        dom.dataset.r = r;
        dom.dataset.g = g;
        dom.dataset.b = b;
        dom.dataset.hex = hexColor;

        if (r === targetRay[0] && g === targetRay[1] && b === targetRay[2]) {
            // Build the compound path string for the highlights
            highlightPath += `M ${p1X},${p1Y} L ${p2X},${p2Y} L ${p3X},${p3Y} L ${p4X},${p4Y} Z `;
        }
    }

    // Apply the concatenated path string to the single highlight overlay element
    if (highlightPath) {
        showOverlay(elementPool.overlays.highlight.path, { d: highlightPath.trim() });
    }
}

// --- Hover State Management ---
function updateHoverUI(target) {
    hideOverlay(elementPool.overlays.hover.rect);
    hideOverlay(elementPool.overlays.hover.polygon);

    if (!target) {
        pointerDisplay.style.display = 'none';
        return;
    }

    if (target.tagName === 'rect') {
        showOverlay(elementPool.overlays.hover.rect, {
            x: target.getAttribute('x'),
            y: target.getAttribute('y'),
            width: target.getAttribute('width'),
            height: target.getAttribute('height')
        });
    } else if (target.tagName === 'polygon') {
        showOverlay(elementPool.overlays.hover.polygon, {
            points: target.getAttribute('points')
        });
    }

    // Reposition using the exact state coordinates
    pointerDisplay.innerText = target.dataset.hex;
    pointerDisplay.style.left = `${state.pointerX}px`;
    pointerDisplay.style.top = `${state.pointerY}px`;
    pointerDisplay.style.display = 'block';
}

function refreshHoverState() {
    if (state.pointerX === -1 || state.pointerY === -1) return;

    // Because rendering is pooled, `elementFromPoint` correctly identifies the shape
    // immediately under the cursor, resolving the scrolling mismatch bug.
    const el = document.elementFromPoint(state.pointerX, state.pointerY);
    const target = el ? el.closest('[data-action]') : null;

    updateHoverUI(target);
}

// --- Interactive Events ---
const INTERACTION_HANDLERS = {
    setLevel: (target) => {
        state.level = parseInt(target.dataset.level, 10);
    },
    setBaseRay: (target) => {
        if (state.level === 0) return;

        const r = parseInt(target.dataset.r, 10);
        const g = parseInt(target.dataset.g, 10);
        const b = parseInt(target.dataset.b, 10);

        state.baseRay = scaleRay([r, g, b], state.level, CONFIG.maxLevel);
    }
};

window.addEventListener('pointermove', (e) => {
    state.pointerX = e.clientX;
    state.pointerY = e.clientY;
});

svg.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (target && INTERACTION_HANDLERS[target.dataset.action]) {
        INTERACTION_HANDLERS[target.dataset.action](target);
    }
});

svg.addEventListener('pointerout', (e) => {
    const newTarget = e.relatedTarget?.closest('[data-action]');
    if (!newTarget) updateHoverUI(null);
});

// Scroll Logic
window.addEventListener('wheel', (e) => {
    if (!e.target.closest('svg')) return;
    e.preventDefault();

    if (e.deltaY < 0 && state.level < CONFIG.maxLevel) state.level++;
    else if (e.deltaY > 0 && state.level > 0) state.level--;
}, { passive: false });

// Zoom Toggle
zoomCheckbox.addEventListener('change', (e) => {
    state.isZoomed = e.target.checked;
});

// --- Boot ---
initScene();
