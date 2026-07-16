/// --- Configuration & Constants ---
const CONFIG = {
    // Dynamic dimensions updated on window resize
    logicalWidth: 800,
    logicalHeight: 650,
    edgeLength: 220,
    LEVELS: 16, // Change to 8, 32, 64, etc. to scale the entire application
    get MAX_LEVEL() { return this.LEVELS - 1; },
    get MULTIPLIER() { return 255 / this.MAX_LEVEL; }
};

// --- State Management ---
let currentLevel = CONFIG.MAX_LEVEL;
let baseRay = [15, 7, 0];
let currentScene = []; // The declarative Scene Graph

// --- DOM Elements ---
const canvas = document.getElementById('colorCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // alpha: false optimizes rendering for an opaque background
const zoomCheckbox = document.getElementById('zoom');
const pointerDisplay = document.getElementById('pointer-display');
const coreSampleContainer = document.getElementById('core-sample');

// --- Inject Title and Version ---
document.getElementById('page-title').textContent = document.title;
const versionMeta = document.querySelector('meta[name="version"]');
document.getElementById('version').textContent = `v${versionMeta.content}`;

// --- Setup Responsive High-DPI Canvas ---
const dpr = window.devicePixelRatio || 1;

function handleResize() {
    CONFIG.logicalWidth = window.innerWidth * 0.5;
    CONFIG.logicalHeight = CONFIG.logicalWidth * 1.1;

    // The maximum possible edge length at N = 15
    CONFIG.edgeLength = CONFIG.logicalWidth * 0.45;

    canvas.width = CONFIG.logicalWidth * dpr;
    canvas.height = CONFIG.logicalHeight * dpr;
    canvas.style.width = `${CONFIG.logicalWidth}px`;
    canvas.style.height = `${CONFIG.logicalHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    requestRender();
}

window.addEventListener('resize', handleResize);

// --- Math & Geometry Helpers ---
function rgbToShortHex(r, g, b) {
    const toHex = (c) => {
        const level = Math.round(c / 17); // 255 / 15 = 17
        return Math.max(0, Math.min(15, level)).toString(16).toUpperCase();
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Ray-Casting algorithm to check if an (x,y) point is inside a polygon
function pointInPolygon(point, vs) {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// --- Scene Graph Generation (The Math) ---
// Generates a pure array of polygon objects, decoupled from the canvas
function generateSceneGraph(level, baseRay, isZoomed) {
    const cells = [];

    // Scale edge length based on zoom state
    const L = isZoomed ? CONFIG.edgeLength : (CONFIG.edgeLength * (level / CONFIG.MAX_LEVEL));
    const cx = CONFIG.logicalWidth / 2;
    const cy = CONFIG.logicalHeight / 2 - (CONFIG.logicalHeight * 0.03);

    // Isometric Axes
    const axCyan = { x: L * Math.cos(7 * Math.PI / 6), y: L * Math.sin(7 * Math.PI / 6) };
    const axYellow = { x: L * Math.cos(11 * Math.PI / 6), y: L * Math.sin(11 * Math.PI / 6) };
    const axMagenta = { x: L * Math.cos(Math.PI / 2), y: L * Math.sin(Math.PI / 2) };

    // Calculate the target RGB for the current intensity level to determine the active ray
    const targetR = Math.round((baseRay[0] * level) / CONFIG.MAX_LEVEL);
    const targetG = Math.round((baseRay[1] * level) / CONFIG.MAX_LEVEL);
    const targetB = Math.round((baseRay[2] * level) / CONFIG.MAX_LEVEL);

    function buildFace(uAx, vAx, colorFn, faceName) {
        const steps = level + 1;

        for (let i = 0; i <= level; i++) {
            for (let j = 0; j <= level; j++) {
                const u1 = i / steps, u2 = (i + 1) / steps;
                const v1 = j / steps, v2 = (j + 1) / steps;

                // 4 corners of the isometric polygon
                const points = [
                    { x: cx + u1*uAx.x + v1*vAx.x, y: cy + u1*uAx.y + v1*vAx.y },
                    { x: cx + u2*uAx.x + v1*vAx.x, y: cy + u2*uAx.y + v1*vAx.y },
                    { x: cx + u2*uAx.x + v2*vAx.x, y: cy + u2*uAx.y + v2*vAx.y },
                    { x: cx + u1*uAx.x + v2*vAx.x, y: cy + u1*uAx.y + v2*vAx.y }
                ];

                const [r, g, b] = colorFn(i, j);
                const isActive = (r === targetR && g === targetG && b === targetB);

                // Display colors mapping purely to CSS RGB
                const dispR = r * CONFIG.MULTIPLIER;
                const dispG = g * CONFIG.MULTIPLIER;
                const dispB = b * CONFIG.MULTIPLIER;

                cells.push({
                    points,
                    rawRGB: [r, g, b],
                    color: `rgb(${dispR},${dispG},${dispB})`,
                    hex: rgbToShortHex(dispR, dispG, dispB),
                    face: faceName,
                    isActive
                });
            }
        }
    }

    buildFace(axYellow, axMagenta, (i, j) => [level, level - j, level - i], 'right');
    buildFace(axCyan, axMagenta, (i, j) => [level - i, level - j, level], 'left');
    buildFace(axCyan, axYellow, (i, j) => [level - i, level, level - j], 'top');

    return cells;
}

// --- Rendering Logic (The Canvas) ---
let renderPending = false;

function drawPolygon(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.lineTo(points[3].x, points[3].y);
    ctx.closePath();
}

function renderScene(cells, ctx) {
    // Fill the background black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CONFIG.logicalWidth, CONFIG.logicalHeight);

    // LAYER 1: Draw the base cube faces and standard black grid
    cells.forEach(cell => {
        ctx.fillStyle = cell.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';

        drawPolygon(ctx, cell.points);
        ctx.fill();
        ctx.stroke();
    });

    // LAYER 2: Draw highlights on top to prevent adjacent overlapping
    const activeCells = cells.filter(cell => cell.isActive);
    activeCells.forEach(cell => {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';

        drawPolygon(ctx, cell.points);
        ctx.stroke();
    });
}

function draw() {
    renderPending = false;
    currentScene = generateSceneGraph(currentLevel, baseRay, zoomCheckbox.checked);
    renderScene(currentScene, ctx);
    renderCoreSample(); // Keeps the core sample dimensions perfectly mirrored to the canvas geometry
}

function requestRender() {
    if (!renderPending) {
        renderPending = true;
        requestAnimationFrame(draw);
    }
}

// --- Rendering the Core Sample ---
function renderCoreSample() {
    coreSampleContainer.innerHTML = '';

    // Calculate the precise geometric tip-to-tip vertical height of the cube hex projection
    const isZoomed = zoomCheckbox.checked;
    const L = isZoomed ? CONFIG.edgeLength : (CONFIG.edgeLength * (currentLevel / CONFIG.MAX_LEVEL));
    const cubeHeight = 2 * L;

    // Apply the structural height directly to matching layout properties
    coreSampleContainer.style.height = `${cubeHeight}px`;

    for (let i = CONFIG.MAX_LEVEL; i >= 0; i--) {
        const r = Math.round((baseRay[0] * i) / CONFIG.MAX_LEVEL);
        const g = Math.round((baseRay[1] * i) / CONFIG.MAX_LEVEL);
        const b = Math.round((baseRay[2] * i) / CONFIG.MAX_LEVEL);

        const block = document.createElement('div');
        block.className = 'core-block';

        if (i === currentLevel) {
            block.classList.add('active-level');
        }

        const hexColor = rgbToShortHex(r * CONFIG.MULTIPLIER, g * CONFIG.MULTIPLIER, b * CONFIG.MULTIPLIER);
        block.style.backgroundColor = hexColor;
        block.title = `${hexColor} (Level ${i})`;

        block.addEventListener('click', () => {
            currentLevel = i;
            requestRender();
        });

        coreSampleContainer.appendChild(block);
    }
}

// --- Interactive Logic (Data-Driven Geometric Checks) ---

// Helper to find which cell the mouse is over based on the scene graph
function getCellAtMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    // Reverse the array so we check the top-most faces first (Painters Algorithm)
    return currentScene.slice().reverse().find(cell => pointInPolygon({x: cssX, y: cssY}, cell.points));
}

canvas.addEventListener('click', (e) => {
    if (currentLevel === 0) return;

    const clickedCell = getCellAtMouse(e);
    if (!clickedCell) return;

    // Mathematics of the Ray: Extrapolate the base color using the clicked cell's raw RGB data
    const [r, g, b] = clickedCell.rawRGB;

    baseRay[0] = Math.min(CONFIG.MAX_LEVEL, Math.max(0, Math.round((r * CONFIG.MAX_LEVEL) / currentLevel)));
    baseRay[1] = Math.min(CONFIG.MAX_LEVEL, Math.max(0, Math.round((g * CONFIG.MAX_LEVEL) / currentLevel)));
    baseRay[2] = Math.min(CONFIG.MAX_LEVEL, Math.max(0, Math.round((b * CONFIG.MAX_LEVEL) / currentLevel)));

    requestRender();
});

canvas.addEventListener('mousemove', (e) => {
    const hoveredCell = getCellAtMouse(e);

    if (!hoveredCell) {
        pointerDisplay.style.display = 'none';
        canvas.style.cursor = 'default';
        return;
    }

    canvas.style.cursor = 'crosshair';
    pointerDisplay.innerText = hoveredCell.hex;
    pointerDisplay.style.display = 'block';
    pointerDisplay.style.left = `${e.clientX + 15}px`;
    pointerDisplay.style.top = `${e.clientY + 15}px`;
});

canvas.addEventListener('mouseleave', () => {
    pointerDisplay.style.display = 'none';
});

// --- Scroll Logic ---
window.addEventListener('wheel', (e) => {
    e.preventDefault();

    if (e.deltaY < 0 && currentLevel < CONFIG.MAX_LEVEL) {
        currentLevel++;
    } else if (e.deltaY > 0 && currentLevel > 0) {
        currentLevel--;
    } else {
        return;
    }

    requestRender();
}, { passive: false });

// Initialize
zoomCheckbox.addEventListener('change', requestRender);
handleResize();
