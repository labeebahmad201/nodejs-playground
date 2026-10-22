# Observer pattern

*One observable, many observers: the observable pushes a notification when its state changes,
instead of every observer repeatedly asking whether anything changed.*

## Pulling for changes is the wrong default

Suppose a phone display needs to show the latest temperature from a weather station. Without
Observer, the display does this:

```ts
let lastTemperature: number | undefined;

setInterval(() => {
  const temperature = station.getTemperature();

  if (temperature !== lastTemperature) {
    lastTemperature = temperature;
    render(temperature);
  }
}, 1_000);
```

This is **polling**: the observer repeatedly pulls for the fact that something changed. It has
several problems.

- **The data can be stale.** If the temperature changes just after a poll, the display waits almost
  a full second before showing it. Poll faster and you spend more time asking; poll slower and the
  display lags further behind.
- **You often get data you already have.** Most polls return the same temperature as the previous
  poll. The observer still had to make the call and compare values to discover that nothing useful
  happened.
- **Changes can disappear between polls.** If the temperature goes 20 → 21 → 20 within one interval,
  the display never sees the change at all.
- **It does not scale.** One display polling every second is harmless. A phone, a kitchen display, a
  logger, and an office display all polling every second is a burst of requests on every tick, and
  every one of them still has to decide whether the answer is new.

The station already knows when its state changes. It should not wait to be interrogated.

**Push** flips the direction: the station tells the observers when something happens. To do that, it
needs to know who is interested — so observers register first. That registry is the beginning of the
pattern.

There is a distinction worth keeping clear:

- polling pulls for the **fact that a change happened**;
- the pattern pushes that fact, and the observer may still pull the **data** afterward.

Both directions appear below.

## The observable

The **observable** is the object whose state other objects care about. **Subject** and **observable**
mean the same thing: the GoF book calls this role the *subject*, while this note uses *observable*
because it pairs more clearly with *observer*. A `Subject` interface in a codebase plays the same
role as `Observable` below.

It owns two things:

1. its actual state (the temperature, the chat messages, the feed articles);
2. a collection of observers that want to know when that state changes.

The relationship is **one-to-many**: one observable, zero or more observers. A weather station can
have many displays; a chat room can have many connected clients; an RSS feed can have many readers.
The observers do not know each other, and they do not need to. The observable is the single place
that knows who is listening.

That gives the observable three jobs: let an observer join the list, let one leave, and notify the
current list when state changes.

## The contract between the two sides

The observable should not store `PhoneDisplay`, `WindowDisplay`, or `EmailNotifier` directly. If it
did, every new kind of observer would force an edit to the observable:

```ts
class WeatherStation {
  private displays: PhoneDisplay[] = []; // knows a concretion
  // adding a logger now means changing this class
}
```

Instead, both sides agree on an interface. The observable depends on the interface, not on the
concrete classes. Any object that implements the interface can subscribe, no matter what else it
does. That is the difference between programming to a contract and programming to a concretion.

```ts
interface Observable {
  add(observer: Observer): void;
  remove(observer: Observer): void;
  notify(): void;
}

interface Observer {
  update(temperature: number): void;
}
```

`Observable` is the contract the client sees: subscribe, unsubscribe, notify. `Observer` is the
contract the observable relies on: when something changes, call `update`. The observable never calls
`phone.render()` or `logger.write()`; it calls `observer.update(...)` and lets the concrete observer
decide what that means.

This is why new observers are easy to add. A `PhoneDisplay`, a `WindowDisplay`, a logger, or a test
double is just another class implementing `update`. None of them requires a change to the observable.
It also means an observer can implement other interfaces — a display might implement both `Observer`
and `Display` — which is harder to do with a single-inheritance base class.

## Option 1: push the new data

The notification can carry the data that changed:

```ts
interface Observer {
  update(temperature: number): void;
}
```

The observable calls `observer.update(this.temperature)`. The observer receives the new value
directly. It does not need a reference to the observable, and it does not have to work out what it
has already seen.

This works well when each notification represents one meaningful change: a new temperature reading,
a new chat message, a new article. If the same value can arrive twice but the two arrivals mean
different things, send an event object rather than only the value:

```ts
interface TemperatureChanged {
  celsius: number;
  occurredAt: Date;
}

interface Observer {
  update(event: TemperatureChanged): void;
}
```

The event tells the observer that this is a distinct occurrence, even if the number is unchanged.

## Option 2: pass the observable and let the observer pull

Another design is to give the observer a reference to the observable and let `update()` take no
arguments:

