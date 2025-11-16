// ham.mjs
// ────────── Hamiltonian-snake demo (Hi-DPI aware) ──────────
// Geometry is expressed exclusively in *CSS pixels*.
// The canvas context is scaled once per draw call → no per-value conversions.

// ────────── tiny DOM helpers ──────────
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// collect all [id] elements into a camel-cased `ui` object
const ui = {};
$$('[id]').forEach(el =>
    ui[el.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = el
);

// ────────── constants (CSS px) ──────────
const SNAKE_WIDTH   = 30;
const SPACE         = 2;
const CELL_SIZE     = SNAKE_WIDTH * SPACE;
const CANVAS_MARGIN = SNAKE_WIDTH * 0.8;
const SNAKE_COLOR   = '#1f5';

// ────────── canvas helper ──────────
const setupCanvas = (canvas, cssW, cssH) => {
    const dpr = window.devicePixelRatio;
    console.log(`dpr: ${dpr}`);

    // element size (CSS px)
    canvas.style.width  = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    // bitmap size (device px)
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;

    const ctx = canvas.getContext('2d');
    ctx.resetTransform(); // fresh state
    ctx.scale(dpr, dpr);  // 1 CSS-px → dpr device-px
    ctx.clearRect(0, 0, cssW, cssH);
    return ctx;
};

// ────────── drawing ──────────
const drawSnake = (ctx, path, cols, rows, cssW, cssH) => {
    if (!path) return;

    const offX = (cssW - cols * CELL_SIZE) / 2;
    const offY = (cssH - rows * CELL_SIZE) / 2;

    const center = ({ x, y }) => [
        offX + CELL_SIZE * (x + 0.5),
        offY + CELL_SIZE * (y + 0.5)
    ];

    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.lineWidth   = SNAKE_WIDTH;
    ctx.strokeStyle = SNAKE_COLOR;

    ctx.beginPath();
    ctx.moveTo(...center(path[0]));
    for (let i = 1; i < path.length; ++i) ctx.lineTo(...center(path[i]));
    ctx.stroke();
};

// ────────── status line & buttons ──────────
const updateUI = (msg, { ok = true, busy = false } = {}) => {
    ui.status.textContent = msg;
    ui.status.classList.toggle('error', !ok);

    ui.generate.disabled = busy;
    ui.cancel.disabled   = !busy;
};

// ────────── worker glue ──────────
const WORKER_URL = new URL('./worker.mjs', import.meta.url); // single instance
let worker = null;

const generateSnake = () => {
    worker?.terminate(); // abort an existing run
    worker = null;

    const cols = +ui.width.value; // unary + → number
    const rows = +ui.height.value;

    const cssW = cols * CELL_SIZE + 2 * CANVAS_MARGIN;
    const cssH = rows * CELL_SIZE + 2 * CANVAS_MARGIN;

    const ctx = setupCanvas(ui.drawing, cssW, cssH);
    updateUI('Working …', { busy: true });

    worker = new Worker(WORKER_URL, { type: 'module' });
    worker.postMessage({ width: cols, height: rows, version: ui.version.textContent });

    worker.onmessage = ({ data }) => {
        if (data.debug) {                          // debug chatter
            console.log('%cworker:', 'color:grey', data.debug);
            return;
        }

        drawSnake(ctx, data.path, cols, rows, cssW, cssH);

        updateUI(
            data.path ? `Found path: ${cols} × ${rows}`
                      : 'Failed: no Hamiltonian path',
            { ok: Boolean(data.path) }
        );

        worker.terminate();
        worker = null;
    };

    worker.onerror = e => {
        console.error(`Worker error: ${e.message} (line ${e.lineno})`);
        updateUI('Error or cancelled.', { ok: false });
        worker.terminate();
        worker = null;
    };
};

// ────────── event wiring ──────────
ui.generate.addEventListener('click', generateSnake);
ui.cancel.addEventListener('click', () => {
    worker?.terminate();
    worker = null;
    updateUI('Cancelled.', { ok: false });
});

// ────────── bootstrap ──────────
document.addEventListener('DOMContentLoaded', () => {
    ui.pageTitle.textContent = document.title;
    ui.version.textContent   = 'v' + $('meta[name="version"]').content;
    generateSnake();
});
