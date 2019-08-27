const fs = require('fs');
const readline = require('readline');
const path = require('path');
const DefaultDirectives = require('./defaults.js').directives;


class MacroError extends Error {
  constructor(cx, message) {
    super(`${message} (${cx.source}:${cx.node.lineNo})`);
    this.cx = cx;
  }
}

class TextBuilder {
  constructor() {
    this.text = '';
  }
  append(str) {
    this.text += str;
  }
}

let contextId = 0;

class PreprocessContext {
  constructor(source, settings, builders) {
    this.directives = {};
    this.source = source;
    this.settings = settings;
    this.dataDir = path.join(settings.datapackDir, 'data');
    this.node = null;
    this.anonDir = 'anon';
    this.namespace = 'unknown';
    this.currentFunction = null;
    this.builders = builders;
    this.scope = {};
    this._scopeStack = [];
    this._builder = null;
    this._functionStack = [];
    this._contextId = contextId++;
    this._anonId = 0;
    this._initialFunctionBuilder = null;
    Object.assign(this.directives, DefaultDirectives);
  }

  createError(...messages) {
    return new MacroError(this, messages.join(' '));
  }

  resolve(ns, name) {
    return (ns ? ns : this.namespace) + ':' + name;
  }

  splitFunctionName(func) {
    const array = func.split(':');
    if (array.length == 1) {
      return [this.namsspace, func];
    } else if (array.length == 2) {
      return array;
    }
    throw new Error(`Illegal function name: ${func}`);
  }

  _getBuilder(ns, name) {
    const namespace = ns ? ns : this.namespace;
    this.currentFunction = this.resolve(namespace, name);
    const filename = name + '.mcfunction';
    const file = path.join(this.dataDir, namespace, 'functions', filename);
    this._builder = this.builders[file];
    if (!this._builder) {
      this._builder = new TextBuilder();
      this.builders[file] = this._builder;
    }
    return this._builder;
  }

  addScore(name) {
    const defined = this.settings.scores[name];
    if (!defined) {
      this.settings.scores[name] = true;
      this.appendInitialCommand(`scoreboard objectives add ${name} dummy`)
      return true;
    }
    return false;
  }

  enterScope() {
    const newScope = {};
    Object.assign(newScope, this.scope);
    this._scopeStack.push(this.scope);
    this.scope = newScope;
  }

  exitScope() {
    this.scope = this._scopeStack.pop();
  }

  nextAnonymousName() {
    return this.anonDir + '/' + this._contextId + '_' + this._anonId++;
  }

  setInitialFunction(ns, name) {
    this._initialFunctionBuilder = this._getBuilder(ns, name);
  }

  hasInitialFunction() {
    return this._initialFunctionBuilder != null;
  }

  isInAnonymousFunction() {
    return this._functionStack.length > 0;
  }

  switchFunction(ns, name) {
    if (this.isInAnonymousFunction()) {
      throw this.createError('Cannot escape globally from within anonymous functions.');
    }
    this._builder = this._getBuilder(ns, name);
  }

  enterFunction(ns, name) {
    this._functionStack.push(this._builder);
    this._builder = this._getBuilder(ns, name);
  }

  exitFunction() {
    this._builder = this._functionStack.pop();
  }

  enterAnonymousFunction() {
    const anonymousName = this.nextAnonymousName();
    this.appendLine('function', this.resolve(this.namespace, anonymousName));
    this.enterFunction(this.namespace, anonymousName);
  }

  appendInitialCommand(...str) {
    if (this._initialFunctionBuilder) {
      this._initialFunctionBuilder.append(str.join(' ') + '\n');
    } else {
      throw this.createError('No function tagged with "load", e.g. "mcfunction load load".');
    }
  }

  append(...str) {
    const text = str.join(' ');
    const keys = Object.keys(this.scope);
    if (keys.length > 0 && text.indexOf('$') > -1) {
      const values = Object.keys(this.scope).map(key => this.scope[key]);
      const template = new Function(...keys, 'return `' + text + '`;');
      this._builder.append(template.apply(null, values));
    } else {
      this._builder.append(text);
    }
  }
  appendLine(...str) {
    this.append(str.join(' ') + '\n')
  }
}

const ArgumentParser = {
  string: x => x,
  bool: x => x == 'false' ? false : true,
  float: x => parseFloat(x),
  int: x => parseInt(x),
  json: x => JSON.parse(x),
  expr: x => eval(x)
};

