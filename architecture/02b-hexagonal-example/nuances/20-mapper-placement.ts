// 20 — Map once, at the boundary
// Scenario: the DTO becomes a domain object, then the service maps it again.
import { test } from "node:test";
import assert from "node:assert/strict";

type User = { id: string; email: string; nickname?: string };
type UserDto = { email: string; nickname?: string };

// (a) correct: each edge maps once. The core receives a command and never maps again.
class RegisterUser {
  async execute(command: UserDto): Promise<User> {
    return { id: `u-${command.email}`, email: command.email, ...(command.nickname ? { nickname: command.nickname } : {}) };
  }
}

class Controller {
  private readonly useCase: RegisterUser;
  constructor(useCase: RegisterUser) {
    this.useCase = useCase;
  }
  async handle(body: unknown): Promise<{ status: number; body: UserDto }> {
    if (!isDto(body)) return { status: 400, body: { email: "" } };
    const user = await this.useCase.execute(body);
    const dto: UserDto = { email: user.email, ...(user.nickname ? { nickname: user.nickname } : {}) };
    return { status: 201, body: dto };
  }
}

function isDto(value: unknown): value is UserDto {
  return typeof value === "object" && value !== null && "email" in value
    && typeof (value as { email: unknown }).email === "string";
}

// (b) anti-pattern: two mapping hops, each dropping what it did not model.
type PublicProfile = { email: string };
function toPublic(user: User): PublicProfile {
  return { email: user.email }; // the mapper does not know about nickname
}
class DoubleMappingUseCase {
  async execute(input: UserDto): Promise<PublicProfile> {
    const user: User = { id: `u-${input.email}`, email: input.email, ...(input.nickname ? { nickname: input.nickname } : {}) };
    const profile = toPublic(user); // mapped again, too early
    return profile;
  }
}

test("20: mapping once at each edge keeps the nickname", async () => {
  const controller = new Controller(new RegisterUser());
  const response = await controller.handle({ email: "ada@example.com", nickname: "ada" });

  assert.deepEqual(response.body, { email: "ada@example.com", nickname: "ada" });
});

test("20: the intermediate public shape silently drops the field", async () => {
  const useCase = new DoubleMappingUseCase();
  const profile = await useCase.execute({ email: "ada@example.com", nickname: "ada" });

  assert.deepEqual(profile, { email: "ada@example.com" });
  assert.equal("nickname" in profile, false);
});
