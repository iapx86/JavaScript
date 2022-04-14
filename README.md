### Webpackのインストール
```
$ npm init -y
$ npm install webpack webpack-cli html-webpack-plugin html-webpack-inline-source-plugin babel-loader @babel/core @babel/preset-env @babel/plugin-proposal-class-properties @babel/plugin-transform-runtime @babel/runtime --save-dev
```
※最新のhtml-webpack-inline-source-pluginに問題があるらしいです。
### その他必要なもの
* make http://gnuwin32.sourceforge.net/packages/make.htm
### ビルド方法
```
$ make
$ webpack
```
### http-serverのインストール
```
$ npm install --global http-server
```
### http-serverの実行例
```
$ http-server -o dist/1942.html
```
