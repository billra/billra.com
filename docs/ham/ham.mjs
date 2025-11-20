// ────────── tiny DOM helpers ──────────
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// collect all [id] elements into a camel-cased `ui` object
const ui = {};
$$('[id]').forEach(el =>
    ui[el.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = el
);

// ────────── constants (CSS px) ──────────
const SNAKE_WIDTH = 30;
const CELL_SIZE   = SNAKE_WIDTH * 2; // match negative and positive space width: 2
const SNAKE_COLOR = '#1f5';
// background gets same radius as snake
document.documentElement.style.setProperty('--snake-radius', SNAKE_WIDTH / 2 + 'px');

// ────────── SVG helpers ──────────
const SVG_NS = 'http://www.w3.org/2000/svg';

// Replace the content of `container` with a fresh <svg> element and returns that element.
const setupSvg = (container, width, height) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width',  width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    container.replaceChildren(svg);
    return svg;
};
// Draw the Hamiltonian snake as a single <polyline>.
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

// ──────────  Filled snake with true inner radius  ──────────
const drawSnakeQ = (svg, path, cols, rows, width, height) => {
    if (!path || path.length === 0) return;

    const R      = SNAKE_WIDTH / 2;        // geometric radius
    const DEBUG  = true;                  // true ⇒ outline only

    /* ─── coordinate helpers ───────────────────────────────── */
    const offX = (width  - cols * CELL_SIZE) / 2;
    const offY = (height - rows * CELL_SIZE) / 2;
    const toPx = ({ x, y }) => ({           // cell → px centre
        x: offX + CELL_SIZE * (x + 0.5),
        y: offY + CELL_SIZE * (y + 0.5),
    });

    const centres = path.map(toPx);
    const n       = centres.length;

    const dir   = (p, q) => ({              // reduced direction
        x: Math.sign(q.x - p.x),
        y: Math.sign(q.y - p.y),
    });
    const left  = ({ x, y }) => ({ x:  y, y: -x });
    const right = ({ x, y }) => ({ x: -y, y:  x });

    /* ─── SVG path emitters ───────────────────────────────── */
    let d = '';
    const L = p                 => d += ` L ${p.x} ${p.y}`;
    const A = (p, sweep, large) => d += ` A ${R} ${R} 0 ${large} ${sweep} ${p.x} ${p.y}`;

    /* ─── 1 × 1 board : just a filled circle ─────────────── */
    if (n === 1) {
        const c = centres[0];
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx',   c.x);
        circle.setAttribute('cy',   c.y);
        circle.setAttribute('r',    R);
        circle.setAttribute('fill', SNAKE_COLOR);
        svg.append(circle);
        return;
    }

    /* ─── direction vectors of the centre line ───────────── */
    const D = [];
    for (let i = 0; i < n - 1; ++i) D.push(dir(centres[i], centres[i + 1]));

    /* ======================================================
         LEFT WALL   (head ➜ tail)
       ====================================================== */
    const NL0   = left(D[0]);
    const start = { x: centres[0].x + NL0.x * R, y: centres[0].y + NL0.y * R };
    d = `M ${start.x} ${start.y}`;

    for (let i = 1; i <= n - 2; ++i) {
        const dp = D[i - 1], dn = D[i];
        if (dp.x === dn.x && dp.y === dn.y) continue;     // straight

        const prev = { x: centres[i].x + left(dp).x * R,
                       y: centres[i].y + left(dp).y * R };
        L(prev);

        const next = { x: centres[i].x + left(dn).x * R,
                       y: centres[i].y + left(dn).y * R };
        const cross = dp.x * dn.y - dp.y * dn.x;

        /* FIX #1 ─ quarter-arc sweep:
           left-wall needs  CW   if cross>0   (left turn)
                            CCW  if cross<0   (right turn)          */
        A(next, cross > 0 ? 1 : 0, 0);
    }

    const tailLeft = { x: centres[n - 1].x + left(D[n - 2]).x * R,
                       y: centres[n - 1].y + left(D[n - 2]).y * R };
    L(tailLeft);

    /* ======================================================
         TAIL CAP   (left ➜ right)
       ====================================================== */
    const tailRight = { x: centres[n - 1].x + right(D[n - 2]).x * R,
                        y: centres[n - 1].y + right(D[n - 2]).y * R };

    /* FIX #2 ─ the outside of the tube is *always* clockwise */
    A(tailRight, 1, 1);                                    // 180°, CW

    /* ======================================================
         RIGHT WALL   (tail ➜ head)  =  left wall of reversed line
       ====================================================== */
    const centresR = centres.slice().reverse();
    const DR = [];
    for (let i = 0; i < n - 1; ++i) DR.push(dir(centresR[i], centresR[i + 1]));

    for (let i = 1; i <= n - 2; ++i) {
        const dp = DR[i - 1], dn = DR[i];
        if (dp.x === dn.x && dp.y === dn.y) continue;

        const prev = { x: centresR[i].x + left(dp).x * R,
                       y: centresR[i].y + left(dp).y * R };
        L(prev);

        const next = { x: centresR[i].x + left(dn).x * R,
                       y: centresR[i].y + left(dn).y * R };
        const cross = dp.x * dn.y - dp.y * dn.x;
        A(next, cross > 0 ? 1 : 0, 0);
    }

    const headRight = { x: centres[0].x + right(D[0]).x * R,
                        y: centres[0].y + right(D[0]).y * R };
    L(headRight);

    /* ======================================================
         HEAD CAP   (right ➜ left)  +  close
       ====================================================== */
    A(start, 1, 1);                                        // 180°, CW
    d += ' Z';

    /* ─── inject into the SVG ────────────────────────────── */
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

    const cols = +ui.cols.value; // unary + → number
    const rows = +ui.rows.value;

    const width  = cols * CELL_SIZE + CELL_SIZE - SNAKE_WIDTH;
    const height = rows * CELL_SIZE + CELL_SIZE - SNAKE_WIDTH;

    const svg = setupSvg(ui.drawing, width, height);
    const svgQ = setupSvg(ui.drawingQ, width, height);

    updateUI('Working …', { busy: true });

    worker = new Worker(WORKER_URL, { type: 'module' });
    worker.postMessage({ cols, rows, version: ui.version.textContent });

    worker.onmessage = ({ data }) => {
        if (data.debug) {
            console.log('%cworker:', 'color:grey', data.debug);
            return;
        }

        drawSnake(svg, data.path, cols, rows, width, height);
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
