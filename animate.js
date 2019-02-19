// animate.js

var canvas;
var circles;

function populate() {
    circles = [];
    for (var i = 0; i < 1000; ++i) {
        var _r = 5 + Math.random() * 10;
        var _x = _r + Math.random() * (canvas.width - 2 * _r);
        var _y = _r + Math.random() * (canvas.height - 2 * _r);
        // console.log((_x - _r) + " " + (_y - _r) + ", " + (_x + _r) + " " + (_y + _r));
        var _vx = (.5 + Math.random() * 3) * (Math.round(Math.random()) * 2 - 1);
        var _vy = (.5 + Math.random() * 3) * (Math.round(Math.random()) * 2 - 1);
        var _hue = Math.floor(Math.random() * 256);
        circles.push({ x: _x, y: _y, r: _r, vx: _vx, vy: _vy, color: _hue });
    }
}

var ctx;
var request;

function animate() {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < circles.length; i++) {
        // draw
        ctx.fillStyle = 'hsl(' + circles[i].color++ + ', 100%, 60%)';
        ctx.beginPath();
        ctx.arc(circles[i].x, circles[i].y, circles[i].r, 0, Math.PI * 2, true);
        ctx.fill()

        if (circles[i].x - circles[i].r + circles[i].vx < 0 || circles[i].x + circles[i].r + circles[i].vx > canvas.width - 1) {
            circles[i].vx *= -1;
        }

        if (circles[i].y - circles[i].r + circles[i].vy < 0 || circles[i].y + circles[i].r + circles[i].vy > canvas.height - 1) {
            circles[i].vy *= -1;
        }

        circles[i].x += circles[i].vx
        circles[i].y += circles[i].vy
    }

    // testing, remove later
    ctx.strokeStyle = "#FF0000"; // red
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 2, 2);
    ctx.strokeRect(0, canvas.height - 3, 2, 2);
    ctx.strokeRect(canvas.width - 3, 0, 2, 2);
    ctx.strokeRect(canvas.width - 3, canvas.height - 3, 2, 2); // drawable pixels are [0 to canvas.width-1] and [0 to canvas.height-1] (after ctx.translate)

    request = requestAnimationFrame(animate);
}

window.onresize = function () {
    if (request) {
        cancelAnimationFrame(request);
        request = undefined;
    }
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
//  - keyboard toggles
//  -   spacebar pause
//  - modulate ball size
//  - movement based on time since last 
//  -   fps display
