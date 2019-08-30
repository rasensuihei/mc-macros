# mc-macros : Minecraft Function Macros

[English](README.md) | [日本語](README.ja.md)

あなたは自分のマクロを手に入れるでしょう。

## インストールと実行
実行には Node.js が必要です。
```sh
npm install -g mc-macros
```

### 実行
```sh
mcmacros [-v|--verbose] DatapackDir ...InputFiles
```

#### DatapackDir
出力したいデータパックのディレクトリを指定します。

#### InputFiles
1 つ以上の入力ファイルを指定します。入力ファイルは必ず指定された順序で処理されます。

#### ``-v`` ``--verbose``
``-v`` オプションをつけることでファイルへの出力結果等を表示します。

---
## 基本的なマクロ
これらの基本的なマクロは必ずロードされます。これらは ``defaults.js`` で定義されています。

### namespace
匿名ファンクションを使う場合、最初に ``namsspace`` でデフォルトの名前空間を指定する必要があります。

```mcfunction
namespace foo
```

### anon (匿名ファンクション)
Minecraft ファンクションでは制御構造を表現したい時に構造に名前を付けて mcfunction ファイルを作成する必要があり、編集が非常に煩雑になります。

``function ...`` コマンドではなく ``anon`` マクロとインデントによるブロック化を使用すると、ブロックの内容を別の mcfunction ファイルに出力し、そのファンクションが実行されるように展開されます。

ファンクションの名前空間には ``namespace`` マクロで指定された値が使われます。

```mcfunction
namespace sweden
anon
  say Mojang.
```

このマクロが展開されると、おそらく以下のようなmcfuncionが出力されます。

```mcfunction
function sweden:anon/0_0
```
```mcfunction
# ========================================
# data/sweden/functions/anon/0_0.mcfunction
say Mojang.
```

更に匿名ファンクションの有効な例です。

```mcfunction
execute as @e[tag=Adios] at @s run anon
  say Adios.
  tp @s ~ ~100 ~
```

コマンドソースを匿名ファンクションに与えて実行するため、``@e[tag=Adios]`` の処理を一回だけで済ませることができます。

### recursive
匿名ファンクションのブロック内部で ``recursive`` によって自身を再帰実行できます。
```mcfunction
execute as @e[type=cow,limit=1,sort=nearest] run anon
  execute store result score @p tmp run data get entity @s Health
  scoreboard players operation @p HealthCount += @p tmp
  kill @s
  execute if score @p HealthCount matches ..100 as @e[type=cow,limit=1,sort=nearest] run recursive
```

この例では殺す牛の体力をカウントしその合計が100以上になるまで一体づつ殺していきます。

### mcfunction
出力する mcfunction ファイルを切り替えます。
名前空間を省略した場合 ``namespace`` で指定された値が使われます。

```mcfunction
namespace foo

# output to data/foo/functions/bar.mcfunction
mcfunction bar
say Bar.

# output to data/sweden/functions/mojang.mcfunction
mcfunction sweden:mojang
say Mojang.
```

### switch and case
``switch`` と ``case`` 及びその内部ブロックをN分探索木として展開します。

```mcfunction
switch Targets Objective N
  case ...
    ...
  case ...
    ...
```

``N`` を省略した場合はデフォルト値の 2 (二分探索)が使われます。

```mcfunction
switch @s tmp
  case 0
    say Result is zero.
  case 1..2
    say Result is 1 to 2.
  case 3..
    say Result is 3 or more.
```

注意点
* ``case`` の値は小さい値から大きい値に順序づけされている必要があります。
* 再帰できません。
* ブロック内部でスコアを変更したい場合は値のコピーを作成する必要があります。

#### ファンクションタグの指定
```mcfunction
mcfunction myload load

mcfunction mytick tick

mcfunction myloadandtick load tick

```
ファンクション名に続いてデータパックにおけるファンクションのタグを指定することで ``load`` と ``init`` はそれぞれが ``data/minecraft/tags/functions`` の ``load.json`` と ``tick.json`` に登録されます。

初期化機能を使用したマクロを利用する場合、``load`` に登録したファンクションは必須です。

