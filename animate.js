// animate.js

let gAnimation;
let gEnterNumber;

let gStartTime = performance.now();
let gIntervalId = 0;

class EnterNumber {
    constructor() {
        this.value = 0;
    }
    complete(key) {
        if (/^[0-9]$/.test(key)) { // number of balls digit by digit
            this.value = this.value * 10 + parseInt(key);
            return false
        }
        if (key === 'Enter') { // change number of balls
            return this.value;
        }
        return false;
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
    step(canvas,wrapEdge) {
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
    constructor(ballCount) {
        this.ballCount = ballCount;
        this.drawCorners = false;
        this.wrapEdge = false; // wrap or bounce
        this.eraseCanvas = true;
        this.canvas = document.getElementById("my_canvas");
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx = this.canvas.getContext("2d");
        this.ctx.translate(.5, .5);
        this.frameCount = 0;
        this.balls = Array.from({length: this.ballCount}, () => new Ball(this.canvas));
        this.animate = this.animate.bind(this);
        this.startAnimation();
    }

    startAnimation() {
        this.frameRequest = requestAnimationFrame(this.animate);
    }

    stopAnimation() {
        if (!this.frameRequest) {
            return false;
        }
        cancelAnimationFrame(this.frameRequest);
        this.frameRequest = undefined;
        return true;
    }

    animate() {
        this.frameCount++;
        this.ctx.fillStyle = "#000000";
        if (this.eraseCanvas) {
            // take into account the original translate, otherwise we get a grey outline in corner
            this.ctx.fillRect(-0.5, -0.5, this.canvas.width, this.canvas.height);
        }
        for (let ball of this.balls) {
            ball.draw(this.ctx);
            ball.step(this.canvas,this.wrapEdge);
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
    } else if (event.key === ' ') { // pause/resume animation  todo: toggleAnimation function ***
        if (!gAnimation.stopAnimation()) {
            gAnimation.request = requestAnimationFrame(gAnimation.animate);
        }
    } else if (gEnterNumber.complete(event.key)) { // change number of balls
        gAnimation.stopAnimation();
        gAnimation = new Animation(gEnterNumber.value);
        gEnterNumber = new EnterNumber();
    } else if (event.key === 'F1') { // show documentation
        event.preventDefault();
        handleInterval(true);
    } else if (event.key === 'Escape') { // hide modal on escape key press
        event.preventDefault();
        handleInterval(false);
    }
});

function handleInterval(flip){
    const modal = document.getElementById("popup");
    const from = getComputedStyle(modal).display;
    const to = flip ? ( from === "none" ? "block" : "none" ) : "none";
    if ( from === to ){
        return;
    }
    const fpsDisplay = document.getElementById("fps-display");
    if ( to === 'none'){
        modal.style.display = "none";
        clearInterval(gIntervalId);
        gIntervalId = 0;
        fpsDisplay.innerHTML='';
        return;
    }
    modal.style.display = "block";
    // fps display
    gIntervalId = setInterval(() => {
        const currentTime = performance.now();
        const elapsedTime = currentTime - gStartTime;
        const fps = 1000 * gAnimation.frameCount / elapsedTime;
        gAnimation.frameCount = 0;
        gStartTime = performance.now();
        fpsDisplay.innerHTML = `${fps.toFixed(2)}`;
    }, 1000);
}

window.onresize = () => { // todo: non-continuous
    gAnimation.stopAnimation();
    gAnimation = new Animation(gAnimation.ballCount);
    gEnterNumber = new EnterNumber();
};

window.onload = () => {
    gAnimation = new Animation(20);
    gEnterNumber = new EnterNumber();
};
