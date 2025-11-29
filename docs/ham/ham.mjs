// ────────── tiny DOM helpers ──────────
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// collect all [id] elements into a camel-cased `ui` object
const ui = {};
$$('[id]').forEach(el =>
    ui[el.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = el
);

// ────────── constants (CSS px) ──────────
const RADIUS      = 15; // everything calculated based on this value
const SNAKE_WIDTH = RADIUS * 2;
const CELL_SIZE   = SNAKE_WIDTH * 2; // match negative and positive space width: 2
const SNAKE_COLOR = '#1f5';
// background gets same radius as snake
document.documentElement.style.setProperty('--snake-radius', RADIUS + 'px');

// ────────── SVG helpers ──────────
const SVG_NS = 'http://www.w3.org/2000/svg';

// Replace the content of `container` with a fresh <svg> element and return that element.
const setupSvg = (container, width, height) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width',  width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    container.replaceChildren(svg);
    return svg;
};

// ────────── draw the snake as a single polyline ──────────
const drawSnake = (svg, path, cols, rows, width, height) => {
    if (!path) return;

    const offX = (width  - cols * CELL_SIZE) / 2;
    const offY = (height - rows * CELL_SIZE) / 2;

    const points = path
        .map(({ x, y }) =>
            `${offX + CELL_SIZE * (x + 0.5)},${offY + CELL_SIZE * (y + 0.5)}`
        )
        .join(' ');

    const polyline = document.createElementNS(SVG_NS, 'polyline');
    polyline.setAttribute('points',          points);
    polyline.setAttribute('fill',            'none');
    polyline.setAttribute('stroke',          SNAKE_COLOR);
    polyline.setAttribute('stroke-width',    SNAKE_WIDTH);
    polyline.setAttribute('stroke-linecap',  'round');
    polyline.setAttribute('stroke-linejoin', 'round');

    svg.append(polyline);
};

// ────── vector helpers ──────
const vec   = (x = 0, y = 0) => ({ x, y });
const add   = (a, b)         => vec(a.x + b.x, a.y + b.y);
const mul   = (a, k)         => vec(a.x * k,  a.y * k);
const dir   = (p, q)         => vec(Math.sign(q.x - p.x),
                                    Math.sign(q.y - p.y));
const left  = d              => vec( d.y, -d.x); // 90° CCW
const cross = (a, b)         => a.x * b.y - a.y * b.x;
const eq    = (a, b)         => a.x === b.x && a.y === b.y;

// ────── SVG path helpers ──────
const M = pt => `M ${pt.x} ${pt.y}`;
const L = pt => ` L ${pt.x} ${pt.y}`;
const A = (pt, large, sweep) =>
    ` A ${RADIUS} ${RADIUS} 0 ${large} ${sweep} ${pt.x} ${pt.y}`;

// ────── wall(centers) → { start, end, cmd } ──────
function wall(centers) {
    // directions of the center line segments
    const D = centers.slice(1).map((c, i) => dir(centers[i], c));

    const start = add(centers[0],     mul(left(D[0]),     RADIUS));
    const end   = add(centers.at(-1), mul(left(D.at(-1)), RADIUS));

    let pen = start;    // current “pen” position
    let cmd = '';       // result string
    let pending = null; // concave quarter-arc merge candidate

    // flush a concave quarter-arc which was not merged
    const emitQuarter = () => {
        if (pending) {
            cmd += A(pending, 0, 0);
            pen = pending;
            pending = null;
        }
    };

    for (let i = 1; i < centers.length - 1; ++i) {
        const dp = D[i - 1];      // incoming direction
        const dn = D[i];          // outgoing direction
        if (eq(dp, dn)) continue; // straight

        const concave = cross(dp, dn) < 0;
        const shift   = concave ? 2 * RADIUS : 0;

        const prev = add(add(centers[i], mul(left(dp), RADIUS)), mul(dp, -shift));
        const next = add(add(centers[i], mul(left(dn), RADIUS)), mul(dn,  shift));
        // line
        if (!eq(pen, prev)) {
            emitQuarter();
            cmd += L(prev);
            pen = prev;
        }
        // arc
        if (concave) {
            if (pending) { // merge two 90° arcs into one 180° arc
                cmd += A(next, 1, 0);
                pen = next;
                pending = null;
            } else {
                pending = next; // create arc merge candidate
            }
        } else { // convex never merges
            console.assert(pending === null, 'detected S curve');
            cmd += A(next, 0, 1);
            pen = next;
        }
    }
    emitQuarter();
    cmd += L(end);
    return { start, end, cmd };
}

