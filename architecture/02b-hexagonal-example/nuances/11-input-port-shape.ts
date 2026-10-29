// 11 — The input port's shape
// Scenario: the HTTP body is not the command. The edge owns the transport shape;
// the core owns the meaning.
import { test } from "node:test";
import assert from "node:assert/strict";

class DomainError extends Error {}
class InvalidEmail extends DomainError {}

type User = { id: string; email: string };
type RegisterCommand = { email: string };

// (a) correct: the core accepts a command, not the request.
class RegisterUser {
  async execute(command: RegisterCommand): Promise<User> {
    if (!command.email.includes("@")) throw new InvalidEmail(command.email);
    return { id: `u-${command.email}`, email: command.email };
  }
}

type HttpRequest = { body: unknown; headers: Record<string, string> };

class Controller {
  private readonly useCase: RegisterUser;
  constructor(useCase: RegisterUser) {
    this.useCase = useCase;
  }

  async handle(request: HttpRequest) {
    if (!isBody(request.body)) return { status: 400, body: { error: "invalid shape" } };
    try {
      const user = await this.useCase.execute({ email: request.body.email });
      return { status: 201, body: user };
    } catch (error) {
      if (error instanceof InvalidEmail) return { status: 422, body: { error: "invalid email" } };
      throw error;
    }
  }
}

function isBody(value: unknown): value is { email: string } {
  return typeof value === "object" && value !== null && "email" in value
    && typeof (value as { email: unknown }).email === "string";
}

// (b) anti-pattern: the use case receives the HTTP request.
class LeakyUseCase {
  async execute(request: HttpRequest): Promise<User> {
    const body = request.body as { email?: string };
    if (request.headers["content-type"] !== "application/json") throw new Error("bad content type");
    return { id: `u-${body.email}`, email: body.email ?? "" };
  }
}

test("11: the edge rejects shape, the core rejects meaning", async () => {
  const controller = new Controller(new RegisterUser());

  assert.equal((await controller.handle({ body: {}, headers: {} })).status, 400);
  assert.equal((await controller.handle({ body: { email: "nope" }, headers: {} })).status, 422);
  assert.equal((await controller.handle({ body: { email: "ada@example.com" }, headers: {} })).status, 201);
});

test("11: a request-shaped use case cannot be called without HTTP", async () => {
  const leaky = new LeakyUseCase();
  await assert.rejects(
    () => leaky.execute({ body: { email: "ada@example.com" }, headers: {} }),
    /content type/,
  );
  // A CLI or a queue consumer now has to fabricate HTTP headers to call the core.
});
