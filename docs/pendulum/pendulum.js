class FPS {
    constructor() {
        this.fpsDisplay = document.getElementById("fps-display");
        this.running = false;
    }
    start() {
        if (this.running) { return; }
        this.running = true;
        this.startTime = performance.now();
        this.frameCount = 0;
        // update FPS display every second
        this.intervalId = setInterval(() => {
            const currentTime = performance.now();
            const elapsedTime = currentTime - this.startTime;
            const fps = 1000 * this.frameCount / elapsedTime;
            this.frameCount = 0;
            this.startTime = performance.now();
            this.fpsDisplay.textContent = `${fps.toFixed(2)}`;
        }, 1000);
        this.frameRequest = requestAnimationFrame(() => this.animate()); // arrow to maintain context
    }
    stop() {
        if (!this.running) { return; }
        this.running = false;
        clearInterval(this.intervalId);
        this.fpsDisplay.textContent = '';
        cancelAnimationFrame(this.frameRequest);
    }
    animate() {
        this.frameCount++;
        this.frameRequest = requestAnimationFrame(() => this.animate()); // arrow to maintain context
    }
}

class Pendulum {
    constructor() {
        // With equilibrium at theta = π, we set g negative so the pendulum hangs downward.
        this.g = -9.81;    // m/s²
        this.m1 = 4;       // kg
        this.m2 = 2;       // kg
        this.l1 = 5;       // meters
        this.l2 = 5;       // meters
        this.scale;        // calculated in resizeCanvas()
        this.damping = 0.9999;

        // Initial state [θ₁, θ₂, ω₁, ω₂]. With equilibrium at π.
        this.theta1 = Math.PI - 0.2; // Small offsets so there is
        this.theta2 = Math.PI + 0.4; // some movement at start.
        this.omega1 = 0;
        this.omega2 = 0;

        // don't attempt to calculate positions for fps < 30, just slow simulation down
        this.maxDeltaTime = 1 / 30;

        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        this.dragging = false;

        // start animation
        this.lastTime = performance.now();
        this.animate();

        // ui events
        document.addEventListener('mousedown', e => {
            this.beginDrag(e.clientX, e.clientY);
        });
        document.addEventListener('mousemove', e => {
            if (this.dragging) {
                this.updateDrag(e.clientX, e.clientY);
            }
        });
        document.addEventListener('mouseup', () => this.endDrag());
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    derivatives(state) {
        const [t1, t2, w1, w2] = state;
        const delta = t1 - t2;
        const cosDelta = Math.cos(delta);
        const sinDelta = Math.sin(delta);
        const sin2Delta = Math.sin(2 * delta);

        // Common denominator from your formulation.
        const denom = this.m2 * (this.m1 + this.m2) * this.l1 ** 2 * this.l2 ** 2 -
            this.m2 ** 2 * this.l1 ** 2 * this.l2 ** 2 * cosDelta ** 2;

        const dw1 = (-this.l1 * this.m2 ** 2 * this.l2 ** 3 * w2 ** 2 * sinDelta -
            this.m2 * this.g * this.l1 * Math.sin(t1) * (this.m1 + this.m2) * this.l2 ** 2 -
            0.5 * sin2Delta * (this.m2 * this.l1 * this.l2 * w1) ** 2 +
            this.g * this.l1 * Math.sin(t2) * cosDelta * (this.m2 * this.l2) ** 2) / denom;

        const dw2 = (this.m2 * (this.m1 + this.m2) * this.l2 * this.l1 ** 3 * w1 ** 2 * sinDelta -
            this.m2 * (this.m1 + this.m2) * this.g * this.l2 * Math.sin(t2) * this.l1 ** 2 +
            0.5 * sin2Delta * (this.m2 * this.l1 * this.l2 * w2) ** 2 +
            this.m2 * (this.m1 + this.m2) * this.g * this.l2 * Math.sin(t1) * cosDelta * this.l1 ** 2) / denom;

        return [w1, w2, dw1, dw2];
    }

    rk4Step(state, dt) {
        const k1 = this.derivatives(state);
        const k2 = this.derivatives(state.map((s, i) => s + k1[i] * dt / 2));
        const k3 = this.derivatives(state.map((s, i) => s + k2[i] * dt / 2));
        const k4 = this.derivatives(state.map((s, i) => s + k3[i] * dt));

        return state.map((s, i) =>
            s + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
        );
    }

    update(deltaTime) {
        if (this.dragging) return;  // Pause simulation during dragging.
        const state = [this.theta1, this.theta2, this.omega1, this.omega2];
        const newState = this.rk4Step(state, deltaTime);
        [this.theta1, this.theta2, this.omega1, this.omega2] = newState;
        this.omega1 *= this.damping;
        this.omega2 *= this.damping;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Compute positions.
        const x1 = this.pivotX + this.l1 * this.scale * Math.sin(this.theta1);
        const y1 = this.pivotY - this.l1 * this.scale * Math.cos(this.theta1);
        const x2 = x1 + this.l2 * this.scale * Math.sin(this.theta2);
        const y2 = y1 - this.l2 * this.scale * Math.cos(this.theta2);

        // Draw rods.
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.pivotX, this.pivotY);
        this.ctx.lineTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();

        // Draw masses.
        this.ctx.fillStyle = 'red';
        this.ctx.beginPath();
        this.ctx.arc(x1, y1, 8, 0, Math.PI * 2);
        this.ctx.arc(x2, y2, 8, 0, Math.PI * 2);
        this.ctx.fill();
    }

