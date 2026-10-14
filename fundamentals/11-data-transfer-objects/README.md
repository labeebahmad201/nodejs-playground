# Data transfer objects (DTOs)

*A **DTO** is a plain, behavior-free object whose only job is to carry data across a boundary —
over the wire, between layers, or into a view. It's not a domain object: it's a shape chosen for the
*consumer*, often deliberately different from the model.*

Part of the language-agnostic [`fundamentals/`](../) track. Contrast with `05-entities` and
`04-value-objects`.

## Definition

A **Data Transfer Object** is a simple structure — fields, no logic — used to move data between
processes or layers. It exists to reduce and shape the data crossing a boundary.

```ts
// Domain object: rich, with behavior and invariants.
class User {
  constructor(
    readonly id: UserId,
    private name: string,
    private email: EmailAddress,
    private passwordHash: string,
  ) {}

  rename(name: string): void { /* domain rules */ }
}

// DTO: the shape the API returns — no behavior, only what the client needs.
type UserResponse = {
  id: string;
  name: string;
  email: string;
  // no passwordHash — deliberately absent
};

function toUserResponse(user: User): UserResponse {
  return { id: user.id.value, name: user.name, email: user.email.value };
}
```

## Key traits

| Trait | Meaning |
| --- | --- |
| **No behavior** | just fields (and maybe equality); no domain rules |
| **Boundary-shaped** | designed for a consumer/transport, not for the model |
| **Serializable** | must survive JSON/XML/Protobuf, so it avoids rich types |
| **Intentional mapping** | you *choose* the shape; you don't leak the entity |
| **Disposable** | safe to change when the API contract changes, without touching the domain |

## Why they exist

- **Don't leak your model.** Entities carry internal state (`passwordHash`) and invariants; you
  shouldn't serialize them directly. A DTO is the curated, safe subset.
- **Decouple layer changes.** The API shape can evolve independently of the domain.
- **Shape per consumer.** The list view and the detail view need different fields — different DTOs.
- **Flatten structure.** Transport often wants a flat record even when the domain is a graph.

## DTOs vs the other blocks

| | DTO | Entity (`05`) | Value object (`04`) |
| --- | --- | --- | --- |
| Behavior | none | domain rules | pure operations |
| Identity | maybe an id field | real identity | none |
| Purpose | move data over a boundary | model a thing over time | describe a value |
| Rich types | avoided (serializable) | yes | yes |
| Validates? | usually no | yes (invariants) | yes (constructor) |

A DTO is *not* a value object with a different name: a value object exists to model meaning and
enforce validity; a DTO exists to carry data. If you add behavior to a DTO, you're building a model
by accident.

## Input vs output DTOs

- **Request/Input DTO** — what the boundary receives (`CreateUserRequest`). Validate it *at the
  edge*, then map it into the domain.
- **Response/Output DTO** — what you send back (`UserResponse`). Map *from* the domain.
- **View model** — a DTO shaped for one screen/template.

```ts
type CreateUserRequest = { name: string; email: string };

function toNewUser(req: CreateUserRequest, id: UserId): User {
  return new User(id, req.name, new EmailAddress(req.email), /* hash later */ "");
}
```

## Guidance

- **Validate input DTOs at the boundary** (schema validation), then construct valid domain objects.
- **Map explicitly.** Write `toResponse`/`toDomain` functions; don't rely on implicit spread that
  accidentally leaks fields.
- **Keep them dumb.** No business logic, no DB access, no domain rules.
- **Don't reuse one DTO everywhere.** A shared god-DTO couples unrelated consumers; make focused
  shapes.
- **Serialize types carefully.** `Date` → ISO string, `Money` → `{ amount, currency }`, ids → strings.

## Pitfalls

- **Anemic domain via DTOs.** If you pass DTOs deep into the domain and operate on them, you've
  moved the model into data bags (`05-entities` → anemic model).
- **Over-sharing.** Returning the entity/row directly leaks internals and future changes.
- **Boilerplate by reflex.** In a small app, a hand-written mapper for every type is overkill —
  start simple, introduce DTOs where a real boundary or leak risk exists.
- **Mapping everywhere for no reason.** If domain and API shapes genuinely match, mapping adds cost;
  do it when the boundary earns it.

## One-line summary

**A DTO is a behavior-free, serializable object that carries data across a boundary in a shape
chosen for the consumer — deliberately separate from the domain model, mapped explicitly, so you
don't leak internal state or couple the API contract to the domain.**

## References

- Martin Fowler — *DataTransferObject* — <https://martinfowler.com/bliki/DataTransferObject.html>
- Martin Fowler — *Data Transfer Object* (PoEAA) — <https://martinfowler.com/eaaCatalog/dataTransferObject.html>
- Related: `05-entities`, `04-value-objects`, `08-repositories`