class Preprocessor {
  constructor(settings, file) {
    this.settings = settings;
    this.cx = new PreprocessContext(file, settings, {});
    this.file = file;
    this.lineNo = 0;
    this.root = {lineNo:0, depth:0, block:[]};
    this.lastDepth = 0;
    this.stack = [];
    this.current = this.root;
    this.parser = new CommandParser();
  }
  process() {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(this.file, 'utf8');
      const readInterface = readline.createInterface(readStream, {});
      readInterface.on('line', line => this._parseLine(line));
      readInterface.on('close', x => {
        this._processNode(this.root);
        resolve(this.cx.builders);
      });
    });
  }
  getResult() {
    return this.cx.builders;
  }
  _processNode(node) {
    const block = node.block;
    const directives = this.cx.directives;
    let blockIndex = 0;
    // console.log(this.cx.scope);

    block.forEach(node => {
      if (node.execute) {
        this.cx.append('execute ' + node.execute.words + ' run ');
      }
      const dir = directives[node.command];
      if (dir) {
        this.cx.node = node;
        const args = dir.types ?
                this._createTypedArguments(this.cx, dir.types, node.args) :
                [this.cx, node.words];
        if (dir.command) {
          dir.command.apply(null, args);
        }
        if (node.block) {
          this.cx.enterScope();
          if (dir.blockBegin) {
            dir.blockBegin.apply(null, args);
          }
          if (dir.blockRepeat) {
            while(dir.blockRepeat.apply(null, args)) {
              this._processNode(node);
            }
          } else {
            this._processNode(node);
          }
          if (dir.blockEnd) {
            dir.blockEnd.apply(null, args);
            this.cx.exitScope();
          }
        }
      } else {
        this.cx.appendLine(node.command, node.words);
      }
    });
  }
  _createTypedArguments(cx, types, args) {
    const result = [cx];
    for (let i = 0; i < args.length; i++) {
      const type = types[i];
      const arg = args[i];
      result[i + 1] = type ? ArgumentParser[type](arg) : arg;
    }
    return result;
  }

  _parseLine(line) {
    const trimedLine = line.trim();
    if (trimedLine.length > 0 && trimedLine.charAt(0) != '#') {
      const depth = this._countDepth(line);
      if (depth > this.lastDepth) {
        this._enterNode(depth);
      } else if (depth < this.lastDepth) {
        this._exitNode(depth);
      }
      this.current.block.push(this._createCommandNode(line.substring(depth)));
      this.lastDepth = depth;
    }
    this.lineNo++;
  }

  _enterNode(depth) {
    this.stack.push(this.current);
    const lastNode = this.current.block[this.current.block.length - 1];
    lastNode.depth = depth;
    lastNode.block = [];
    this.current = lastNode;
  }

  _exitNode(depth) {
    let matched = false;
    let index = this.stack.length - 1;
    while (index >= 0) {
      if (this.stack[index].depth == depth) {
        matched = true;
        break;
      }
      index--;
    }
    if (matched) {
      this.current = this.stack.splice(index)[0];
    } else {
      this._error('Illegal depth indentation.');
    }
  }

  _createCommandNode(line) {

    const node = {
      lineNo: this.lineNo
    };
    const tokens = this.parser.parse(line);
    const head = tokens[0];
    if (head == 'execute') {
      const index = tokens.indexOf('run');
      if (index > -1) {
        // check an error.
        node.execute = {};
        node.execute.args = tokens.slice(1, index);
        node.execute.words = node.execute.args.join(' ');
        node.command = tokens[index + 1];
        node.args = tokens.slice(index + 2);
      }
    } else {
      node.command = head;
      node.args = tokens.slice(1);
    }
    node.words = node.args.join(' ');
    return node;
  }

  _error(message) {
    throw new Error(this.file + ': ' + this.lineNo + ' ' + message);
  }

  _countDepth(line) {
    for (let i = 0; i < line.length; i++) {
      if (' ' != line.charAt(i)) {
        return i;
      }
    }
    return 0;
  }
}

const OpenSymbols = '[{(';
const CloseSymbols = ']})';

class CommandParser {
  constructor() { }

