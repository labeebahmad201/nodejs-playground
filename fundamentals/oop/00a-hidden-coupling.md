# Hidden coupling

## Overall definition

Hidden coupling is a dependency between software artifacts that is real but not represented in the static structure of the code—no import, no type reference, no compiler-enforced contract. At runtime it surfaces through shared external state, implicit call order, string identifiers, or database schemas; in change history it appears as files or modules that repeatedly change together.
