// animate.js

var draw_corners = false;
var wrap_edge = false; // wrap or bounce

var canvas;

var updateCount = 0;
var count = 1000;
var circles; // circles of balls

function rnd_velocity() {
    return (.5 + Math.random() * 3) * (Math.round(Math.random()) * 2 - 1);
}

function populate() {
    circles = [];
    for (var i = 0; i < count; ++i) {
        var r = 5 + Math.random() * 10;
        circles.push({
            r: r,
            x: r + Math.random() * (canvas.width - 2 * r),
            y: r + Math.random() * (canvas.height - 2 * r),
            vx: rnd_velocity(),
            vy: rnd_velocity(),
            hue: Math.floor(Math.random() * 256)
        });
    }
}

var ctx;
var request;
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
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < circles.length; i++) {
        // draw
        ctx.fillStyle = 'hsl(' + circles[i].hue++ + ', 100%, 60%)';
        ctx.beginPath();
        ctx.arc(circles[i].x, circles[i].y, circles[i].r, 0, Math.PI * 2, true);
        ctx.fill()

        circles[i].x += circles[i].vx
        circles[i].y += circles[i].vy

        if (circles[i].x - circles[i].r < 0) {
            if (wrap_edge) {
                circles[i].x = canvas.width - 1 - circles[i].r; // todo: this 'sticks' value to edge, may want 'fold' value across edge
            }
            else {
                circles[i].x = circles[i].r; // todo: this 'sticks' value to edge, may want 'fold' value across edge
                circles[i].vx *= -1; // reverse direction, 'bounce'
            }
        }
        else if (circles[i].x + circles[i].r > canvas.width - 1) {
            if (wrap_edge) {
                circles[i].x = circles[i].r;
            }
            else {
                circles[i].x = canvas.width - 1 - circles[i].r;
                circles[i].vx *= -1;
            }
        }
        if (circles[i].y - circles[i].r < 0) {
            if (wrap_edge) {
                circles[i].y = canvas.height - 1 - circles[i].r;
            }
            else {
                circles[i].y = circles[i].r;
                circles[i].vy *= -1;
            }
        }
        else if (circles[i].y + circles[i].r > canvas.height - 1) {
            if (wrap_edge) {
                circles[i].y = circles[i].r;
            }
            else {
                circles[i].y = canvas.height - 1 - circles[i].r;
                circles[i].vy *= -1;
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

window.onkeypress = function (event) {
    console.log(event.key);
    if ('k' == event.key) { // draw corner markers (debugging canvas size)
        draw_corners = !draw_corners;
    }
    else if ('w' == event.key) { // balls bounce or wrap around edge
        wrap_edge = !wrap_edge;
    }
    else if (' ' == event.key) { // pause/resume animation
        if (!cancelAnimation()) {
            request = requestAnimationFrame(animate);
        }
    }
    else if ('0' <= event.key && '9' >= event.key) { // specify number of balls
        updateCount *= 10;
        updateCount += parseInt(event.key);
    }
    else if (13 == event.keyCode) { // change number of balls
        if (0 == updateCount) {
            return; // protect against double enter
        }
        cancelAnimation();
        count = updateCount;
        updateCount = 0;
        populate();
        request = requestAnimationFrame(animate);
    }
}

window.onresize = function () {
    cancelAnimation();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    console.log("canvas.width: " + canvas.width + " " + canvas.height);
    populate();
    ctx = canvas.getContext("2d");
    ctx.translate(.5, .5);
    request = requestAnimationFrame(animate);
}

window.onload = function () {
    canvas = document.getElementById("my_canvas");
    window.onresize();
}

// todo:
//  x fit screen
//  x verify corners
//  x auto fit screen on window size change -> cancelAnimationFrame if request in progress
//  x make repo
//  x simplify canvas size code
//  x keyboard toggles
//  x   spacebar pause
//  x specify number of balls
//  - modulate ball size
//  - movement based on time since last 
//  -   fps display
