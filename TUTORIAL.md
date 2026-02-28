# Building a CNF/DNF Calculator from Scratch

## What We're Building

A web app that takes a logical expression like `(A & B) -> C`, generates its
truth table, and derives the **CNF** (Conjunctive Normal Form) and **DNF**
(Disjunctive Normal Form).

```
 User Input          Tokenizer          Parser           Evaluator        Output
+--------------+      +---------+      +-----------+      +-----------+    +-------+
| (A & B) -> C | ---> | Tokens  | ---> | AST Tree  | ---> | Truth     | -> | Table |
|              |      | [{...}] |      |    ->     |      | Table +   |    | DNF   |
|              |      |         |      |   /  \    |      | CNF/DNF   |    | CNF   |
+--------------+      +---------+      +-----------+      +-----------+    +-------+
```

## Step 1: Tokenizing

The tokenizer scans the raw string character by character and groups it into
meaningful chunks called **tokens**.

### Supported Operators

```
 Symbol | Meaning        | Also Accepts
--------+----------------+--------------
   ~    | NOT (negation) |    !   ¬
   &    | AND            |    ∧
   |    | OR             |    ∨
   ->   | IMPLIES        |    =>
  <->   | EQUIVALENCE    |   <=>
```

### Example

Input: `(A & B) -> C`

```
Character scan:
  (  A     &     B  )      - >      C
  |  |     |     |  |      |-|      |
  v  v     v     v  v       v       v

Tokens produced:
  +-----------+-----------+
  |   type    |   value   |
  +-----------+-----------+
  |  paren    |     (     |
  |  variable |     A     |
  |  operator |     &     |
  |  variable |     B     |
  |  paren    |     )     |
  |  operator |     ->    |
  |  variable |     C     |
  +-----------+-----------+
```

## Step 2: Parsing (Recursive Descent)

Tokens are flat — they don't capture structure. The parser builds an **AST**
(Abstract Syntax Tree) that respects operator precedence.

### Precedence (highest to lowest)

```
 Priority | Operator | Name
----------+----------+--------------
    1     |    ~     | NOT
    2     |    &     | AND
    3     |    |     | OR
    4     |    ->    | IMPLIES
    5     |   <->    | EQUIVALENCE
```

Higher priority means it binds tighter. `A | B & C` parses as `A | (B & C)`
because `&` has higher priority than `|`.

### How the Recursion Works

Each precedence level is a function that calls the next-higher level:

```
  parseIfAndOnlyIf()                                            <->   (lowest priority, called first)
       |
       +--> parseImplies()                                       ->
                 |
                 +--> parseOr()                                  |
                           |
                           +--> parseAnd()                       &
                                     |
                                     +--> parseNot()             ~    (highest priority)
                                               |
                                               +--> parsePrimary()    (variables & parentheses)
```

Each function follows this pattern:

```
  function parseX(parser):
      left = parseHigherPrecedence(parser)    // get the left operand
      while next token is my operator:
          consume the operator
          right = parseHigherPrecedence(parser)  // get the right operand
          left = new BinaryNode(left, right)     // combine into tree node
      return left
```

### Example: Parsing `A | B & C`

```
  1. parseOr calls parseAnd
  2.   parseAnd calls parseNot -> parsePrimary -> returns node A
  3.   parseAnd sees no '&', returns A to parseOr
  4. parseOr sees '|', consumes it, calls parseAnd again
  5.   parseAnd calls parseNot -> parsePrimary -> returns node B
  6.   parseAnd sees '&', consumes it
  7.   parseAnd calls parseNot -> parsePrimary -> returns node C
  8.   parseAnd builds (B & C), returns it
  9. parseOr builds (A | (B & C))

  Resulting AST:

         OR
        /  \
       A   AND
          /   \
         B     C
```

### Parentheses Override Precedence

When `parsePrimary` hits `(`, it calls all the way back to the
lowest-precedence function, restarting the chain inside the parens:

```
Input: (A | B) & C

       AND
      /   \
     OR    C
    /  \
   A    B

Without parens, A | B & C would be:

        OR
       /  \
      A   AND
         /   \
        B     C
```

## Step 3: Evaluating the AST

The evaluator walks the tree recursively. Given an assignment of
true/false to each variable, it computes the result bottom-up.

```
 Node Type | Rule
-----------+-----------------------------
 var       | Look up the variable's value
 not       | Negate the child
 and       | Left AND Right
 or        | Left OR Right
 implies   | NOT Left OR Right
 equiv     | Left === Right
```

### Example: Evaluating `(A & B) -> C` with A=T, B=T, C=F

```
        ->
        /  \
      &     C (F)
    / \
(T) A   B (T)

Step 1: A & B  =  T & T  =  T
Step 2: T -> F =  NOT T OR F  =  F
Result: F
```

