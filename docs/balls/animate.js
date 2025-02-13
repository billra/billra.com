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

class Ball {
    constructor(canvas) {
        const minRadius = 5; // inclusive
        const maxRadius = 12; // exclusive
        this.r = minRadius + Math.random() * (maxRadius - minRadius);
        this.x = this.r + Math.random() * (canvas.width - 2 * this.r);
        this.y = this.r + Math.random() * (canvas.height - 2 * this.r);
        [this.vx, this.vy] = this.setVelocity();
        this.hue = Math.floor(Math.random() * 256);
    }
    setVelocity() {
        const minVelocity = 1; // inclusive
        const maxVelocity = 3.5; // exclusive
        const velocity = minVelocity + Math.random() * (maxVelocity - minVelocity);
        const angle = Math.random() * 2 * Math.PI; // angle between 0 (inclusive) and 360 (exclusive) degrees
        const vx = velocity * Math.cos(angle);
        const vy = velocity * Math.sin(angle); // decompose velocity into x and y components
        return [vx, vy];
    }
    draw(ctx) {
        ctx.fillStyle = `hsl(${this.hue++}, 100%, 60%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2, true);
        ctx.fill();
    }
    step(canvas, wrapEdge) {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x - this.r < 0) {
            // todo: this 'sticks' value to edge, may want 'fold' value across edge
            this.x = wrapEdge ? canvas.width - 1 - this.r : this.r;
            this.vx *= wrapEdge ? 1 : -1;
        } else if (this.x + this.r > canvas.width - 1) {
            this.x = wrapEdge ? this.r : canvas.width - 1 - this.r;
            this.vx *= wrapEdge ? 1 : -1;
        }
        if (this.y - this.r < 0) {
            this.y = wrapEdge ? canvas.height - 1 - this.r : this.r;
            this.vy *= wrapEdge ? 1 : -1;
        } else if (this.y + this.r > canvas.height - 1) {
            this.y = wrapEdge ? this.r : canvas.height - 1 - this.r;
            this.vy *= wrapEdge ? 1 : -1;
        }
    }
}

// In a 2D collision between two balls of equal mass, the normal (perpendicular
// to the collision plane) components of the velocities are swapped while the
// tangential components remain the same.
function collisionUpdate(ball1, ball2) {
    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const distance = Math.sqrt(dx ** 2 + dy ** 2);
    const minDistance = ball1.r + ball2.r;
    if (distance > minDistance) {
        return; // no collision
    }

    const normalX = dx / distance;
    const normalY = dy / distance;
    const tangentX = -normalY;
    const tangentY = normalX;

    const nv1 = ball1.vx * normalX + ball1.vy * normalY; // calculate normal velocity
    const nv2 = ball2.vx * normalX + ball2.vy * normalY;
    const tv1 = ball1.vx * tangentX + ball1.vy * tangentY; // calculate tangent velocity
    const tv2 = ball2.vx * tangentX + ball2.vy * tangentY;

    // swap normal velocity, keep tangential velocity
    ball1.vx = nv2 * normalX + tv1 * tangentX;
    ball1.vy = nv2 * normalY + tv1 * tangentY;
    ball2.vx = nv1 * normalX + tv2 * tangentX;
    ball2.vy = nv1 * normalY + tv2 * tangentY;
}

function doCollisions(balls) {
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            collisionUpdate(balls[i], balls[j]);
        }
    }
}

window.addEventListener("click", event => {
    const rect = gAnimation.canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    for (let ball of gAnimation.balls) {
        const velocity = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
        // vector from the ball to the click point
        const dx = clickX - ball.x;
        const dy = clickY - ball.y;
        // angle of the vector
        const angle = Math.atan2(dy, dx);
        // ball aimed at click point, no change in velocity
        ball.vx = Math.cos(angle) * velocity;
        ball.vy = Math.sin(angle) * velocity;
    }
});

class Animation {
    constructor(ballCount) {
        this.drawCorners = false;
        this.wrapEdge = false; // wrap or bounce
        this.eraseCanvas = true;
        this.canvas = document.getElementById("my_canvas");
        this.ctx = this.canvas.getContext("2d");
        this.setupCanvasAndContext();
        this.balls = Array.from({ length: ballCount }, () => new Ball(this.canvas));
        this.animate = this.animate.bind(this);
        this.startAnimation();
    }

    setupCanvasAndContext() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.translate(.5, .5); // coordinates centered on pixel
    }

    startAnimation() { // should only be called if there is no existing frame request
        if (this.frameRequest) {
            throw new Error('frameRequest already exists');
        }
        this.startAnimationUnchecked();
    }

    stopAnimation() { // can be called even without an outstanding frame request
        if (this.frameRequest) {
            this.stopAnimationUnchecked();
        }
    }

    startAnimationUnchecked() { // for internal use
        this.frameRequest = requestAnimationFrame(this.animate);
    }

    stopAnimationUnchecked() { // for internal use
        cancelAnimationFrame(this.frameRequest);
        this.frameRequest = undefined;
    }

    toggleAnimation() {
        if (this.frameRequest) {
            this.stopAnimationUnchecked();
        } else {
            this.startAnimationUnchecked();
        }
    }

    animate() {
        if (this.eraseCanvas) {
            // take into account the original translate
            this.ctx.clearRect(-0.5, -0.5, this.canvas.width, this.canvas.height);
        }
        for (let ball of this.balls) {
            ball.draw(this.ctx);
            ball.step(this.canvas, this.wrapEdge); // ball to wall collisions
        }
        doCollisions(this.balls); // inter ball collisions
        if (this.drawCorners) {
            this.ctx.strokeStyle = "#FF0000"; // red
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(0, 0, 2, 2);
            this.ctx.strokeRect(0, this.canvas.height - 3, 2, 2);
            this.ctx.strokeRect(this.canvas.width - 3, 0, 2, 2);
            // drawable pixels are [0 to canvas.width-1] and [0 to canvas.height-1] (after ctx.translate)
            this.ctx.strokeRect(this.canvas.width - 3, this.canvas.height - 3, 2, 2);
        }
        this.frameRequest = requestAnimationFrame(this.animate);
    }
}

const keyActions = {
    'k': () => { gAnimation.drawCorners = true; },
    'w': () => { gAnimation.wrapEdge = !gAnimation.wrapEdge; },
    'e': () => { gAnimation.eraseCanvas = !gAnimation.eraseCanvas; },
    ' ': () => { gAnimation.toggleAnimation(); },
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

window.addEventListener("resize", () => {
    gAnimation.setupCanvasAndContext();
});

// prevent ball control click from propagating
document.getElementById('ballControl').addEventListener('click', function (event) {
    event.stopPropagation();
});

function defaultBallCount() {
    document.getElementById('numBalls').value = 120;
}

function ballAnimation() {
    const numBalls = document.getElementById('numBalls').value;
    // prevent previous animation being kept alive by requestAnimationFrame calls
    gAnimation?.stopAnimation();
    gAnimation = new Animation(numBalls);
}

let gFPS;
let gAnimation;

window.addEventListener("load", () => {
    gFPS = new FPS();
    defaultBallCount();
    ballAnimation();
});

// todo:
// - multiple simultaneous collisions, two pass
//   - collect updates (new members)
//   - apply
// - still small chance of division by zero, or move past
// - add timeOfCollision to new path
