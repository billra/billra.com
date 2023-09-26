// animate.js

let gDrawCorners = false;
let gWrapEdge = false; // wrap or bounce

let gEraseCanvas = true;
let gEraseCanvasOnce; // after resize or other change

let gCanvas;
let gCtx;
let gRequest;
let gBalls;
let gUpdateCount = 0;
let gBallCount = 20;
let gFrameCount = 0;
let gStartTime = performance.now();
let gIntervalId = 0;

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

function populate() {
    gBalls = Array.from({length: gBallCount}, () => new Ball(gCanvas));
}

function cancelAnimation() {
    if (!gRequest) {
        return false;
    }
    cancelAnimationFrame(gRequest);
    gRequest = undefined;
    return true;
}

function animate() {
    gFrameCount++;
    gCtx.fillStyle = "#000000";
    if (gEraseCanvas || gEraseCanvasOnce) {
        // take into account the original translate, otherwise we get a grey outline in corner
        gCtx.fillRect(-0.5, -0.5, gCanvas.width, gCanvas.height);
    }
    gEraseCanvasOnce = false;

    for (let ball of gBalls) {
        ball.draw(gCtx);
        ball.step(gCanvas,gWrapEdge);
    }
    if (gDrawCorners) {
        gCtx.strokeStyle = "#FF0000"; // red
        gCtx.lineWidth = 1;
        gCtx.strokeRect(0, 0, 2, 2);
        gCtx.strokeRect(0, gCanvas.height - 3, 2, 2);
        gCtx.strokeRect(gCanvas.width - 3, 0, 2, 2);
        gCtx.strokeRect(gCanvas.width - 3, gCanvas.height - 3, 2, 2); // drawable pixels are [0 to canvas.width-1] and [0 to canvas.height-1] (after ctx.translate)
    }
    gRequest = requestAnimationFrame(animate);
}

window.addEventListener("keydown", event => {
    // console.log(event.key);
    if (event.key === 'k') { // draw corner markers (debugging canvas size)
        gDrawCorners = !gDrawCorners;
        gEraseCanvasOnce = true;
    } else if (event.key === 'w') { // balls bounce or wrap around edge
        gWrapEdge = !gWrapEdge;
    } else if (event.key === 'e') { // erase canvas or leave ball trails
        gEraseCanvas = !gEraseCanvas;
    } else if (event.key === ' ') { // pause/resume animation
        if (!cancelAnimation()) {
            gRequest = requestAnimationFrame(animate);
        }
    } else if (/^[0-9]$/.test(event.key)) { // specify number of balls
        gUpdateCount = gUpdateCount * 10 + parseInt(event.key);
    } else if (event.key === 'Enter') { // change number of balls
        if (gUpdateCount === 0) {
            return; // protect against double enter
        }
        cancelAnimation();
        gBallCount = gUpdateCount;
        gUpdateCount = 0;
        populate();
        gEraseCanvasOnce = true;
        gRequest = requestAnimationFrame(animate);
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
        const fps = 1000 * gFrameCount / elapsedTime;
        gFrameCount = 0;
        gStartTime = performance.now();
        fpsDisplay.innerHTML = `${fps.toFixed(2)}`;
    }, 1000);
}

window.onresize = () => {
    cancelAnimation();
    gCanvas.width = window.innerWidth;
    gCanvas.height = window.innerHeight;
    // console.log(`canvas size: ${canvas.width} ${canvas.height}`);
    populate();
    gCtx = gCanvas.getContext("2d");
    gCtx.translate(.5, .5);
    gEraseCanvasOnce = true;
    gRequest = requestAnimationFrame(animate);
};

window.onload = () => {
    gCanvas = document.getElementById("my_canvas");
    window.onresize();
};
