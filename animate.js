// animate.js

let draw_corners = false;
let wrap_edge = false; // wrap or bounce

let erase_canvas = true;
let erase_canvas_once; // after resize or other change

let canvas;
let ctx;
let request;
let balls;
let updateCount = 0;
let count = 1000;

function rnd_velocity() {
    return (.5 + Math.random() * 3) * (Math.round(Math.random()) * 2 - 1);
}

function populate() {
    balls = [];
    for (let i = 0; i < count; ++i) {
        const r = 5 + Math.random() * 10;
        balls.push({
            r: r,
            x: r + Math.random() * (canvas.width - 2 * r),
            y: r + Math.random() * (canvas.height - 2 * r),
            vx: rnd_velocity(),
            vy: rnd_velocity(),
            hue: Math.floor(Math.random() * 256)
        });
    }
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
    if (erase_canvas || erase_canvas_once) {
        // take into account the original translate, otherwise we get a grey outline in corner
        ctx.fillRect(-0.5, -0.5, canvas.width, canvas.height);
    }
    erase_canvas_once = false;

    for (let i = 0; i < balls.length; i++) {
        // draw
        ctx.fillStyle = `hsl(${balls[i].hue++}, 100%, 60%)`;
        ctx.beginPath();
        ctx.arc(balls[i].x, balls[i].y, balls[i].r, 0, Math.PI * 2, true);
        ctx.fill();

        balls[i].x += balls[i].vx;
        balls[i].y += balls[i].vy;

        if (balls[i].x - balls[i].r < 0) {
            if (wrap_edge) {
                balls[i].x = canvas.width - 1 - balls[i].r; // todo: this 'sticks' value to edge, may want 'fold' value across edge
            } else {
                balls[i].x = balls[i].r; // todo: this 'sticks' value to edge, may want 'fold' value across edge
                balls[i].vx *= -1; // reverse direction, 'bounce'
            }
        } else if (balls[i].x + balls[i].r > canvas.width - 1) {
            if (wrap_edge) {
                balls[i].x = balls[i].r;
            } else {
                balls[i].x = canvas.width - 1 - balls[i].r;
                balls[i].vx *= -1;
            }
        }
        if (balls[i].y - balls[i].r < 0) {
            if (wrap_edge) {
                balls[i].y = canvas.height - 1 - balls[i].r;
            } else {
                balls[i].y = balls[i].r;
                balls[i].vy *= -1;
            }
        } else if (balls[i].y + balls[i].r > canvas.height - 1) {
            if (wrap_edge) {
                balls[i].y = balls[i].r;
            } else {
                balls[i].y = canvas.height - 1 - balls[i].r;
                balls[i].vy *= -1;
            }
        }
    }
    if (draw_corners) {
        ctx.strokeStyle = "#FF0000"; // red
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, 2, 2);
        ctx.strokeRect(0, canvas.height - 3, 2, 2);
        ctx.strokeRect(canvas.width - 3, 0, 2, 2);
        ctx.strokeRect(canvas.width - 3, canvas.height - 3, 2, 2); // drawable pixels are [0 to canvas.width-1] and [0 to canvas.height-1] (after ctx.translate)
    }
    request = requestAnimationFrame(animate);
}

window.addEventListener("keydown", function (event) {
    console.log(event.key);
    if (event.key === 'k') { // draw corner markers (debugging canvas size)
        draw_corners = !draw_corners;
        erase_canvas_once = true;
    } else if (event.key === 'w') { // balls bounce or wrap around edge
        wrap_edge = !wrap_edge;
    } else if (event.key === 'e') { // erase canvas or leave ball trails
        erase_canvas = !erase_canvas;
    } else if (event.key === ' ') { // pause/resume animation
        if (!cancelAnimation()) {
            request = requestAnimationFrame(animate);
        }
    } else if (/^[0-9]$/.test(event.key)) { // specify number of balls
        updateCount *= 10;
        updateCount += parseInt(event.key);
    } else if (event.key === 'Enter') { // change number of balls
        if (updateCount === 0) {
            return; // protect against double enter
        }
        cancelAnimation();
        count = updateCount;
        updateCount = 0;
        populate();
        erase_canvas_once = true;
        request = requestAnimationFrame(animate);
    } else if (event.key === 'F1') { // show documentation
        event.preventDefault();
        const modal = document.getElementById("documentation-modal");
        if (modal.style.display === "block") {
            modal.style.display = "none";
        } else {
            modal.style.display = "block";
        }
    } else if (event.key === 'Escape') { // hide modal on escape key press
        event.preventDefault();
        const modal = document.getElementById("documentation-modal");
        modal.style.display = "none";
    }
});

window.onresize = function () {
    cancelAnimation();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    console.log(`canvas.width: ${canvas.width} ${canvas.height}`);
    populate();
    ctx = canvas.getContext("2d");
    ctx.translate(.5, .5);
    erase_canvas_once = true;
    request = requestAnimationFrame(animate);
};

window.onload = function () {
    canvas = document.getElementById("my_canvas");
    window.onresize();
};