タグ付けされたファンクションが不要になった場合、手動で修正する必要があります。

### define
プリプロセッサの現在のスコープにキーと値をセットします。
これにより ES2015/ES6 の Template Literal を使った文字列テンプレートが機能します。

```mcfunction
define foo bar
say ${foo}.
# => say bar.

define num 10
say ${num*num}.
# => say 100.
```

テンプレート文字列はコマンドマクロの出力時に処理されるため、マクロ内で値を内部処理するようなパラメータに ``define`` された値を与えた場合、予期しない結果になります。

### require
入力ファイルごとにマクロモジュールをいくつでも追加することができます。

```mcfunction
require mymacros
```

この例は入力ファイルと同じディレクトリにある mymacros.js マクロモジュールをプリプロセッサが使用するように設定します。

---
## マクロモジュール
初期化関数やマクロ関数をモジュールにすることで ``require`` によるインポートが可能になります。

定義例を参考にして下さい。
https://github.com/rasensuihei/mc-macros/blob/master/test/mymacros.js

### 初期化関数
``exports.init`` に初期化用コマンドを展開する関数を設定します。

```javascript
exports.init = cx => {
  cx.appendInitialCommand ('execute unless entity 0-0-0-0-0 run summon minecraft:armor_stand ~ ~ ~ {UUIDMost: 0L, UUIDLeast: 0L, Marker: 1b}')
}
```

### マクロ関数
``exports.directives`` にマクロ関数を設定します。

```javascript
const directives = {}
directives['greeting'] = {
  command: (cx, words) => cx.appendLine ('say', words)
}
exports.directives = directives
```

#### マクロ関数のパラメータ型
ディレクティブに ``types`` を指定することでマクロが受けとるパラメータの型を指定できます。
これらは 'number', 'int', 'float', 'string', 'bool', 'json', 'expr' の任意の配列になります。

``types`` を省略した場合、コマンド名を除いたテキスト行の文字列がパラメータになります。

```javascript
directives['calc'] = {
  types: ['number', 'string', 'number'],
  command: (cx, left, op, right) => {
    if (op === '+') {
      cx.appendLine ('say', left + right)
    }
  }
}
```

#### ハンドラ関数
マクロコマンドは最初に ``command`` が呼ばれ、マクロコマンドの次の行にインデントされたブロックがあれば ``blockBegin``、``blockRepeat``、``blockEnd``が順番に実行されます。

全てのハンドラは省略可能です。

| 名前 | 説明 |
|-|-|
| command | 基本的なコマンドマクロのハンドラです。ブロックのあるなしにかかわらず必ず最初に実行します。|
| blockBegin | ブロックのマクロ展開を開始する前に実行されるハンドラです。|
| blockRepeat | ブロックのマクロを展開する前に実行され、true を返す限りブロックをリピートし続けるハンドラです。省略した場合ブロックは必ず 1 回だけ展開されます。|
| blockEnd | ブロックのマクロ展開が終了すると一回だけ呼ばれるハンドラです。|

### PreprocessContext クラス
ディレクティブの具体的な機能は PreprocessContext オブジェクトを操作することで実装できます。

コンテキストにおけるブロック、ファンクション、文字列展開用のスコープは互いに無関係である点に注意して下さい。

| メソッド | 説明 |
|-|-|
| append(...str) | 現在のファンクションに文字列を追加します。複数の引数であれば ``join(' ')`` されます。改行は行いません。|
| appendLine(...str) | 現在のファンクションに文字列と改行を追加します。|
| appendInitialCommand(...str) | 設定された初期化用ファンクションに文字列と改行を追加します。|
| enterScope() | プリプロセッサの新しいスコープを作成しスタックします。|
| exitScope() | プリプロセッサの現在のスコープを終了します。|
| _boolean_ initObjective(name) | スコアボートのオブジェクティブ ``name`` を初期化します。|
| enterFunction(ns, name) | 指定した名前空間と名前でファンクションを作成しスタックします。|
| _string_ enterAnonymousFunction() | 匿名ファンクションを作成してスタックします。終了するときは exitFunction() を使用します。|
| exitFunction() | 現在のファンクションを終了します。|


