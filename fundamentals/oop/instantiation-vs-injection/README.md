# Instantiation vs Injection

## Instantiation

**Instantiation** means creating an object yourself using `new` inside a class. The class is responsible for creating its own dependencies.

**Example:**
```ts
class EmailService {
  send(email: string) {
    console.log(`Sending email to ${email}`);
  }
}

class Notification {
  private emailService = new EmailService(); // instantiating itself

  notify(email: string) {
    this.emailService.send(email);
  }
}

const n = new Notification();
n.notify("test@example.com");
```

## Injection

**Injection** means passing a dependency in from the outside, rather than creating it inside. The class doesn't know or care how the dependency is created.

**Example:**
```ts
class EmailService {
  send(email: string) {
    console.log(`Sending email to ${email}`);
  }
}

class Notification {
  constructor(private emailService: EmailService) {} // injected

  notify(email: string) {
    this.emailService.send(email);
  }
}

const emailService = new EmailService();
const n = new Notification(emailService); // passed in from outside
n.notify("test@example.com");
```

## Key Difference

| Aspect | Instantiation | Injection |
|---|---|---|
| Who creates dependency? | The class itself (`new`) | The caller/outside code |
| Coupling | Tightly coupled to concrete class | Loosely coupled to abstraction or passed dependency |
| Testability | Hard to test in isolation | Easy to mock/fake |
| Flexibility | Fixed behavior | Can swap implementations |
