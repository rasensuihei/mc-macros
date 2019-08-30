const path = require('path')

const directives = {}

directives.namespace = {
  types: ['string'],
  command: (cx, str) => {
    cx.namespace = str
  }
}
directives.require = {
  types: ['string'],
  command: (cx, str) => {
    const progDir = path.dirname(require.main.filename)
    const macroDir = path.relative(progDir, path.dirname(cx.source))
    const macroFile = path.join(macroDir, path.join(str + '.js'))
    if (cx.settings.verbose) {
      console.log('Require: ' + macroFile)
    }
    const mod = require(macroFile)
    const dir = mod.directives
    const init = mod.init
    if (init) {
      init(cx)
    }
    if (dir) {
      Object.assign(cx.directives, dir)
    }
  }
}
directives.mcfunction = {
  types: ['string'],
  command: (cx, arg) => {
    // switch the output mcfunction file.
    const [ns, name] = cx.splitFunctionName(arg)
    cx.switchFunction(ns, name)
    // datapack tags
    cx.node.args.slice(1).forEach(tag => {
      if (tag === 'load' || tag === 'tick') {
        if (tag === 'load' && !cx.hasInitialFunction()) {
          cx.setInitialFunction(ns, name)
        }
        const values = cx.settings.datapack[tag].data.values
        if (values.indexOf(cx.currentFunction) === -1) {
          values.push(cx.currentFunction)
        }
      } else {
        throw cx.createError('Unknown tag: "' + tag + '"')
      }
    })
  }
}
directives.anon = {
  blockBegin: cx => cx.enterAnonymousFunction(),
  blockEnd: cx => cx.exitFunction()
}
directives.recursive = {
  command: cx => {
    if (cx.isInAnonymousFunction()) {
      cx.appendLine('function', cx.currentFunction)
    } else {
      throw cx.createError('Recursive only inside anonymous functions.')
    }
  }
}
directives.define = {
  types: ['string', 'string'],
  command: (cx, name, value) => {
    cx.scope[name] = value
  }
}
directives.init_objective = {
  types: ['string'],
  command: (cx, name) => {
    cx.initObjective(name)
  }
}

/**
 * switch (N-ary tree search)
 *
 * switch Target Score N(default is 2)
 *   case 0
 *     ...
 *   case 1
 *     ...
 *   case 2..9
 *     ...
 *   case 10.. (10 or more)
 *     ...
 *
 * scoped variable: range ..
 * Do not recurse.
 */

function getRange (array) {
  let min
  let max
  array.forEach(node => {
    const value = node.args[0]
    const values = value.split('..')
    const single = values.length === 1
    const left = single ? value : values[0]
    const right = single ? value : values[1]
    if (left !== '') {
      const intValue = parseInt(left)
      min = (min !== undefined) ? Math.min(min, intValue) : intValue
    } else {
      min = Number.NEGATIVE_INFINITY
    }
    if (right !== '') {
      const intValue = parseInt(right)
      max = (max !== undefined) ? Math.max(max, intValue) : intValue
    } else {
      max = Number.POSITIVE_INFINITY
    }
  })
  if (min === max) {
    return `${min}`
  } else {
    min = min !== Number.NEGATIVE_INFINITY ? min : ''
    max = max !== Number.POSITIVE_INFINITY ? max : ''
    return `${min}..${max}`
  }
}

function createTreePrograms (n, block, table, prog = { exits: -1, ranges: [] }) {
  const len = block.length
  const size = Math.ceil(len / n)
  let exits
  // Slices a block.
  for (let begin = 0; begin < len; begin += size) {
    const end = Math.min(begin + size, len)
    const slicedBlock = block.slice(begin, end)
    const isSingle = slicedBlock.length === 1
    const range = isSingle ? block[begin].args[0] : getRange(slicedBlock)
    let innerProg
    if (begin === 0) {
      // Smaller case.
      exits = prog.exits
      prog.exits = 0
      prog.ranges.push(range)
      innerProg = prog
    } else if (end < len) {
      // Other case.
      innerProg = { exits: 0, ranges: [range] }
    } else {
      // Larger case. Increment function exits count.
      innerProg = { exits: exits + 1, ranges: [range] }
    }
    if (isSingle) {
      table[range] = innerProg
    } else {
      // call recursive.
      createTreePrograms(n, slicedBlock, table, innerProg)
    }
  }
}

directives.switch = {
  types: ['string', 'string', 'int'],
  command: (cx, targets, score, n = 2) => {
    if (n <= 1) {
      throw cx.createError(`Illegal tree search argument: n=${n}.`)
    }
    cx.enterScope()
    cx.scope._targets = targets
    cx.scope._score = score
    const table = {}
    cx.scope._switchTable = table
    createTreePrograms(n, cx.node.block, table)
  },
  blockEnd: (cx, target, score) => {
    cx.exitScope()
  }
}

directives.case = {
  types: ['string'],
  command: (cx, value) => {
    const prog = cx.scope._switchTable[value]
    const targets = cx.scope._targets
    const score = cx.scope._score
    prog.ranges.forEach(range => {
      cx.append(`execute if score ${targets} ${score} matches ${range} run `)
      cx.enterAnonymousFunction()
    })
    cx.scope.range = value
  },
  blockEnd: (cx, value) => {
    const prog = cx.scope._switchTable[value]
    for (let i = 0; i <= prog.exits; i++) {
      cx.exitFunction()
    }
  }
}

exports.directives = directives
