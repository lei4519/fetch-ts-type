# fetch-ts-type README

配置请求接口，根据响应结果生成 TS 类型，本地远程不一致时会生成 diff，支持自定义插件。

## Features
![](fetch.gif)

### 代码提示
输入 `/*` 可以自动生成代码注释
![](https://gitee.com/lei451927/picture/raw/master/images/20211123202057.png)

### 配置项

- `namespace`：生成类型的 `namespace`
- `url`：请求 `url`
- `method`: 请求方法，默认 GET
-  json： 直接配置 JSON 进行类型生成

字段配置完成后，点击「生成类型」即可根据响应体生成 TS type。

如果页面中已经生成过类型，就会将远程和本地的进行 `diff`。

diff 时会忽略空格、分号、注释等不重要的信息，远程和本地代码冲突时需要手动解决冲突，否则会同时保留两者的变更（本地新增、删除或远端新增、删除的都不会改动）

## 插件开发

基础功能只会处理 JSON 响应体，也不会处理登录态的问题，diff 的策略可能也不是你想要的。

所以你可以自行开发插件，改变或增强基础功能。