```ts
interface Observer {
  update(): void;
}

class PhoneDisplay implements Observer {
  constructor(private readonly station: WeatherStation) {}

  update(): void {
    const temperature = this.station.getTemperature();
    this.render(temperature);
  }

  private render(temperature: number): void {
    console.log(`Phone: ${temperature}°C`);
  }
}
```

Here the observable pushes only the **fact** that something changed. The observer then pulls the
current state with `this.station.getTemperature()` (or `getState()` in a more generic example).

This is often called **push-pull**: push the notification, pull the data. Constructing the observer
with the station does not subscribe it; `add(observer)` still does that. The constructor reference
exists only so the observer can read state when `update()` is called.

### The problem with pulling

If the observer only renders the current value, this is fine. But it breaks down when the observer
keeps data of its own:

```ts
class HistoryDisplay implements Observer {
  private readings: number[] = [];

  update(): void {
    const current = this.station.getTemperature();
    const previous = this.readings.at(-1);

    if (current !== previous) {
      this.readings.push(current);
    }
  }
}
```

The observer now has to decide whether the value it just pulled is new or something it already
recorded. That decision is unreliable:

- two genuine readings can have the same value, and the comparison treats the second as a duplicate;
- several changes can happen before `update()` runs, and the observer only sees the latest one;
- the state it reads may already have moved past the state that triggered the notification;
- if it persists readings elsewhere, it has to repeat the same new-versus-old logic there.

The observable, on the other hand, knows exactly which change occurred. If the observer needs every
change, the observable should push the changed data (Option 1). Then there is nothing to compare:
the notification already identifies what is new.

So the choice depends on the case:

- **Push the data** when each change matters, when observers keep history, or when observers need the
  exact event that occurred.
- **Push-pull** when an observer only needs the current snapshot, when different observers need
  different parts of a large state, or when sending the whole state to everyone would be wasteful.

Both are valid Observer designs. The contract is the same; only the `update` signature and the
question of who holds the data differ.

## A concrete implementation

The example below uses the push version: the observable sends the new temperature with the
notification, so observers never have to compare old and new values.

```ts
interface Observable {
  add(observer: Observer): void;
  remove(observer: Observer): void;
  notify(): void;
}

interface Observer {
  update(temperature: number): void;
}

class WeatherStation implements Observable {
  private readonly observers = new Set<Observer>();
  private temperature = 0;

  add(observer: Observer): void {
    this.observers.add(observer);
  }

  remove(observer: Observer): void {
    this.observers.delete(observer);
  }

  notify(): void {
    // Snapshot the list so an observer can unsubscribe during notification.
    for (const observer of [...this.observers]) {
      observer.update(this.temperature);
    }
  }

  setTemperature(celsius: number): void {
    if (celsius === this.temperature) return;

    this.temperature = celsius;
    this.notify();
  }
}
```

Two details are deliberate:

- `Set` prevents the same observer from being added twice.
- `notify()` iterates over a snapshot. If an observer calls `remove()` while being notified, the loop
  still has a stable list to work from.

`setTemperature()` is a stand-in for whatever changes the station's state — a sensor callback, a
message arriving, a new article being saved. The important part is that the change and the
notification are in the same place.

Now the concrete observers:

```ts
class PhoneDisplay implements Observer {
  update(temperature: number): void {
    console.log(`Phone: ${temperature}°C`);
  }
}

class WindowDisplay implements Observer {
  update(temperature: number): void {
    console.log(`Window: ${temperature}°C`);
  }
}
```

Wiring them together:

```ts
const station = new WeatherStation();

const phone = new PhoneDisplay();
const windowDisplay = new WindowDisplay();

station.add(phone);
station.add(windowDisplay);

station.setTemperature(21);
// Phone: 21°C
// Window: 21°C

station.setTemperature(22);
// Phone: 22°C
// Window: 22°C

station.remove(windowDisplay);
station.setTemperature(23);
// Phone: 23°C
```

The station never imports `PhoneDisplay` or `WindowDisplay`. It only knows that both implement
`Observer`, which is exactly the one-to-many contract: one observable, many observers, each free to
do something different with `update`.

If a `Logger` is added tomorrow, it implements `Observer` and calls `station.add(logger)`. The
station does not change.

## References

- Christopher Okhravi — *Observer Pattern – Design Patterns (ep 2)* —
  <https://www.youtube.com/watch?v=_BpmfnqjgzQ>
- Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides — *Design Patterns* (1994) — Observer
- Eric Freeman, Elisabeth Robson — *Head First Design Patterns* (2004) — the WeatherData example
