# animation
javascript canvas animation

This project is live on GitHub Pages: https://billra.github.io/animation/

Use F1 for control description help screen.

## Accurate Discrete Two Dimensional Ball Collision Calculation

Ball motion on a two-dimensional field is calculated using discrete time steps.
The position of the ball is updated according to its velocity at each step.
A collision is indicated by ball overlap after position update.
This collision occurred at some point between the current time step and the previous one.

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