## Step 4: Building the Truth Table

### Collecting Variables

First, walk the AST and collect every unique variable name into a sorted
list. For `(A & B) -> C` that gives us `[A, B, C]`.

### Generating Every Combination with Bit Manipulation

For `n` variables we need `2^n` rows. Each row number `i` is treated as a
binary number where each bit maps to a variable.

```
  Variables: [A, B, C]   (indices: 0, 1, 2)
  n = 3, rows = 2^3 = 8

  We iterate i from 7 down to 0:

   i | binary |  A  |  B  |  C
  ---+--------+-----+-----+-----
   7 |  1 1 1 |  T  |  T  |  T
   6 |  1 1 0 |  T  |  T  |  F
   5 |  1 0 1 |  T  |  F  |  T
   4 |  1 0 0 |  T  |  F  |  F
   3 |  0 1 1 |  F  |  T  |  T
   2 |  0 1 0 |  F  |  T  |  F
   1 |  0 0 1 |  F  |  F  |  T
   0 |  0 0 0 |  F  |  F  |  F
```

### The Bit Extraction Trick

For variable at index `j`, extract its bit from row `i`:

```
bit = (i >> (n - j - 1)) & 1

Example: i=5 (binary 101), n=3

j=0 (A):  5 >> (3-0-1) = 5 >> 2 = 1             -->  T
j=1 (B):  5 >> (3-1-1) = 5 >> 1 = 2, 2 & 1 = 0  -->  F
j=2 (C):  5 >> (3-2-1) = 5 >> 0 = 5, 5 & 1 = 1  -->  T

Row 5: A=T, B=F, C=T   matches binary 101
```

The MSB (most significant bit) corresponds to the first variable so
that the table reads in the order of TTT, TTF, TFT, etc.

### Evaluating Each Row

For each row, plug the variable assignment into the AST evaluator
and record the result:

```
Row 6: A=T, B=T, C=F

Evaluate (A & B) -> C:

        ->
        /  \
      &    C=F
      / \
  A=T   B=T

A & B  =  T & T  =  T
T -> F =  not T or F =  F

Result: F
```

### Complete Truth Table for `(A & B) -> C`

```
+---+---+---+----------------+
| A | B | C | (A ∧ B) -> C   |
+---+---+---+----------------+
| T | T | T |       T        |
| T | T | F |       F        |
| T | F | T |       T        |
| T | F | F |       T        |
| F | T | T |       T        |
| F | T | F |       T        |
| F | F | T |       T        |
| F | F | F |       T        |
+---+---+---+----------------+
```

## Step 5: Deriving DNF and CNF

### DNF (Disjunctive Normal Form)

Look at every row where the result is **True**. Build a clause that's the
AND of each variable (negated if false in that row). Join all clauses with OR.

```
  Truth table for A -> B:

    A | B | Result
   ---+---+--------
    T | T |   T    --> (A ∧ B)
    T | F |   F
    F | T |   T    --> (¬A ∧ B)
    F | F |   T    --> (¬A ∧ ¬B)

  DNF = (A ∧ B) ∨ (¬A ∧ B) ∨ (¬A ∧ ¬B)
```

### CNF (Conjunctive Normal Form)

Look at every row where the result is **False**. Build a clause that's the
OR of each variable (negated if **true** in that row). Join all clauses with AND.

```
Same table — only one False row:

 A | B | Result
---+---+--------
 T | F |   F     --> (¬A ∨ B)

CNF = (¬A ∨ B)
```

Why negate the **true** variables for CNF? Because we want a clause that
_excludes_ exactly that failing row. Flipping the values of the variables
from that row creates a disjunction that is false only for that assignment.

## Step 6: The UI Glue

The HTML is minimal — an input field, a button, and a result div:

```
+--------------------------------------+
|  Truth Table, CNF, and DNF Generator |
|                                      |
|  Enter a logical expression:         |
|  +----------------------+ +--------+ |
|  | (A & B) -> C         | |Generate| |
|  +----------------------+ +--------+ |
|                                      |
|  +--+--+--+------------------+       |
|  |A |B |C | (A ∧ B) -> C     |       |
|  +--+--+--+------------------+       |
|  |T |T |T |       T          |       |
|  |T |T |F |       F          |       |
|  | ...                       |       |
|  +--+--+--+------------------+       |
|                                      |
|  DNF: (A ∧ B ∧ C) ∨ ...              |
|  CNF: (¬A ∨ ¬B ∨ C) ∧ ...            |
+--------------------------------------+
```

Two quality-of-life features in the keydown handler:

- Typing `(` auto-inserts the closing `)` and places the cursor between them
- Pressing `Enter` triggers generation without clicking the button

