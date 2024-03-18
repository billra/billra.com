// handle radio button change
document.querySelectorAll('input[type=radio]').forEach((rb) => {
    rb.addEventListener('change', () => {
        draw();
    });
});

// handle show background change
document.getElementById('show-background').addEventListener('change', () => {
    // We could just call draw() to rebuild the display. Instead we
    // choose to do the minimum: change the styling of the affected classes.
    document.querySelectorAll('.z-axis, .y-axis').forEach((elm) => {
        elm.classList.toggle('no-background');
    });
});

function draw() {
    const size = parseInt(document.querySelector('input[type=radio][name=size]:checked').value, 10);
    const zOriginFirst = document.querySelector('input[type=radio][name=z-origin][value=first]').checked;
    const showBackground = document.getElementById('show-background').checked;
    const display = document.getElementById('display');
    display.innerHTML = ''; // erase old
    const zAxis = document.createElement('div');
    zAxis.classList.add('z-axis');
    if (!showBackground) {
        zAxis.classList.add('no-background');
    }
    for (let z = 0; z < size; z++) {
        const yAxis = document.createElement('div');
        yAxis.classList.add('y-axis');
        if (!showBackground) {
            yAxis.classList.add('no-background');
        }
        for (let y = 0; y < size; y++) {
            const xAxis = document.createElement('div');
            xAxis.classList.add('x-axis');
            for (let x = 0; x < size; x++) {
                const block = document.createElement('div');
                block.classList.add('block');
                block.innerText = `(${x},${y},${z})`;
                xAxis.append(block);
            }
            yAxis.prepend(xAxis);
        }
        if (zOriginFirst) {
            zAxis.append(yAxis);
        } else {
            zAxis.prepend(yAxis);
        }
    }
    display.append(zAxis);
}

draw(); // initial draw
