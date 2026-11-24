# Car Fleet

*On a single lane a car can never be faster than the car in front of it. That reduces every car to one number — the time it would take to reach the target alone — and the fleet count is the number of times that number increases as you walk back from the target.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻↻

## Two arrays become one number per car

The input gives positions and speeds in parallel arrays, so the first useful step is to attach each speed to its position instead of treating them as two lists. Then each car can be reduced to the time it would reach the target if nothing were in front of it:

```text
time = (target - position) / speed
```

Distance divided by speed, in whatever units; the units cancel, and only the ordering of the times matters.

The reason this single number is enough is the no-passing rule. For two cars, one behind the other, the one behind catches the one ahead exactly when its solo arrival time is no larger. A fast car that is far behind can still arrive later than a slow car that is almost there, and the time folds the distance and the speed into one comparison. Speed alone cannot decide it.

When the car behind does catch up, it cannot pass; it matches the pace of the car ahead. From that moment the two move as one fleet and arrive together, at the front car's time.

## Plotting the example

The working example has target 12, with cars at positions `10, 8, 5, 3, 0` and speeds `2, 4, 1, 3, 1`:

```text
position:   0     3     5     8    10        12
            ●     ●     ●     ●     ●         │
speed:      1     3     1     4     2      target
time:      12h    3h    7h    1h    1h
```

The two cars nearest the target both take one hour, so they arrive together. The car at 5 takes seven hours, far longer, so it cannot be caught by them; it is the head of a different fleet. The car at 3 takes three hours, which is less than seven, so it does catch the car at 5 and they arrive together. The car at 0 takes twelve hours, slower than everything ahead, so it forms a third fleet.

That is three fleets, and the numbers already show the rule: walking from the target backwards, a fleet starts whenever the time is larger than the fleet ahead of it.

## The scan

```text
10 (1h)   a fleet starts; its arrival is 1h
 8 (1h)   1h ≤ 1h, so it catches the fleet and joins
 5 (7h)   7h > 1h, so it cannot catch it; a new fleet starts at 7h
 3 (3h)   3h ≤ 7h, so it joins the fleet ahead
 0 (12h)  12h > 7h, so it cannot catch it; a third fleet starts
```

The comparison is always against the fleet directly ahead, not against the previous car. Here the car at 3 is compared with the fleet headed by the car at 5, whose time is seven hours. That is what makes the rule one number and not a chain of pairwise checks.

## Why one comparison per car is enough

A fleet's arrival time is the time of its frontmost car, because every member behind it has a time no larger and therefore arrives at the target no later, then waits for the front car. So the front car's time is both the fleet's time and the largest time inside the fleet.

Fleets are ordered by increasing time as you move back from the target. The first fleet is the earliest arrival, and each new fleet is created by a car whose solo time is larger than every time ahead of it, which makes it the new maximum. A car with a time no larger than that maximum catches the fleet immediately ahead; a car with a larger time catches nothing, because every fleet ahead arrives earlier and is already gone. So a single running maximum is sufficient, and the grouping version with an inner skip loop is the same rule written with an explicit cursor.

## The algorithm

Build `(position, time)` for every car, sort by position so that "ahead" means "later in the array", and scan from the car closest to the target. Count a fleet when the current time exceeds the fleet time so far, and update that time. The number of increases is the number of fleets.

## The code

```python
class Solution:
    def carFleet(self, target: int, position: list[int], speed: list[int]) -> int:
        n = len(position)

        # A row per car: position, speed, time. The list comprehension
        # matters; [[0, 0, 0]] * n would give n references to one row.
        positionsMetaData = [[0, 0, 0] for _ in range(n)]

        for i in range(n):
            positionsMetaData[i][0] = position[i]
            positionsMetaData[i][1] = speed[i]
            positionsMetaData[i][2] = (target - position[i]) / speed[i]

        # Smallest position first, so scanning backwards starts at the
        # car closest to the target.
        positionsMetaData.sort(key=lambda row: row[0])

        fleet = 0
        i = len(positionsMetaData) - 1

        while i >= 0:
            # The frontmost car of the remaining group starts a fleet.
            fleet_head_car_time = positionsMetaData[i][2]
            fleet += 1

            # Everyone behind who arrives no later catches this fleet.
            while i >= 0 and positionsMetaData[i][2] <= fleet_head_car_time:
                i -= 1

        return fleet
```

