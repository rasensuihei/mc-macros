# Default function namespace. IMPORTANT
namespace test

# ========================================
# Switch the output mcfunction file.
mcfunction init load

# Macro module paths are resolved reative to this file.
# require('./mymacros.js') # like this.
require mymacros

setworldspawn 0 4 0
scoreboard objectives add tmp dummy
scoreboard objectives add score1 dummy
scoreboard objectives add score2 dummy

say Loaded.

# ========================================
mcfunction mytick tick
# greeting Ticking.

# ========================================
mcfunction subdir/test
greeting I'm in the subdir!

# ========================================
# Execute anonymous function
execute as @e[tag=target1] run anon
  # An Indented comment.
  greeting hello depth 1.
  # Mo deeper.
  execute as @e[tag=target2] run anon
    greeting hello depth 2.

# Back to 'test:subdir/test.mcfunction'.
greeting I'm back.

# Template literal and Operations.
define DataStore 0-0-0-0-0
op ${DataStore} score1 += ${DataStore} score2
# 100 will be automatically initialized.
op ${DataStore} score1 += 100

# Loop with scoreboard.
repeat 10
  greeting Hello 10 times.

# Featured ES2015/ES6 Template literal.
# This macro will be expanded.
exp-repeat 10 20
  greeting The value of the square of ${count} is ${count*count}.

# Anonymous function with the command source.
execute as @e[tag=WillDie] at @s run anon
  greeting Adios!
  kill @s

# Same result.
foreach @e[tag=WillDie]
  greeting Adios!
  kill @s

# Expand the JSON array.
exp-foreach ["foo", "bar", "baz"]
  greeting ${item}
