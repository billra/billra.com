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
const M = p         => `M ${p.x} ${p.y}`;
const L = p         => ` L ${p.x} ${p.y}`;
const A = (p, s, r) => ` A ${r} ${r} 0 0 ${s} ${p.x} ${p.y}`;

// ────── wall(centers) → { start, end, cmd } ──────
function wall(centers) {
    const D     = centers.slice(1).map((c, i) => dir(centers[i], c));
    const start = add(centers[0],     mul(left(D[0]),     RADIUS));
    const end   = add(centers.at(-1), mul(left(D.at(-1)), RADIUS));

    let cmd = '';
    let lineStart = start; // line starts at current position

    for (let i = 1; i < centers.length - 1; ++i) {
        const dp = D[i - 1]; // incoming direction
        const dn = D[i];     // outgoing direction
        if (dp.x === dn.x && dp.y === dn.y) continue; // straight line, no bend

        // we are bending, create a curve
        const concave = cross(dp, dn) < 0;
        const shift   = concave ? 2 * RADIUS : 0;

        const prev = add(add(centers[i], mul(left(dp), RADIUS)),
                         mul(dp, -shift));
        const next = add(add(centers[i], mul(left(dn), RADIUS)),
                         mul(dn,  shift));

        if (!eq(lineStart, prev)) cmd += L(prev); // no zero length lines
        cmd += A(next, concave ? 0 : 1, RADIUS);
        lineStart = next; // new line start is end of curve
    }

    // always ends with a line by construction
    console.assert(!eq(lineStart, end),'ending with zero length line');
    cmd += L(end);
    return { start, end, cmd };
}

// 180° cap between left and right walls
const cap = p => A(p, 1, RADIUS);  // sweep-flag 1 ⇢ half-circle

function svgSnake(offX, offY, path) {
    const center = ({ x, y }) =>
        vec(offX + CELL_SIZE * (x + 0.5),
            offY + CELL_SIZE * (y + 0.5));

    const centers   = path.map(center);
    const leftWall  = wall(centers);           // head → tail
    const rightWall = wall(centers.reverse()); // tail → head

    const d =  M(leftWall.start)
            + leftWall.cmd         // head → tail (left edge)
            + cap(rightWall.start) // 180° round tail
            + rightWall.cmd        // tail → head (right edge)
            + cap(leftWall.start)  // 180° round head
            + 'Z';

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
    ui.cancel.disabled   = !busy;
};

// outline controls
const updateOutlineControls = () => {
    const on = ui.showPath.checked;
    ui.pathModeOutline.disabled = !on;
    ui.pathModeFilled .disabled = !on;
    ui.showGrid       .disabled = !on;
};

// react to check-box toggles
ui.showPath.addEventListener('change', () => {
    ui.drawingQ.style.display = ui.showPath.checked ? '' : 'none';
    updateOutlineControls();
});
ui.showPolyline.addEventListener('change', () => {
    ui.drawing.style.display = ui.showPolyline.checked ? '' : 'none';
});

// ────────── worker glue ──────────
const WORKER_URL = new URL('./worker.mjs', import.meta.url); // single instance
let worker = null;

const generateSnake = () => {
    worker?.terminate(); // abort an existing run
    worker = null;

    const cols = +ui.cols.value; // unary + → number
    const rows = +ui.rows.value;

    const width  = cols * CELL_SIZE + CELL_SIZE - SNAKE_WIDTH;
    const height = rows * CELL_SIZE + CELL_SIZE - SNAKE_WIDTH;

    // prepare containers & SVGs
    let svg = null;
    if (ui.showPolyline.checked) {
        ui.drawing.style.display = '';
        svg = setupSvg(ui.drawing, width, height);
    } else {
        ui.drawing.replaceChildren();
        ui.drawing.style.display = 'none';
    }
    let svgQ = null;
    if (ui.showPath.checked) {
        ui.drawingQ.style.display = '';
        svgQ = setupSvg(ui.drawingQ, width, height);
    } else {
        ui.drawingQ.replaceChildren();
        ui.drawingQ.style.display = 'none';
    }

    updateUI('Working …', { busy: true });

    worker = new Worker(WORKER_URL, { type: 'module' });
    worker.postMessage({ cols, rows, version: ui.version.textContent });

    worker.onmessage = ({ data }) => {
        if (data.debug) {
            console.log('%cworker:', 'color:grey', data.debug);
            return;
        }

        if (svg)  drawSnake (svg,  data.path, cols, rows, width, height);
        if (svgQ) drawSnakeQ(svgQ, data.path, cols, rows, width, height);

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
    updateOutlineControls();
    generateSnake();
});
