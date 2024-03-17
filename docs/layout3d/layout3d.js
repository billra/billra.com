function changeSize(){
    const size = parseInt(document.querySelector('input[type=radio][name=size]:checked').value, 10);
    Draw(size);
}

document.querySelectorAll('input[type=radio][name=size]').forEach((rb) => {
    rb.addEventListener('change', () => {
        changeSize();
    });
});

document.getElementById('show-background').addEventListener('change', () => {
    document.querySelectorAll('.z-axis, .y-axis').forEach((elm) => {
        elm.classList.toggle('no-background');
    });
    // only changing the styling, no Draw() needed
});

function Draw(size) {
    const display = document.getElementById('display');
    display.innerHTML = ''; // erase old
    const noBackground = !document.getElementById('show-background').checked;
    const zAxis = document.createElement('div');
    zAxis.classList.add('z-axis');
    if (noBackground) {
        zAxis.classList.add('no-background');
    }
    for (let z = 0; z < size; z++) {
        const yAxis = document.createElement('div');
        yAxis.classList.add('y-axis');
        if (noBackground) {
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
        zAxis.prepend(yAxis);
    }
    display.append(zAxis);
}

changeSize(); // for initial draw
