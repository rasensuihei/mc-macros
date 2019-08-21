// Directive Specification:
//   types: An array of 'int', 'float', 'string', 'bool', 'json', 'expr'.
//   command: A handler function for macro expansion.
//   blockBegin: A handler function for beginning of block.
//   repeat: A handler function for repeating a block.
//   blockEnd: A handler function for end of block.

function addConstant(cx, name, value) {
  if (cx.addScore('mcm.const.' + name)) {
    cx.appendInitialCommand('scoreboard', `players set 0-0-0-0-0 mcm.const.${name} ${value}`);
  }
}

exports.init = cx => {
  cx.appendInitialCommand('execute', 'unless entity 0-0-0-0-0 run summon minecraft:armor_stand 0 0 0 {UUIDMost: 0L, UUIDLeast: 0L, Marker: 1b}');
};

const directives = {
  const: {
    type: 'command',
    types: ['int'],
    command: (cx, val) => {
      cx.appendLine(`scoreboard objectives add mcm.const.${val} dummy`);
      cx.appendLine(`scoreboard players set 0-0-0-0-0 mcm.const.${val} ${val}`);
    }
  },   // Short operation.
  op: {
    types: ['string', 'string', 'string', 'string', 'string'],
    command: (cx, left, a, op, right, b) => {
      if (b) {
        cx.appendLine(`scoreboard players operation ${left} ${a} ${op} ${right} ${b}`);
      } else {
        const num = parseInt(right);
        addConstant(cx, num, num);
        cx.appendLine(`scoreboard players operation ${left} ${a} ${op} 0-0-0-0-0 mcm.const.${num}`);
      }
    }
  },
  // Math macros.
  abs: {
    types: ['string', 'string'],
    command: (cx, target, score) => {
      cx.appendLine(`execute if score ${target} ${score} matched ..-1 run scoreboard players operation ${target} ${score} *= 0-0-0-0-0 mcm.const.-1`);
    }
  },
  negate: {
    types: ['string', 'string'],
    command: (cx, target, score) => {
      addConstant(cx, -1, -1);
      cx.appendLine(`execute if score ${target} ${score} matches 1.. run scoreboard players operation ${target} ${score} *= 0-0-0-0-0 mcm.const.-1`);
    }
  },
  // overwrite 'function' command.
  function: {
    types: ['string'],
    command: (cx, name) => {
      const index = name.indexOf(':');
      if (index > -1) {
        cx.appendLine('function', name);
      } else {
        cx.appendLine('function', cx.namespace + ':' + name)
      }
    }
  },
  repeat: {
    types: ['int'],
    command: (cx, n) => {
      cx.addScore('mcm.repeat.var');
      cx.appendLine('scoreboard players set 0-0-0-0-0 mcm.repeat.var 0');
      cx.enterAnonymousFunction();
    },
    blockEnd: (cx, n) => {
      cx.appendLine('scoreboard players add 0-0-0-0-0 mcm.repeat.var 1')
      cx.appendLine(`execute if score 0-0-0-0-0 mcm.repeat.var matches ..${n} run function ${cx.currentFunction}`);
      cx.exitFunction();
    }
  },
  'exp-repeat': {
    types: ['int'],
    blockBegin: (cx, n) => {
      // 'count' will expand to template literal.
      cx.scope.count = 0;
    },
    repeat: (cx, n) => {
      cx.scope.count++;
      return cx.scope.count < n;
    },
  },
  foreach: {
    command: (cx, words) => {
      cx.append(`execute as ${words} at @s run `);
      cx.enterAnonymousFunction();
    },
    blockEnd: (cx, words) => {
      cx.exitFunction();
    }
  },
  'exp-foreach': {
    types: ['json'],
    blockBegin: (cx, array) => {
      // 'count' will expand to template literal.
      cx.scope.count = 0;
      cx.scope.item = array[cx.scope.count];
    },
    repeat: (cx, array) => {
      cx.scope.count++;
      cx.scope.item = array[cx.scope.count];
      return cx.scope.count < array.length;
    },
  }
};

// It's a joke alias.
directives['greeting'] = {
  command: (cx, words) => cx.appendLine('say', words)
};

exports.directives = directives;