## Deep Dive: Generating DNF

DNF stands for **Disjunctive Normal Form** — an OR of ANDs.

The algorithm:

```
FOR each row in the truth table:
    IF result is TRUE:
        Build a minterm:
            - variable is TRUE in this row  -->  keep it as-is    (e.g. A)
            - variable is FALSE in this row -->  negate it       (e.g. ¬A)
            - AND all of them together
        Add this minterm to the DNF list
JOIN all minterms with OR
```

### Full Example: `A -> B`

```
Truth table:
+---+---+--------+
| A | B | A -> B |
+---+---+--------+
| T | T |   T    |  <-- TRUE row
| T | F |   F    |
| F | T |   T    |  <-- TRUE row
| F | F |   T    |  <-- TRUE row
+---+---+--------+
```

Building minterms from the TRUE rows:

```
Row 1: A=T, B=T  -->  A  ∧  B       (both true, no negation)
Row 3: A=F, B=T  -->  ¬A ∧  B       (A is false, negate it)
Row 4: A=F, B=F  -->  ¬A ∧ ¬B       (both false, negate both)
```

Join with OR:

```
DNF = (A ∧ B) ∨ (¬A ∧ B) ∨ (¬A ∧ ¬B)
```

## Deep Dive: Generating CNF

CNF stands for **Conjunctive Normal Form** — an AND of ORs.

The algorithm:

```
FOR each row in the truth table:
    IF result is FALSE:
        Build a maxterm:
            - variable is TRUE in this row  -->  NEGATE it   (e.g. ¬A)
            - variable is FALSE in this row  -->  keep as-is  (e.g. A)
            - OR all of them together
        Add this maxterm to the CNF list
JOIN all maxterms with AND
```

Notice it's the **mirror image** of DNF — look at FALSE rows instead of
TRUE, swap AND/OR, and flip the negation rule.

### Full Example: `A -> B`

```
  Truth table:
  +---+---+--------+
  | A | B | A -> B |
  +---+---+--------+
  | T | T |   T    |
  | T | F |   F    |  <-- FALSE row
  | F | T |   T    |
  | F | F |   T    |
  +---+---+--------+
```

Only one FALSE row:

```
  Row 2: A=T, B=F  -->  ¬A ∨ B       (A is true so negate, B is false so keep)
```

Join with AND (only one clause here):

```
  CNF = (¬A ∨ B)
```

**Why negate true variables?** The maxterm must be false _only_ for that
specific failing row. If A=T in the failing row, then ¬A is false for
that row. If B=F, then B is false for that row. OR-ing them: both are
false, so the whole clause is false — exactly what we want. For any other
row, at least one literal flips to true, making the clause true.

### Larger Example: `A & B`

```
  +---+---+-------+
  | A | B | A & B |
  +---+---+-------+
  | T | T |   T   |
  | T | F |   F   |  <-- maxterm: ¬A ∨ B
  | F | T |   F   |  <-- maxterm:  A ∨ ¬B
  | F | F |   F   |  <-- maxterm:  A ∨ B
  +---+---+-------+

  CNF = (¬A ∨ B) ∧ (A ∨ ¬B) ∧ (A ∨ B)
  DNF = (A ∧ B)                          (only one TRUE row)
```

### Side-by-Side Comparison

```
  +------------------------------+------------------------------+
  |            DNF               |            CNF               |
  +------------------------------+------------------------------+
  |  Look at TRUE rows           |  Look at FALSE rows          |
  |  Each row -> AND clause      |  Each row -> OR clause       |
  |  Keep true vars as-is        |  Negate true vars            |
  |  Negate false vars           |  Keep false vars as-is       |
  |  Join clauses with OR        |  Join clauses with AND       |
  |                              |                              |
  |  OR of ANDs                  |  AND of ORs                  |
  |  (minterm ∨ minterm ∨ ...)   |  (maxterm ∧ maxterm ∧ ...)   |
  +------------------------------+------------------------------+
```

### Edge Cases in the Code

- If the expression is **always true** (tautology): DNF has all rows, CNF has
  no FALSE rows so it defaults to `True`.
- If the expression is **always false** (contradiction): DNF has no TRUE rows
  so it defaults to `False`, CNF has all rows.
- Single-variable expressions skip the parentheses around clauses since
  there's nothing to group.

## Pipeline Summary

```
"A & B -> C"
      |
      v
+---------+     +---------+     +-----------+     +----------+
| Tokenize | --> |  Parse  | --> | Evaluate  | --> |  Derive  |
|          |     |  (AST)  |     | (per row) |     | CNF/DNF  |
+---------+     +---------+     +-----------+     +----------+
      |               |                |                  |
  Token array    Tree with         Truth table       Normal form
                precedence        T/F values         strings
```
