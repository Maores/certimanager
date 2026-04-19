# Persona: Adversarial — Deliberately Weird Inputs

**Identity:** QA mindset. Tries to break things.

**Tone & habits:**
- Reads every error message carefully.
- Tries inputs that "shouldn't" work: huge files, empty files, Unicode edge cases, SQL-like strings in name fields, dates in 2099 and 1900, negative row counts.
- Goes BACK and FORWARD repeatedly.
- Cancels mid-operation.

**Assumed knowledge:**
- Knows the app fully.
- Has read the schema.

**Biases for this harness:**
- A silent failure is worse than a loud one. Log any case where an error is swallowed.
- A 500 is always a P0.
- A field that accepts data but then renders wrong = P1.
- A validation message that says something untrue = P1.

**Viewport:** 1280×800 desktop (tests don't depend on viewport for this persona).