// Good Path:
// - starts with `M`, ends with `Z`
// - one or more 'line, arc' pairs
// - numbers are positive integers
// - start position = end position
const GOOD_PATH =
    /^M (\d+) (\d+)(?: L \d+ \d+ A \d+ \d+ 0 [01] [01] \d+ \d+)* L \d+ \d+ A \d+ \d+ 0 [01] [01] \1 \2Z$/;

function svgSnake(offX, offY, path) {
    const center = ({ x, y }) =>
        vec(offX + CELL_SIZE * (x + 0.5),
            offY + CELL_SIZE * (y + 0.5));

    const centers   = path.map(center);
    const leftWall  = wall(centers);           // head → tail
    const rightWall = wall(centers.reverse()); // tail → head

    const d = M(leftWall.start)        // start location
            + leftWall.cmd             // head → tail (left)
            + A(rightWall.start, 1, 1) // round tail: 180° arc between left and right sides
            + rightWall.cmd            // tail → head (right)
            + A(leftWall.start, 1, 1)  // round head: 180° arc between left and right sides
            + 'Z';
    console.assert(GOOD_PATH.test(d), `bad snake outline:\n"${d}"`);

    const outline = document.createElementNS(SVG_NS, 'path');
    outline.setAttribute('d', d);

    if (ui.pathModeOutline.checked) {
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', '#f66');
        outline.setAttribute('stroke-width', 2);
        outline.setAttribute('vector-effect', 'non-scaling-stroke');
        outline.setAttribute('fill-rule', 'evenodd');
    } else {
        outline.setAttribute('fill', SNAKE_COLOR);
    }
    return outline;
}

function svgGrid(offX, offY, cols, rows) {
    const grid = document.createElementNS(SVG_NS, 'g');
    grid.setAttribute('stroke', '#888');
    grid.setAttribute('stroke-width', '0.5');
    grid.setAttribute('shape-rendering', 'crispEdges');
    grid.setAttribute('vector-effect', 'non-scaling-stroke');

    // vertical lines
    for (let c = 0; c <= cols; ++c) {
        const x = offX + c * CELL_SIZE;
        const v = document.createElementNS(SVG_NS, 'line');
        v.setAttribute('x1', x); v.setAttribute('y1', offY);
        v.setAttribute('x2', x); v.setAttribute('y2', offY + rows * CELL_SIZE);
        grid.append(v);
    }

    // horizontal lines
    for (let r = 0; r <= rows; ++r) {
        const y = offY + r * CELL_SIZE;
        const h = document.createElementNS(SVG_NS, 'line');
        h.setAttribute('x1', offX);                    h.setAttribute('y1', y);
        h.setAttribute('x2', offX + cols * CELL_SIZE); h.setAttribute('y2', y);
        grid.append(h);
    }
    return grid;
}

// ────────── draw snake from outline ──────────
function drawSnakeQ(svg, path, cols, rows, width, height) {
    if (!path || path.length < 2) return;

    // grid-cell → absolute center
    const offX = (width  - cols * CELL_SIZE) / 2;
    const offY = (height - rows * CELL_SIZE) / 2;

    // draw grid
    if (ui.showGrid.checked) {
        svg.append(svgGrid(offX, offY, cols, rows));
    }

    // draw snake
    svg.append(svgSnake(offX, offY, path));
}

