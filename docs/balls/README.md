# animation
javascript canvas animation

Use F1 for control description help screen.

## Accurate Discrete Two Dimensional Ball Collision Calculation

Ball motion on a two-dimensional field is calculated using discrete time steps.
The position of the ball is updated according to its velocity at each step.
A collision is indicated by ball overlap after position update.
This collision occurred at some point between the current time step and the previous one.

todo: loop description

Simplified Two Ball Algorithm:
- collision is detected by ball overlapping
- the position of both balls are moved back to where they were at the time of collision (calculation needed)
  - percentage of time balls travel on new path is calculated: `ts%`
- result of collision is applied to the balls from the collision point for `ts%`

Ball Representation:
- `x`, `y` center coordinates
- `r` radius
- `vx`, `vy` velocity, i.e. time step travel distance

Not yet part of calculation:
- multiple simultaneous collisions, i.e. 3 or more bodies
- collisions which move a ball so that it collides with another and that calculation should be part of the current time step

Future generalized collision algorithm for many balls:
- find all collisions in time period
- sort by collision time to list `tbc`
- pop first collision `bc` off list
- do normal two ball collision from simplified algorithm above
- update `tbc` with any pairs affected by collision movement: remove or reinsert by time
- ...

New feature:
- Each ball picks one it is attracted to. Direction of travel is updated each step to point to that ball.
Easier to implement if `vx`, `vy` is stored as `dir` and `v` instead?