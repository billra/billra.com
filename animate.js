// animate.js

let drawCorners = false;
let wrapEdge = false; // wrap or bounce

let eraseCanvas = true;
let eraseCanvasOnce; // after resize or other change

let canvas;
let ctx;
let request;
let balls;
let updateCount = 0;
let count = 1000;

function rndVelocity() {
    return (.5 + Math.random() * 3) * (Math.round(Math.random()) * 2 - 1);
}

function populate() {
    balls = Array.from({length: count}, () => {
        const r = 5 + Math.random() * 10;
        return {
            r,
            x: r + Math.random() * (canvas.width - 2 * r),
            y: r + Math.random() * (canvas.height - 2 * r),
            vx: rndVelocity(),
            vy: rndVelocity(),
            hue: Math.floor(Math.random() * 256)
        };
    });
}

function cancelAnimation() {
    if (!request) {
        return false;
    }
    cancelAnimationFrame(request);
    request = undefined;
    return true;
}

function animate() {
    ctx.fillStyle = "#000000";
    if (eraseCanvas || eraseCanvasOnce) {
        // take into account the original translate, otherwise we get a grey outline in corner
        ctx.fillRect(-0.5, -0.5, canvas.width, canvas.height);
    }
    eraseCanvasOnce = false;

    for (let ball of balls) {
        // draw
        ctx.fillStyle = `hsl(${ball.hue++}, 100%, 60%)`;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2, true);
        ctx.fill();

        ball.x += ball.vx;
        ball.y += ball.vy;

        if (ball.x - ball.r < 0) {
            // todo: this 'sticks' value to edge, may want 'fold' value across edge
            ball.x = wrapEdge ? canvas.width - 1 - ball.r : ball.r;
            ball.vx *= wrapEdge ? 1 : -1;
        } else if (ball.x + ball.r > canvas.width - 1) {
            ball.x = wrapEdge ? ball.r : canvas.width - 1 - ball.r;
            ball.vx *= wrapEdge ? 1 : -1;
        }
        if (ball.y - ball.r < 0) {
            ball.y = wrapEdge ? canvas.height - 1 - ball.r : ball.r;
            ball.vy *= wrapEdge ? 1 : -1;
        } else if (ball.y + ball.r > canvas.height - 1) {
            ball.y = wrapEdge ? ball.r : canvas.height - 1 - ball.r;
            ball.vy *= wrapEdge ? 1 : -1;
        }
    }
    if (drawCorners) {
        ctx.strokeStyle = "#FF0000"; // red
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, 2, 2);
        ctx.strokeRect(0, canvas.height - 3, 2, 2);
        ctx.strokeRect(canvas.width - 3, 0, 2, 2);
        ctx.strokeRect(canvas.width - 3, canvas.height - 3, 2, 2); // drawable pixels are [0 to canvas.width-1] and [0 to canvas.height-1] (after ctx.translate)
    }
    request = requestAnimationFrame(animate);
}

window.addEventListener("keydown", event => {
    console.log(event.key);
    if (event.key === 'k') { // draw corner markers (debugging canvas size)
        drawCorners = !drawCorners;
        eraseCanvasOnce = true;
    } else if (event.key === 'w') { // balls bounce or wrap around edge
        wrapEdge = !wrapEdge;
    } else if (event.key === 'e') { // erase canvas or leave ball trails
        eraseCanvas = !eraseCanvas;
    } else if (event.key === ' ') { // pause/resume animation
        if (!cancelAnimation()) {
            request = requestAnimationFrame(animate);
        }
    } else if (/^[0-9]$/.test(event.key)) { // specify number of balls
        updateCount = updateCount * 10 + parseInt(event.key);
    } else if (event.key === 'Enter') { // change number of balls
        if (updateCount === 0) {
            return; // protect against double enter
        }
        cancelAnimation();
        count = updateCount;
        updateCount = 0;
        populate();
        eraseCanvasOnce = true;
        request = requestAnimationFrame(animate);
    } else if (event.key === 'F1') { // show documentation
        event.preventDefault();
        const modal = document.getElementById("documentation-modal");
        modal.style.display = modal.style.display === "block" ? "none" : "block";
    } else if (event.key === 'Escape') { // hide modal on escape key press
        event.preventDefault();
        const modal = document.getElementById("documentation-modal");
        modal.style.display = "none";
    }
});

window.onresize = () => {
    cancelAnimation();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    console.log(`canvas.width: ${canvas.width} ${canvas.height}`);
    populate();
    ctx = canvas.getContext("2d");
    ctx.translate(.5, .5);
    eraseCanvasOnce = true;
    request = requestAnimationFrame(animate);
};

window.onload = () => {
    canvas = document.getElementById("my_canvas");
    window.onresize();
};
