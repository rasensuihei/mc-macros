const path = require('path');

exports.directives = {
  namespace: {
    types: ['string'],
    command: (cx, str) => {
      cx.namespace = str;
    }
  },
  require: {
    types: ['string'],
    command: (cx, str) => {
      const progDir = path.dirname(require.main.filename);
      const macroDir = path.relative(progDir, path.dirname(cx.source));
      const macroFile = path.join(macroDir, path.join(str + '.js'));
      if (cx.settings.verbose) {
        console.log('Require: ' + macroFile);
      }
      const mod = require(macroFile);
      const dir = mod.directives;
      const init = mod.init;
      if (init) {
        init(cx);
      }
      if (dir) {
        Object.assign(cx.directives, dir);
      }
    }
  },
  mcfunction: {
    types: ['string'],
    command: (cx, arg) => {
      // switch the output mcfunction file.
      let [ns, name] = cx.splitFunctionName(arg);
      cx.switchFunction(ns, name);
      // datapack tags
      cx.node.args.slice(1).forEach(tag => {
        if (tag == 'load' || tag == 'tick') {
          if (tag == 'load' && !cx.hasInitialFunction()) {
            cx.setInitialFunction(ns, name);
          }
          const values = cx.settings.datapack[tag].data.values;
          if (values.indexOf(cx.currentFunction) == -1) {
            values.push(cx.currentFunction);
          }
        } else {
          throw cx.createError('Unknown tag: "' + tag + '"');
        }
      });
    }
  },
  anon: {
    blockBegin: cx => cx.enterAnonymousFunction(),
    blockEnd: cx => cx.exitFunction()
  },
  recursive: {
    command: cx => {
      if (cx.isInAnonymousFunction()) {
        cx.appendLine('function', cx.currentFunction);
      } else {
        throw cx.createError('Recursive only inside anonymous functions.');
      }
    }
  },
  define: {
    types: ['string', 'string'],
    command: (cx, name, value) => cx.scope[name] = value
  }
};
