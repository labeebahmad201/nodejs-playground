// Appendix A — The vocabulary
// Scenario: the same word means different things to different teams. These are the
// meanings this note uses.
import { test } from "node:test";
import assert from "node:assert/strict";

// Value object: no identity, compared by value, immutable.
class Email {
  readonly value: string;
  constructor(value: string) {
    if (!value.includes("@")) throw new Error("invalid email");
    this.value = value;
  }
  equals(other: Email): boolean {
    return other instanceof Email && other.value === this.value;
  }
}

// Entity: identity survives a change of attributes.
class User {
  readonly id: string;
  email: Email;
  constructor(id: string, email: Email) {
    this.id = id;
    this.email = email;
  }
}

// DTO: a transport shape. No invariant, no behavior.
type UserDto = { id: string; email: string; registered_at: string };

// Port and adapter:
interface Users {
  save(user: User): Promise<void>;
}
class MemoryUsers implements Users {
  readonly rows: User[] = [];
  async save(user: User): Promise<void> {
    this.rows.push(user);
  }
}

// Use case: a scenario the application offers.
class RegisterUser {
  private readonly users: Users;
  constructor(users: Users) {
    this.users = users;
  }
  async execute(email: Email): Promise<User> {
    const user = new User("u-1", email);
    await this.users.save(user);
    return user;
  }
}

// Mapper: a function at the boundary, not a layer.
function toDto(user: User, registeredAt: Date): UserDto {
  return { id: user.id, email: user.email.value, registered_at: registeredAt.toISOString() };
}

test("A: value objects compare by value, entities by identity", () => {
  const a = new Email("ada@example.com");
  const b = new Email("ada@example.com");
  const first = new User("u-1", a);
  const changed = new User("u-1", b);

  assert.equal(a.equals(b), true);
  assert.notEqual(a, b);
  assert.equal(first.id, changed.id); // same entity, new attribute value
});

test("A: a DTO is not a domain object", () => {
  const user = new User("u-1", new Email("ada@example.com"));
  const dto = toDto(user, new Date("2026-01-01T00:00:00Z"));

  assert.deepEqual(dto, { id: "u-1", email: "ada@example.com", registered_at: "2026-01-01T00:00:00.000Z" });
  // The DTO has a string date and no way to reject an invalid email.
  assert.equal(typeof dto.registered_at, "string");
});

test("A: the use case works through the port", async () => {
  const users = new MemoryUsers();
  const user = await new RegisterUser(users).execute(new Email("ada@example.com"));

  assert.equal(user.id, "u-1");
  assert.equal(users.rows.length, 1);
});