    animate() {
        const now = performance.now();
        const deltaTime = Math.min(this.maxDeltaTime, (now - this.lastTime) / 1000);
        this.lastTime = now;
        this.update(deltaTime);
        this.draw();
        requestAnimationFrame(() => this.animate()); // arrow to maintain context
    }

    // When the user presses the mouse, start dragging regardless of click position
    beginDrag(x, y) {
        this.dragging = true;
        // Immediately update the state so the end follows the cursor
        this.updateDrag(x, y);
    }

    // Inverse kinematics to set the angles so that the pendulum’s end reaches the mouse.
    updateDrag(x, y) {
        // Convert the mouse position into "pendulum space."
        const dx = (x - this.pivotX) / this.scale;
        const dy = (this.pivotY - y) / this.scale; // Note: pivotY - y converts canvas y to pendulum-space y.
        let r = Math.sqrt(dx * dx + dy * dy);
        // Clamp r so the target is not farther than the arm can reach.
        r = Math.min(r, this.l1 + this.l2);
        // gamma is the angle from vertical (pointing down) to the target.
        const gamma = Math.atan2(dx, dy);
        // Use the cosine law to get the angle between the segments.
        let cosAngle = (r * r - this.l1 * this.l1 - this.l2 * this.l2) / (2 * this.l1 * this.l2);
        cosAngle = Math.max(-1, Math.min(1, cosAngle));
        const angleBetween = Math.acos(cosAngle);
        // Determine the offset angle.
        const delta = Math.atan2(this.l2 * Math.sin(angleBetween), this.l1 + this.l2 * Math.cos(angleBetween));
        const theta1 = gamma - delta;
        const theta2 = theta1 + angleBetween;
        this.theta1 = theta1;
        this.theta2 = theta2;
        this.omega1 = 0;
        this.omega2 = 0;
    }

    endDrag() {
        this.dragging = false;
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.pivotX = this.canvas.width / 2;
        this.pivotY = this.canvas.height / 2;
        // Scale for pendulum to fit in screen.
        const minDimension = Math.min(this.canvas.width, this.canvas.height);
        this.scale = (7 / 16 * minDimension) / (this.l1 + this.l2);
    }
}

const keyActions = {
    'F1': () => {
        document.getElementById('popup').style.display = 'block';
        gFPS.start();
    },
    'Escape': () => {
        document.getElementById('popup').style.display = 'none';
        gFPS.stop();
    }
};

window.addEventListener("keydown", event => {
    const keyAction = keyActions[event.key];
    if (keyAction) {
        event.preventDefault();
        keyAction();
    }
});

let gFPS;
let gPendulum;

window.addEventListener("load", () => {
    gFPS = new FPS();
    gPendulum = new Pendulum();
});
