const path = require('path');

exports.directives = {
  namespace: {
    types: ['string'],
    command: (cx, str) => {
      cx.namespace = str
      cx.setInitialFunction(cx.namespace, 'init')
    }
  },
  require: {
    types: ['string'],
    command: (cx, str) => {
      const macros = './' + path.dirname(cx.source) + '/' + str + '.js';
      const mod = require(macros);
      const dir = mod.directives
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
    command: (cx, words) => {
      const args = words.split(':');
      if (args.length == 1) {
        cx.switchFunction(cx.namespace, words);
      } else if (args.length == 2) {
        cx.switchFunction(args[0], args[1]);
      }
    }
  },
  anon: {
    blockBegin: cx => cx.enterAnonymousFunction(),
    blockEnd: cx => cx.exitFunction()
  },
  datapacktag: {
    command: (cx, words) => {
      if (words == 'load' || words == 'tick') {
        const values = cx.settings.datapack[words].data.values;
        if (values.indexOf(cx.currentFunction) == -1) {
          values.push(cx.currentFunction);
        }
      } else {
        throw new Error('Unknown tag: "' + words + '"');
      }
    }
  }
};
