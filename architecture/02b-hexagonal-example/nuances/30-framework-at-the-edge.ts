// 30 — The framework belongs at the edge
// Scenario: a router and a container wrap the core. The core must not import them.
import { test } from "node:test";
import assert from "node:assert/strict";

// A tiny stand-in for Express/NestJS: it knows paths and handlers.
class Router {
  private readonly routes = new Map<string, (body: unknown) => Promise<unknown>>();
  post(path: string, handler: (body: unknown) => Promise<unknown>): void {
    this.routes.set(path, handler);
  }
  async dispatch(path: string, body: unknown): Promise<unknown> {
    const handler = this.routes.get(path);
    if (!handler) throw new Error(`no route: ${path}`);
    return handler(body);
  }
}

type User = { id: string; email: string };

// (a) correct: the core is a plain class.
class RegisterUser {
  async execute(email: string): Promise<User> {
    if (!email.includes("@")) throw new Error("invalid email");
    return { id: `u-${email}`, email };
  }
}

// The adapter imports the framework and the core; the core imports neither.
function httpAdapter(router: Router, useCase: RegisterUser): Router {
  router.post("/users", async (body) => {
    const email = (body as { email: string }).email;
    return { status: 201, body: await useCase.execute(email) };
  });
  return router;
}

// (b) anti-pattern: the core owns the router, so it cannot run without the framework.
class FrameworkCoupledRegister {
  readonly router = new Router();
  constructor() {
    this.router.post("/users", async (body) => this.execute((body as { email: string }).email));
  }
  async execute(email: string): Promise<User> {
    return { id: `u-${email}`, email };
  }
}

test("30: the plain core runs with a hand-built instance", async () => {
  const useCase = new RegisterUser(); // no router, no container
  const router = httpAdapter(new Router(), useCase);

  const response = await router.dispatch("/users", { email: "ada@example.com" });

  assert.deepEqual(response, { status: 201, body: { id: "u-ada@example.com", email: "ada@example.com" } });
});

test("30: the coupled core drags the framework into every test", () => {
  const coupled = new FrameworkCoupledRegister();
  assert.ok(coupled.router instanceof Router);
  // A CLI, a queue consumer, or a unit test now constructs a router to reach the rule.
});
