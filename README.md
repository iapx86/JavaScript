Webpackのインストール
$ npm init -y
$ npm install webpack webpack-cli html-webpack-plugin html-webpack-inline-source-plugin babel-loader @babel/core @babel/preset-env @babel/plugin-proposal-class-properties --save-dev

Webpackの実行
$ webpack

jquery.zip.jsが必要な場合はこちらから取ってきてください。
https://github.com/yatt/jquery.zip.inflate

Chromeで実行する場合の注意
ローカルフォルダに置いて実行する場合は、Chrome起動時に --allow-file-access-from-files オプションを指定してください。
サウンド出力有効で開始する場合は、Chrome起動時に --autoplay-policy=no-user-gesture-required オプションを指定してください。

IEで実行する場合の注意
ローカルフォルダに置いて実行する方法はありません。Webサーバー経由で実行してください。

Firefoxで実行する場合の注意
バージョン68でローカルフォルダからのファイル読み込みが制限されました。ローカルフォルダに置いて実行する場合は、about:configのprivacy.file_unique_originの値をfalseにしてください。

DevServerのインストール
$ npm install webpack-dev-server --save-dev

DevServerの実行例
$ webpack-dev-server --open iexplore --open-page 1942.html
