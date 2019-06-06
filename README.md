jquery.zip.jsが必要な場合はこちらから取ってきてください。
https://github.com/yatt/jquery.zip.inflate

Chromeで実行する場合の注意
ローカルフォルダに置いて実行する場合は、Chrome起動時に --allow-file-access-from-files オプションを指定してください。

IEで実行する場合の注意
ローカルフォルダに置いて実行する方法はありません。Webサーバー経由で実行してください。

Webpackのインストール
$ npm init -y
$ npm install webpack webpack-cli html-webpack-plugin html-webpack-inline-source-plugin babel-loader @babel/core @babel/preset-env --save-dev

Webpackの実行
$ webpack
