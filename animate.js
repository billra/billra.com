// animate.js

let gAnimation;
let gEnterNumber;
let gFPS;

class EnterNumber {
    constructor() {
        this.value = 0;
    }
    complete(key) {
        if (/^[0-9]$/.test(key)) { // number of balls digit by digit
            this.value = this.value * 10 + parseInt(key);
            return false;
        }
        if (key === 'Enter') { // change number of balls
            return this.value;
        }
        return false;
    }
}

class FPS {
    constructor() {
        this.fpsDisplay = document.getElementById("fps-display");
        this.intervalId = 0;
        this.frameCount = { value: 0 }; // allow frameCount.value pass by reference
    }
    start() {
        this.frameCount.value = 0;
        this.startTime = performance.now();
        this.intervalId = setInterval(() => {
            const currentTime = performance.now();
            const elapsedTime = currentTime - this.startTime;
            const fps = 1000 * this.frameCount.value / elapsedTime;
            this.frameCount.value = 0;
            this.startTime = performance.now();
            this.fpsDisplay.textContent = `${fps.toFixed(2)}`;
        }, 1000);
    }
    stop() {
        clearInterval(this.intervalId);
        this.intervalId = 0;
        this.fpsDisplay.textContent = '';
    }
}

class Ball {
    constructor(canvas) {
        this.r = 5 + Math.random() * 10;
        this.x = this.r + Math.random() * (canvas.width - 2 * this.r);
        this.y = this.r + Math.random() * (canvas.height - 2 * this.r);
        this.vx = this.rndVelocity();
        this.vy = this.rndVelocity();
        this.hue = Math.floor(Math.random() * 256);
    }
    rndVelocity() {
        return (.5 + Math.random() * 3) * (Math.round(Math.random()) * 2 - 1);
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

class Animation {
    constructor(ballCount, frameCount) {
        this.drawCorners = false;
        this.wrapEdge = false; // wrap or bounce
        this.eraseCanvas = true;
        this.canvas = document.getElementById("my_canvas");
        this.ctx = this.canvas.getContext("2d");
        this.setupCanvasAndContext();
        this.frameCount = frameCount; // external object to update
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
        this.frameCount.value++;
        if (this.eraseCanvas) {
            // take into account the original translate
            this.ctx.clearRect(-0.5, -0.5, this.canvas.width, this.canvas.height);
        }
        for (let ball of this.balls) {
            ball.draw(this.ctx);
            ball.step(this.canvas, this.wrapEdge);
        }
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

window.addEventListener("keydown", event => {
    // console.log(event.key);
    if (event.key === 'k') { // draw corner markers (debugging canvas size)
        gAnimation.drawCorners = true;
    } else if (event.key === 'w') { // balls bounce or wrap around edge
        gAnimation.wrapEdge = !gAnimation.wrapEdge;
    } else if (event.key === 'e') { // erase canvas or leave ball trails
        gAnimation.eraseCanvas = !gAnimation.eraseCanvas;
    } else if (event.key === ' ') { // pause/resume animation
        gAnimation.toggleAnimation();
    } else if (gEnterNumber.complete(event.key)) { // change number of balls
        gAnimation.stopAnimation();
        gAnimation = new Animation(gEnterNumber.value, gFPS.frameCount);
        gEnterNumber = new EnterNumber();
    } else if (event.key === 'F1') { // show documentation
        event.preventDefault();
        showInfo(true);
    } else if (event.key === 'Escape') { // hide modal on escape key press
        event.preventDefault();
        showInfo(false);
    }
});

function showInfo(flip) {
    const popup = document.getElementById("popup");
    const from = getComputedStyle(popup).display;
    const to = flip ? (from === "none" ? "block" : "none") : "none";
    if (from === to) {
        return;
    }
    if (to === 'none') {
        popup.style.display = "none";
        gFPS.stop();
        return;
    }
    popup.style.display = "block";
    gFPS.start();
}

window.addEventListener("resize", () => {
    gAnimation.setupCanvasAndContext();
});

window.addEventListener("load", () => {
    gFPS = new FPS();
    gAnimation = new Animation(20, gFPS.frameCount);
    gEnterNumber = new EnterNumber();
});
