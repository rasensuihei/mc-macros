// Directive Specification:
//   types: An array of 'int', 'float', 'string', 'bool', 'json', 'expr'.
//   command: A handler function for macro expansion.
//   blockBegin: A handler function for beginning of block.
//   blockRepeat: A handler function for repeating a block.
//   blockEnd: A handler function for end of block.

const StoreEntity = '0-0-0-0-0';

function addConstant(cx, name, value) {
  if (cx.addScore('mcm.const.' + name)) {
    cx.appendInitialCommand(`scoreboard players set ${StoreEntity} mcm.const.${name} ${value}`);
  }
}

exports.init = cx => {
  cx.appendInitialCommand(`execute unless entity ${StoreEntity} run summon minecraft:armor_stand ~ ~ ~ {UUIDMost: 0L, UUIDLeast: 0L, Marker: 1b}`);
};

const directives = {
  var: {
    types: ['string'],
    command: (cx, name) => {
      cx.appendInitialCommand(`scoreboard objectives add ${name} dummy`);
    }
  },
  const: {
    types: ['string', 'string'],
    command: (cx, name, value) => {
      cx.appendLine(`scoreboard objectives add mcm.const.${name} dummy`);
      cx.appendLine(`scoreboard players set ${StoreEntity} mcm.const.${name} ${value}`);
    }
  },
  op: {
    // Short operation.
    types: ['string', 'string', 'string', 'string', 'string'],
    command: (cx, left, a, op, right, b) => {
      if (b) {
        cx.appendLine(`scoreboard players operation ${left} ${a} ${op} ${right} ${b}`);
      } else {
        const num = parseInt(right);
        addConstant(cx, num, num);
        cx.appendLine(`scoreboard players operation ${left} ${a} ${op} ${StoreEntity} mcm.const.${num}`);
      }
    }
  },
  // Math macros.
  abs: {
    types: ['string', 'string'],
    command: (cx, target, score) => {
      cx.appendLine(`execute if score ${target} ${score} matched ..-1 run scoreboard players operation ${target} ${score} *= ${StoreEntity} mcm.const.-1`);
    }
  },
  negate: {
    types: ['string', 'string'],
    command: (cx, target, score) => {
      addConstant(cx, -1, -1);
      cx.appendLine(`execute if score ${target} ${score} matches 1.. run scoreboard players operation ${target} ${score} *= ${StoreEntity} mcm.const.-1`);
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
      cx.appendLine(`scoreboard players set ${StoreEntity} mcm.repeat.var 0`);
      cx.enterAnonymousFunction();
    },
    blockEnd: (cx, n) => {
      cx.appendLine(`scoreboard players add ${StoreEntity} mcm.repeat.var 1`)
      cx.appendLine(`execute if score ${StoreEntity} mcm.repeat.var matches ..${n} run function ${cx.currentFunction}`);
      cx.exitFunction();
    }
  },
  'exp-repeat': {
    types: ['int', 'int'],
    blockBegin: (cx, a, b) => {
      // 'count' will expand to template literal.
      if (b) {
        cx.scope._count = a;
        cx.scope._end = b;
      } else {
        cx.scope._count = 0;
        cx.scope._end = a;
      }
    },
    blockRepeat: (cx, a, b) => {
      cx.scope.count = cx.scope._count;
      return cx.scope._count++ < cx.scope._end;
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
    blockRepeat: (cx, array) => {
      if (cx.scope.count < array.length) {
        cx.scope.item = array[cx.scope.count];
        cx.scope.count++;
        return true;
      }
      return false;
    },
  }
};

// It's a joke alias.
directives['greeting'] = {
  command: (cx, words) => cx.appendLine('say', words)
};

exports.directives = directives;