The inner loop walks over the head itself and then every car that joins it, so the total work of both loops is `O(n)`. The `i >= 0` in the inner condition is not optional: the last group can consume the whole array, and without it the next comparison reads past the start.

The speed column is never read after the time is computed. A `(position, time)` pair is enough, which is what the shorter version below keeps.

## The same scan with a running maximum

Sorting by position in descending order and scanning forwards is the mirror image, and then the inner skip loop collapses into a comparison with the current fleet time:

```python
class Solution:
    def carFleet(self, target: int, position: list[int], speed: list[int]) -> int:
        cars = sorted(zip(position, speed), reverse=True)

        fleets = 0
        fleet_time = -1.0          # every real time is positive

        for pos, spd in cars:
            time = (target - pos) / spd
            if time > fleet_time:  # slower than the fleet ahead
                fleets += 1
                fleet_time = time

        return fleets
```

This is the version to reach for in an interview, because the invariant is visible in one line: the car joins when its time is at most the current fleet time, and starts a new fleet when it is larger. `fleet_time` can be initialised to `-1` because a car at the target would have time zero, and the problem's constraints keep every car strictly before the target anyway.

## Details that decide correctness

Sorting is not decoration. The input order is arbitrary, and "ahead" is defined by position, so the array has to be ordered before the scan means anything. Because the speeds live in a parallel array, pairing first and sorting the pairs is the safe move; sorting `position` alone silently detaches every speed from its car, which is exactly the bug the metadata row avoids.

The direction matters as much as the sort. Ascending position with a backward scan and descending position with a forward scan are equivalent; ascending with a forward scan compares each car with the ones behind it, which is the opposite relationship and gives the wrong count. The two must agree.

The comparison is `time <= fleet_time` to join and `time > fleet_time` to start a fleet. Equal times are one fleet, because those cars meet the target together; using `<` would count them separately.

Distance and speed give a ratio, and the code compares floats. For these constraints the division is safe, but the comparison can be kept in integers by cross-multiplying, since all speeds are positive: `(target - p1) / s1 <= (target - p2) / s2` is the same as `(target - p1) * s2 <= (target - p2) * s1`. That removes the precision question entirely if it ever matters.

## Edge cases

A single car is one fleet: the outer loop counts it and the inner loop consumes it. A car already at the target would have time zero, but the constraints exclude that position, and the running-maximum version still handles it because zero is greater than the initial `-1`.

When every car has the same speed, the gaps never close, so every car is its own fleet; the times increase with distance and each one starts a new maximum. A very fast car far behind can still catch a slow one near the target, and the time comparison joins them into one fleet.

## Mistakes

`[[0, 0, 0]] * n` creates one row and repeats the reference, so writing car 0's position writes every car's position. The list comprehension in the code builds independent rows.

Sorting the positions without their speeds pairs every car with the wrong value. The metadata rows, or a zip before the sort, are what keep the association.

Comparing speeds instead of times misses the distance. A faster car behind does not always catch the one ahead.

Forgetting the bounds check in the inner loop raises an index error on the last fleet, because the loop can walk off the start of the array.

Counting every car that joins as a new fleet, instead of skipping the whole group, overcounts; the outer loop must run once per fleet, not once per car.

## To remember

One number per car: the solo arrival time. Sort by position, walk from the target backwards, and count a fleet whenever the time is larger than the fleet ahead. The fleet's time is its front car's time, the largest in the group, and the number of times that maximum increases is the number of fleets.