  parse(line) {
    const tokens = [];
    const end = line.length;
    let tokenIndex = -1;
    let i = 0;
    while (i < end) {
      const c = line.charAt(i);
      if (c == ' ') {
        if (tokenIndex > -1) {
          tokens.push(line.substring(tokenIndex, i));
          tokenIndex = -1;
        }
        i++;
      } else {
        tokenIndex = i;
        i = this._parse(line, i, end, undefined);
      }
    }
    if (tokenIndex > -1) {
      tokens.push(line.substring(tokenIndex, i));
    }
    return tokens;
  }
  _parse(line, begin, end, close) {
    let i = begin;
    while (i < end) {
      const c = line.charAt(i);
      if (c == close) {
        return i + 1;
      } else if (c == ' ' && !close) {
        return i;
      }
      const symbolIndex = OpenSymbols.indexOf(c);
      if (symbolIndex > -1) {
        i = this._parse(line, i + 1, end, CloseSymbols[symbolIndex]);
      } else if (c == '"' || c == "'") {
        i = this._parseString(line, i + 1, end, c);
      } else {
        i++;
      }
    }
    return i;
  }
  _parseString(line, begin, end, quote) {
    let i = begin;
    while (i < end) {
      const c = line.charAt(i);
      if (c == quote) {
        return i + 1;
      } else if (c == '\\') {
        i += 2;
      } else {
        i++;
      }
    }    
    // throw this._createError(line, i, "String is not closed.");
    return i;
  }

  _createError(line, index, message) {
    return new Error(line.substring(0, index) + ' <- ' + message);
  }
}

class PreprocessSettings {
  constructor() {
    this.verbose = false;
    this.scores = {};
    this.datapackDir = null;
    this.inputfiles = null;
    this.datapack = {
      meta: {
        path: 'pack.mcmeta',
        data: {
          pack: {
            pack_format: 1,
            description: 'datapack'
          }
        }
      },
      load: {
        path: 'data/minecraft/tags/functions/load.json',
        data: {
          values: []
        }
      },
      tick: {
        path: 'data/minecraft/tags/functions/tick.json',
        data: {
          values: []
        }
      },
    };
  }
}

function loadDatapack(settings) {
  for (let [key, value] of Object.entries(settings.datapack)) {
    const file = path.normalize(path.join(settings.datapackDir, value.path));
    const data = value.data;
    try {
      if (fs.existsSync(file)) {
        // fs.mkdirSync(path.dirname(file), {recursive:true});
        const text = fs.readFileSync(file, {encoding: 'utf8'});
        settings.datapack[key].data = JSON.parse(text);
      }
    } catch (e) {
    }
  }
}

function writeDatapack(settings) {
  for (let [key, value] of Object.entries(settings.datapack)) {
    const file = path.normalize(path.join(settings.datapackDir, value.path));
    const data = value.data;
    fs.mkdirSync(path.dirname(file), {recursive:true});
    const writer = fs.createWriteStream(file, 'utf8');
    writer.on('finish', () => console.log(`File "${file}" has been updated.`));
    writer.write(JSON.stringify(data, null, ' '));
    writer.end();
  }
}

async function main() {
  const settings = new PreprocessSettings();
  const argv = process.argv.slice(2);
  function printUsage() {
    console.log('mc-macros [-v|--verbose] DatapackDir ...InputFiles');
  };
  function writeFiles(builders) {
    console.log('');
    for (let [file, builder] of Object.entries(builders)) {
      fs.mkdirSync(path.dirname(file), {recursive:true});
      const writer = fs.createWriteStream(path.normalize(file), 'utf8');
      const text = builder.text;
      writer.write(text);
      writer.end();
      writer.close();
      if (settings.verbose) {
        console.log('# ========================================');
        console.log('# File: ' + file);
        console.log(text);
      }
    }
  };
  let index = 0;
  while (index < argv.length) {
    const arg = argv[index];
    if (arg == '-v' || arg == '--verbose') {
      settings.verbose = true;
    } else if (!settings.datapackDir) {
      settings.datapackDir = arg;
    } else {
      settings.inputFiles = argv.slice(index);
      break;
    }
    index++;
  }
  if (!settings.datapackDir || !settings.inputFiles) {
    printUsage();
    return;
  }
  loadDatapack(settings);
  // Start Preprocess.
  const reducer = (acc, cur) => {
    for (let [file, currentBuilder] of Object.entries(cur)) {
      let builder = acc[file];
      if (!builder) {
        builder = new TextBuilder();
        acc[file] = builder;
      }
      builder.append(currentBuilder.text);
    }
    return acc;
  };
  const promises = [];
  settings.inputFiles.forEach(file => {
    const pp = new Preprocessor(settings, file);
    promises.push(pp.process());
  });
  await Promise.all(promises)
    .then(results => {
      writeFiles(results.reduce(reducer, {}))
      writeDatapack(settings);
    })
    .catch(error => {
      console.log(error.message);
    });
  console.log('Finished.');
}

main();
