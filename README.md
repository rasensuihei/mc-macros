# mc-macros : Minecraft Function Macros

[English](README.md) | [日本語](README.ja.md)

You'll get macros of your own.

## Installation
Node.js is required for execution.

```sh
npm install -g mc-macros
```

### Run
```sh
mcmacros [-v | --verbose] DatapackDir ... InputFiles
```

#### DatapackDir
Specify the directory of the data pack you want to output.

#### InputFiles
Specifies one or more input files. Input files are always processed in the order specified.

#### `` -v`` `` --verbose``
Output result to a file is displayed by adding `` -v`` option.

---
## Basic macro
These basic macros are always loaded. These are defined in `` defaults.js``.

### namespace
When using anonymous functions, you must first specify a default namespace with `` namsspace``.

```mcfunction
namespace foo
```

### anon (anonymous function)
In the Minecraft function, when you want to express the control structure, you need to create a mcfunction file with a name for the structure, which makes editing very complicated.

By using the ``anon`` macro and indent blocking instead of the ``function ...`` command, The contents of the block are output to another mcfunction file and expanded as a command that will be executed.

The function namespace is the value specified by the `` namespace`` macro.

```mcfunction
namespace sweden
anon
  say Mojang.
```

When this macro is expanded, the following mcfuncion will probably be output.

```mcfunction
function sweden: anon/0_0
```
```mcfunction
# ========================================
# data/sweden/functions/anon/0_0.mcfunction
say Mojang.
```

Furthermore, it is a good example of an anonymous function.

```mcfunction
execute as @e[tag=Adios] at @s run anon
  say Adios.
  tp @s ~ ~ 100 ~
```

Since the command source is given to the anonymous function and executed, ``@e[tag=Adios]`` can be processed only once.

#### recursive
Within an anonymous function block, `` recursive`` can recursively execute itself.
```mcfunction
execute as @e[type=cow,limit=1,sort=nearest] run anon
  execute store result score @p tmp run data get entity @s Health
  scoreboard players operation @p HealthCount += @p tmp
  kill @s
  execute if score @p HealthCount matches ..100 as @e[type=cow,limit=1,sort=nearest] run recursive
```

In this example, the health of the bulls to be killed is counted and killed one by one until the total reaches 100 or more.

### mcfunction
Switches the mcfunction file to be output.
If the namespace is omitted, the value specified by ``namespace`` is used.

```mcfunction
namespace foo

# output to data/foo/functions/bar.mcfunction
mcfunction bar
say Bar.

# output to data/sweden/functions/mojang.mcfunction
mcfunction sweden: mojang
say Mojang.
```

#### Function tag specification
```mcfunction
mcfunction myload load

mcfunction mytick tick

mcfunction myloadandtick load tick

```
By specifying the function tag in the data pack following the function name, ``load`` and ``init`` are registered in ``load.json`` and ``tick.json`` of ``data/minecraft/tags/functions`` respectively.

When using a macro that uses the initialization function, the function registered in `` load`` is required.

If a tagged function is no longer needed, it must be corrected manually.

### define
Sets a key and value in the current scope of the preprocessor.
This makes the string template using the Template Literal of ES2015/ES6 work.

```mcfunction
define foo bar
say ${foo}.
# => say bar.

define num 10
say ${num * num}.
# => say 100.
```

The template string is processed when the command macro is output, so if you give a ``define`` value to a parameter that internally processes the value in the macro, you will get unexpected results.

### require
Macro modules can be added for each input file.

```mcfunction
require mymacros
```

This example configures the preprocessor to use the mymacros.js macro module in the same directory as the input file.

---
## Macro module

Please refer to the definition example.
https://github.com/rasensuihei/mc-macros/blob/master/test/mymacros.js

### Initialize
Set a function to expand the initialization command in `` exports.init``.

```javascript
exports.init = cx => {
  cx.appendInitialCommand ('execute unless entity 0-0-0-0-0 run summon minecraft:armor_stand ~ ~ ~ {UUIDMost: 0L, UUIDLeast: 0L, Marker: 1b}')
}
```

### directive
Set the directives dictionary array to `` exports.directives``.

```javascript
directives ['greeting'] = {
  command: (cx, words) => cx.appendLine ('say', words)
}
exports.directives = directives
```

#### Parameter type
By specifying `` types`` in the directive, you can specify the parameter types that the macro receives.
These can be any arrays of 'int', 'float', 'string', 'bool', 'json', 'expr'.

If `` types`` is omitted, the character string of the text line excluding the command name becomes the parameter.

#### handler function
* command: Command macro expansion handler
* blockBegin: Block start handler
* blockRepeat: Handler that repeats a block
* blockEnd: Block end handler
