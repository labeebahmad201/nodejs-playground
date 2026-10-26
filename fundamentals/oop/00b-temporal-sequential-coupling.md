# ⏳ Temporal / Sequential Coupling

## Definition

Temporal coupling exists when two or more operations must be invoked in a specific order or at a specific time, but that ordering requirement is not encoded in the API’s type signatures or compiler-enforced contracts. The code compiles even when the order is violated; failure appears only at runtime.

## Real-world example — Mark Seemann’s `Smell` class

[Mark Seemann’s `Smell` class](https://blog.ploeh.dk/2011/05/24/DesignSmellTemporalCoupling) (ploeh blog, 2011):

```csharp
public class Smell
{
    public void Initialize(string name) { /* ... */ }
    public string Spread() { /* ... */ }
}

// This compiles, but fails at runtime:
var sut = new Smell();
var n = sut.Spread(); // Initialize was never called
```

The required order—`Initialize` before `Spread`—is implicit and documented only in prose.

## Real-world example — DevIQ `ReportBuilder`

[DevIQ’s `ReportBuilder`](https://www.deviq.com/code-smells/hidden-temporal-coupling):

```csharp
public class ReportBuilder
{
    private List<SaleRecord> _data;

    public void LoadData(DateTime from, DateTime to)
    {
        _data = _repository.GetSales(from, to);
    }

    public Report Generate()
    {
        // Throws NullReferenceException if LoadData was not called first
        var total = _data.Sum(r => r.Amount);
        return new Report(total);
    }
}
```

`Generate()` crashes if called before `LoadData()`, but the method signature gives no warning.

## Fix: constructor injection

Constructor injection collapses multi-step setup into a single call that demands every required input up front. Instead of creating an uninitialized object and hoping the caller remembers the next call, the constructor requires the value that makes the object valid:

```csharp
public class Fragrance
{
    private readonly string name;

    public Fragrance(string name)
    {
        this.name = name ?? throw new ArgumentNullException(nameof(name));
    }

    public string Spread() => this.name;
}

var fragrance = new Fragrance("Sulphur");
var n = fragrance.Spread();
```

Now `new Fragrance()` does not compile: there is no way to get a `Fragrance` without a name. The invalid sequence—construct, then remember to initialize—has been removed from the API.

Mark Seemann explicitly recommends constructor injection as the improvement for temporal coupling because it makes dependencies required and prevents instances from existing in an inconsistent state ([Seemann](https://blog.ploeh.dk/2011/05/24/DesignSmellTemporalCoupling)).