// ────────── status line & buttons ──────────
const updateUI = (msg, { ok = true, busy = false } = {}) => {
    ui.status.textContent = msg;
    ui.status.classList.toggle('error', !ok);

    ui.generate.disabled = busy;
    ui.cancel  .disabled = !busy;
};

// dim label with control
function setDisabled(input, disabled) {
    input.disabled = disabled;
    const label = input.closest('label');
    if (label) label.classList.toggle('disabled', disabled);
}

// outline controls
const updateOutlineControls = () => {
    const on = ui.showPath.checked;
    setDisabled(ui.pathModeOutline, !on);
    setDisabled(ui.pathModeFilled , !on);
    setDisabled(ui.showGrid       , !on);
};

// ────────── cached result + (re)draw helpers ──────────
const cache = { path: null, cols: 0, rows: 0, width: 0, height: 0 };

const clearDrawings = () => {
    ui.drawing .replaceChildren();
    ui.drawingQ.replaceChildren();
    ui.drawing .style.display = 'none';
    ui.drawingQ.style.display = 'none';
};

// Build / rebuild SVGs from the cached path according to the
// current check-box / radio state
function redraw() {
    updateOutlineControls();

    // nothing to draw?
    if (!cache.path) { clearDrawings(); return; }

    const { path, cols, rows, width, height } = cache;

    // polyline view
    if (ui.showPolyline.checked) {
        ui.drawing.style.display = '';
        const svg = setupSvg(ui.drawing, width, height);
        drawSnake(svg, path, cols, rows, width, height);
    } else {
        ui.drawing.replaceChildren();
        ui.drawing.style.display = 'none';
    }

    // outline / filled view
    if (ui.showPath.checked) {
        ui.drawingQ.style.display = '';
        const svgQ = setupSvg(ui.drawingQ, width, height);
        drawSnakeQ(svgQ, path, cols, rows, width, height);
    } else {
        ui.drawingQ.replaceChildren();
        ui.drawingQ.style.display = 'none';
    }
}

// ────────── worker glue ──────────
const WORKER_URL = new URL('./worker.mjs', import.meta.url); // single instance
let worker = null;

const generateSnake = () => {
    // abort a possibly running worker
    worker?.terminate();
    worker = null;

    const cols = +ui.cols.value;
    const rows = +ui.rows.value;

    cache.path = null; // invalidate old drawing
    clearDrawings();

    // canvas size for the upcoming drawing
    cache.cols  = cols;
    cache.rows  = rows;
    cache.width  = cols * CELL_SIZE + CELL_SIZE - SNAKE_WIDTH;
    cache.height = rows * CELL_SIZE + CELL_SIZE - SNAKE_WIDTH;

    updateUI('Working …', { busy: true });

    worker = new Worker(WORKER_URL, { type: 'module' });
    worker.postMessage({ cols, rows, version: ui.version.textContent });

    worker.onmessage = ({ data }) => {
        if (data.debug) {
            console.log('%cworker:', 'color:grey', data.debug);
            return;
        }
        cache.path = data.path; // may be null on failure
        redraw();               // (re)draw with current controls

        updateUI(
            cache.path ? `Found path: ${cols} × ${rows}`
                       : 'Failed: no Hamiltonian path',
            { ok: Boolean(cache.path) }
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

// ────────── UI events ──────────

// visual options that must instantly update the view
[
    ui.showPath,
    ui.showPolyline,
    ui.pathModeOutline,
    ui.pathModeFilled,
    ui.showGrid
].forEach(el => el.addEventListener('change', redraw));

// buttons
ui.generate.addEventListener('click', generateSnake);
ui.cancel  .addEventListener('click', () => {
    worker?.terminate();
    worker = null;
    updateUI('Cancelled.', { ok: false });
});

// ────────── bootstrap ──────────
document.addEventListener('DOMContentLoaded', () => {
    ui.pageTitle.textContent = document.title;
    ui.version.textContent   = 'v' + $('meta[name="version"]').content;
    updateOutlineControls();
    generateSnake(); // create first snake on load
});
