// easy UI access
const ui = {};
function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
document.querySelectorAll('[id]').forEach(el => {
    ui[kebabToCamel(el.id)] = document.getElementById(el.id);
});

// Constants
const SNAKE_COLOR   = '#1f5';
const SNAKE_WIDTH   = 45;                  // Snake body width  (device pixels)
const SPACE         = 2;                   // Available space relative to width
const CELL_SIZE     = SNAKE_WIDTH * SPACE; // Grid cell size    (device pixels)
const CANVAS_MARGIN = SNAKE_WIDTH * 0.8;   // Outer margin      (device pixels)

// set title and version
ui.pageTitle.innerText = document.title;
ui.version.innerText   = 'v' + document.querySelector('meta[name="version"]').content;

// Worker reference
let worker = null;

// UI update
// msg  – text placed in the status element
// ok   – true ⇒ normal status, false ⇒ error status
// busy – true ⇒ generation in progress, false ⇒ idle
function updateUI(msg, { ok = true, busy = false } = {}) {
    // status line
    ui.status.textContent = msg;
    ui.status.classList.toggle('error', !ok);

    // buttons
    ui.generate.disabled = busy;
    ui.cancel.disabled   = !busy;
}

// Drawing
function drawSnake(ctx, path, width, height) {
    // clear whole bitmap (device-pixel units)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!path) return;

    const offsetX = Math.floor((ctx.canvas.width  - CELL_SIZE * width)  / 2);
    const offsetY = Math.floor((ctx.canvas.height - CELL_SIZE * height) / 2);

    ctx.lineJoin  = 'round';
    ctx.lineCap   = 'round';
    ctx.lineWidth = SNAKE_WIDTH;

    const cellCenter = c => [
        offsetX + CELL_SIZE * (c.x + 0.5),
        offsetY + CELL_SIZE * (c.y + 0.5)
    ];

    ctx.beginPath();
    const [sx, sy] = cellCenter(path[0]);
    ctx.moveTo(sx, sy);

    for (let i = 1; i < path.length; ++i) {
        const [x, y] = cellCenter(path[i]);
        ctx.lineTo(x, y);
    }

    ctx.strokeStyle = SNAKE_COLOR;
    ctx.stroke();
}

// Main path generation logic using a Web Worker
function generateSnake() {
    if (worker) {
        worker.terminate();
        worker = null;
    }

    const width  = parseInt(ui.width.value,  10);
    const height = parseInt(ui.height.value, 10);

    const canvas = ui.drawing;
    const dpr    = window.devicePixelRatio || 1;

    // Canvas size in DEVICE pixels
    const devWidth  = width  * CELL_SIZE + 2 * CANVAS_MARGIN;
    const devHeight = height * CELL_SIZE + 2 * CANVAS_MARGIN;

    canvas.width  = devWidth;                 // backing store (device px)
    canvas.height = devHeight;
    canvas.style.width  = (devWidth  / dpr) + 'px'; // CSS pixels on page
    canvas.style.height = (devHeight / dpr) + 'px';

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateUI('Working...', { busy: true });

    worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
    worker.postMessage({ width, height, version: ui.version.innerText });

    worker.onmessage = e => {
        if (e.data.debug) {
            console.log('from worker: ' + e.data.debug);
            return;
        }

        const path = e.data.path;
        if (path) {
            drawSnake(ctx, path, width, height);
            updateUI(`Found path: ${width} x ${height}`);
        } else {
            updateUI('Failed: no Hamiltonian path found', { ok: false });
        }

        worker.terminate();
        worker = null;
    };

    worker.onerror = e => {
        console.error(`Worker exception "${e.message}" at line ${e.lineno}`);
        updateUI('Error or canceled.', { ok: false });
        worker.terminate();
        worker = null;
    };
}

// Cancel button logic
ui.cancel.addEventListener('click', () => {
    if (worker) {
        worker.terminate();
        worker = null;
    }
    updateUI('Canceled.', { ok: false });
});

// "Generate" button logic
ui.generate.addEventListener('click', generateSnake);

// initial setup
window.onload = () => {
    generateSnake();
};
