## 4. Loops and Iteration

SMC provides flexible looping constructs to handle both conditional iteration and fixed-range iterations. All loops in SMC use the standard `do ... end` block structure.

### The `while` Loop

The `while` loop executes a block of code as long as a specified condition remains `true`. It is ideal for situations where the number of iterations is not known beforehand.

```
var $COUNTER = 0

while $COUNTER < 5 do
    echo "Iteration %{COUNTER}"
    $COUNTER = $COUNTER + 1
end

```

### The `for` Loop (Ranges)

For iterating over a specific sequence of numbers, SMC uses a `for ... in ... do` syntax combined with the `..` range operator. This automatically handles the initialization and incrementing of the loop variable.

```
# Iterates from 1 up to and including 5
for $i in 1..5 do
    echo "Iteration %{i}"
end

```

You can also use variables to define the start and end points of a range:

```
var $start = 10
var $end = 15

for $index in $start..$end do
    echo "Processing item %{index}"
end

```

### Loop Control: `break` and `continue`

SMC supports standard control statements to alter the flow of a loop from within its block.

* **`break`**: Immediately exits the entire loop. Execution resumes at the first statement after the `end` keyword.
* **`continue`**: Skips the rest of the current iteration and immediately jumps back to the top of the loop to evaluate the condition or grab the next item.

```
for $num in 1..10 do
    if $num == 3 then
        # Skips printing "3"
        continue 
    end

    if $num == 8 then
        # Stops the loop entirely when it hits "8"
        break 
    end

    echo "Number: %{num}"
end

```

### Iteration Summary

| Loop Type | Syntax Structure | Best Use Case |
| --- | --- | --- |
| **While** | `while <condition> do ... end` | Iterating until a specific state or condition changes. |
| **For Range** | `for $var in <start>..<end> do ... end` | Executing a block a precise, known number of times. |