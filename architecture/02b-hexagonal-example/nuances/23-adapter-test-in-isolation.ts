// 23 — Test the adapters in isolation
// Scenario: the controller is tested against a spy use case; the repository against
// a real database. Neither test runs the other side.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

type User = { id: string; email: string };
type Command = { email: string };

interface RegisterUser {
  execute(command: Command): Promise<User>;
}

// A spy for the driving side: it records the command and returns a canned result.
class SpyRegister implements RegisterUser {
  readonly commands: Command[] = [];
  async execute(command: Command): Promise<User> {
    this.commands.push(command);
    return { id: "u-1", email: command.email };
  }
}

class Controller {
  private readonly useCase: RegisterUser;
  constructor(useCase: RegisterUser) {
    this.useCase = useCase;
  }
  async handle(body: unknown) {
    if (typeof body !== "object" || body === null || !("email" in body)) {
      return { status: 400, body: { error: "invalid shape" } };
    }
    const user = await this.useCase.execute({ email: (body as { email: string }).email });
    return { status: 201, body: { id: user.id, email: user.email } };
  }
}

interface Users {
  save(user: User): Promise<void>;
}

// The driven adapter is tested against the real engine, with the real constraint.
class SqliteUsers implements Users {
  private readonly db = new DatabaseSync(":memory:");
  constructor() {
    this.db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE)");
  }
  async save(user: User): Promise<void> {
    this.db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(user.id, user.email);
  }
  emailOf(id: string): string | null {
    const row = this.db.prepare("SELECT email FROM users WHERE id = ?").get(id);
    return row ? String(row.email) : null;
  }
}

test("23: the driving adapter is tested with a spy, no database", async () => {
  const spy = new SpyRegister();
  const controller = new Controller(spy);

  const response = await controller.handle({ email: "ada@example.com" });

  assert.deepEqual(response, { status: 201, body: { id: "u-1", email: "ada@example.com" } });
  assert.deepEqual(spy.commands, [{ email: "ada@example.com" }]);
});

test("23: the driven adapter is tested against the real engine", async () => {
  const users = new SqliteUsers();
  await users.save({ id: "u-1", email: "ada@example.com" });

  assert.equal(users.emailOf("u-1"), "ada@example.com");
  await assert.rejects(() => users.save({ id: "u-2", email: "ada@example.com" }));
});

test("23: the combined test cannot tell which side failed", async () => {
  const controller = new Controller(new SpyRegister());
  const response = await controller.handle({ email: "ada@example.com" });
  // If this assertion fails, was it the parsing, the use case, or the adapter?
  // The isolated tests above answer that in one step.
  assert.equal(response.status, 201);
});
