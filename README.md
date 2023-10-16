# animation
javascript canvas animation

This project is live on GitHub Pages: https://billra.github.io/animation/

Use F11 to toggle full screen.

Keyboard controls:

* w - toggle: bounce or wrap around edge
* e - toggle: erase canvas or leave ball trails
* space - toggle: pause or resume animation
* {digits} enter - specify number of balls

## Accurate Discrete Two Dimensional Ball Collision Calculation

Ball motion on the two dimensional field is calculated in discrete time steps.
Balls can collide. This is detected by overlapping balls during a time step.
Balls overlapping indicate that there was a collision sometime during this time step and the last one.

Algorithm:
- collision is detected...

Not yet part of calculation:
- multiple simultaneous collisions, i.e. 3 or more bodies
- collisions which move a ball so that it collides with another and that calculation should be part of the current time step
