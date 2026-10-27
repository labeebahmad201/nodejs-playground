export type Lifetime = "singleton" | "transient";

export type Factory<T> = (container: Container) => T;

interface Registration<T> {
  readonly factory: Factory<T>;
  readonly lifetime: Lifetime;
  instance?: T;
  resolved?: boolean;
}

/**
 * A deliberately small teaching container.
 *
 * It shows the three jobs a real container performs:
 * registration, resolution, and lifetime management.
 *
 * It does not implement scopes, decorators, async disposal, or module scanning.
 */
export class Container {
  private readonly registrations = new Map<symbol, Registration<unknown>>();
  private readonly resolving = new Set<symbol>();

  register<T>(
    token: symbol,
    factory: Factory<T>,
    lifetime: Lifetime = "transient",
  ): void {
    if (this.registrations.has(token)) {
      throw new Error(`Token ${token.toString()} is already registered`);
    }

    this.registrations.set(token, { factory, lifetime });
  }

  resolve<T>(token: symbol): T {
    const registration = this.registrations.get(token);

    if (!registration) {
      throw new Error(`No registration for token ${token.toString()}`);
    }

    if (registration.lifetime === "singleton" && registration.resolved) {
      return registration.instance as T;
    }

    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency while resolving ${token.toString()}`);
    }

    this.resolving.add(token);

    try {
      const instance = registration.factory(this) as T;

      if (registration.lifetime === "singleton") {
        registration.instance = instance;
        registration.resolved = true;
      }

      return instance;
    } finally {
      this.resolving.delete(token);
    }
  }
}
