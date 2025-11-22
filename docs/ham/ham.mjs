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

    for (let i = 1; i < centers.length - 1; ++i) {
        const dp = D[i - 1]; // incoming
        const dn = D[i];     // outgoing
        if (dp.x === dn.x && dp.y === dn.y) continue; // straight

        const concave = cross(dp, dn) < 0;
        const shift   = concave ? 2 * RADIUS : 0; // only inner bends

        const prev = add(add(centers[i], mul(left(dp), RADIUS)), mul(dp, -shift));
        const next = add(add(centers[i], mul(left(dn), RADIUS)), mul(dn,  shift));

        cmd += L(prev) + A(next, concave ? 0 : 1, RADIUS); // sweep: 0 = CCW, 1 = CW
    }
    return { start, end, cmd: cmd + L(end) };
}

/* 180° cap between left and right walls */
const cap = p => A(p, 1, RADIUS);  // sweep-flag 1 ⇢ half-circle

// ────────── draw the snake as a filled outline path ──────────
function drawSnakeQ(svg, path, cols, rows, width, height) {
    if (!path || path.length < 2) return;

    const DEBUG = false;

    // grid-cell → absolute center
    const offX   = (width  - cols * CELL_SIZE) / 2;
    const offY   = (height - rows * CELL_SIZE) / 2;
    const center = ({ x, y }) =>
        vec(offX + CELL_SIZE * (x + 0.5),
            offY + CELL_SIZE * (y + 0.5));

    const centers   = path.map(center);
    const leftWall  = wall(centers);                // head → tail
    const rightWall = wall([...centers].reverse()); // tail → head

    const d =  M(leftWall.start)
            + leftWall.cmd         // head → tail (left edge)
            + cap(rightWall.start) // 180° round tail
            + rightWall.cmd        // tail → head (right edge)
            + cap(leftWall.start)  // 180° round head
            + 'Z';

    const outline = document.createElementNS(SVG_NS, 'path');
    outline.setAttribute('d', d);

    if (DEBUG) {
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', '#f66');
        outline.setAttribute('stroke-width', 2);
        outline.setAttribute('vector-effect', 'non-scaling-stroke');
        outline.setAttribute('fill-rule', 'evenodd');
    } else {
        outline.setAttribute('fill', SNAKE_COLOR);
    }
    svg.append(outline);
}

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

    const cols = +ui.cols.value; // unary + → number
    const rows = +ui.rows.value;

    const width  = cols * CELL_SIZE + CELL_SIZE - SNAKE_WIDTH;
    const height = rows * CELL_SIZE + CELL_SIZE - SNAKE_WIDTH;

    const svg  = setupSvg(ui.drawing,  width, height);
    const svgQ = setupSvg(ui.drawingQ, width, height);

    updateUI('Working …', { busy: true });

    worker = new Worker(WORKER_URL, { type: 'module' });
    worker.postMessage({ cols, rows, version: ui.version.textContent });

    worker.onmessage = ({ data }) => {
        if (data.debug) {
            console.log('%cworker:', 'color:grey', data.debug);
            return;
        }

        drawSnake (svg,  data.path, cols, rows, width, height);
        drawSnakeQ(svgQ, data.path, cols, rows, width, height);

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
