# animation
javascript canvas animation

This project is live on GitHub Pages: https://billra.github.io/animation/

Use F1 for control description help screen.

## Accurate Discrete Two Dimensional Ball Collision Calculation

Ball motion on the two dimensional field is calculated in discrete time steps.
Balls can collide. This is detected by overlapping balls during a time step.
Balls overlapping indicate that there was a collision sometime during this time step and the last one.

todo: loop description

Algorithm:
- collision is detected by ball overlapping
- both balls are moved back to the point in time of collision
  - algorithm needed
  - percentage of time balls travel on new path is calculated: ts%
- result of collision is applied to the balls from the collision point for ts%

Not yet part of calculation:
- multiple simultaneous collisions, i.e. 3 or more bodies
- collisions which move a ball so that it collides with another and that calculation should be part of the current time step
