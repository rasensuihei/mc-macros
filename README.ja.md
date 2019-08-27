# mc-macros : Minecraft Function Macros

[English](README.md)|[日本語](README.ja.md)

## インストールと実行
実行には Node.js が必要です。
そのうち npm 登録します。

### 実行
```
node index.js [-v|--verbose] DatapackDir ...InputFiles
```

#### DatapackDir
出力したいデータパックのディレクトリを指定します。

#### InputFiles
1 つ以上の入力ファイルを指定します。入力ファイルは必ず指定された順序で処理されます。

#### ``-v`` ``--verbose``
``-v`` オプションをつけることでファイルへの出力結果等を表示します。

## 基本的なマクロ
これらの基本的なマクロは必ずロードされます。これらは ``defaults.js`` で定義されています。

### namespace
匿名ファンクションを使う場合、最初に ``namsspace`` でデフォルトの名前空間を指定する必要があります。

```mcfunction
namespace foo
```

### anon (匿名ファンクション)
Minecraft ファンクションでは制御構造を表現したい時に構造に名前を付けて mcfunction ファイルを作成する必要があり、編集が非常に煩雑になります。

``function ...`` コマンドではなく ``anon`` マクロとインデントによるブロック化を使用することで、
ブロックの内容を別の mcfunction ファイルに出力し、実行されるコマンドとして展開されます。
ファンクションの名前空間には ``namespace`` マクロで指定された値が使われます。

```mcfunction
namespace sweden
anon
  say Mojang.
```

このマクロが展開されると、おそらく以下のようなmcfuncionが出力されます。

```mcfunction
function sweden:anon/0_0

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

コマンドソースを匿名ファンクションに与えて実行するため、
``@e[tag=Bye]`` の処理を一回だけで済ませることができます。

#### recursive
匿名ファンクションのブロック内では ``recursive`` によって自身を再帰実行できます。
```mcfunction
execute positioned ~ ~ ~ as @e[type=cow,limit=1,sort=nearest] run anon
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

#### ファンクションタグの指定
```mcfunction
mcfunction myload load

mcfunction mytick tick

mcfunction myloadandtick load tick

```
ファンクション名に続いてデータパックにおけるファンクションのタグを指定することで
 ``load`` と ``init`` はそれぞれが
``data/minecraft/tags/functions`` の ``load.json`` と ``tick.json`` に登録されます。

初期化機能を使用したマクロを利用する場合、``load`` に登録したファンクションは必須です。

タグ付けされたファンクションが不要になった場合、手動で修正する必要があります。

### define
プリプロセッサの現在のスコープに変数をセットします。
これにより ES2015/ES6 の Template Literal を使った文字列テンプレートが機能します。

```mcfunction
define foo bar
say ${foo}.
# => say bar.

define num 10
say ${num*num}.
# => say 100.
```

テンプレート文字列はコマンドマクロの出力時に処理されるため、マクロ内で値を内部処理するようなパラメータに ``define`` された値を与えた場合予期しない結果になります。

### require
入力ファイルごとにマクロモジュールを追加することができます。

```mcfunction
require mymacros
```

この例は入力ファイルと同じディレクトリにある mymacros.js マクロモジュールをプリプロセッサが使用するように設定します。

---
## マクロモジュール

定義例を参考にして下さい。
https://github.com/rasensuihei/mc-macros/blob/master/test/mymacros.js

### 初期化
``exports.init`` に初期化用コマンドを展開する関数を設定します。

```javascript
exports.init = cx => {
  cx.appendInitialCommand(`execute unless entity ${StoreEntity} run summon minecraft:armor_stand ~ ~ ~ {UUIDMost: 0L, UUIDLeast: 0L, Marker: 1b}`);
};
```

### ディレクティブ
``exports.directives`` にディレクティブの辞書配列を設定します。

```javascript
directives['greeting'] = {
    command: (cx, words) => cx.appendLine('say', words)
};
exports.directives = directives;
```

#### パラメータタイプ
ディレクティブに ``types`` を指定することでマクロが受けとるパラメータの型を指定できます。
これらは 'int', 'float', 'string', 'bool', 'json', 'expr' の任意の配列になります。

``types`` を省略した場合、コマンド名を除いたテキスト行の文字列がパラメータになります。

#### ハンドラ関数
* command: コマンドマクロ展開のハンドラ
* blockBegin: ブロック開始のハンドラ
* blockRepeat: ブロックをリピートするハンドラ
* blockEnd: ブロック終了のハンドラ
