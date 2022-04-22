# fetch-ts-type README

> 暂不支持 windows

配置请求接口，根据响应结果生成 TS 类型，本地远程不一致时会生成 diff，支持自定义中间件。

## Features
![](fetch.gif)

### 代码提示
输入 `/*` 可以自动生成代码注释
![](https://gitee.com/lei451927/picture/raw/master/images/20211123202057.png)

### 配置项

注释块中可以配置的项

```ts
/** fetchTsComment
 * @namespace 生成类型的 nameSpace
 * @url 发送请求的 url
 * @method GET
 * @cookie true
 * @json
 * {
 *     "is_success": false
 * }
 */

/** 注释中定义的配置信息，下面是基础功能支持的 */
interface Config {
  /** 生成类型的 namespace */
  namespace: string
  /** 请求地址 */
  url: string
  /** 请求方法 */
  method?: string
  /** 直接传入 JSON 进行解析, 配置 json 后不再请求 url */
  json?: string
  /**
   * 请求时通过 chrome-cookies-secure 获取 chrome cookie
   * 其原理是读取 chrome 存在磁盘中的 cookie 数据，第一次调用时可能需要系统授权（Mac）
   */
  cookie?: boolean
  /** 中间件自行增加，解析格式 「@key value」 */
  [key: string]: any
}
```

字段配置完成后，点击「生成类型」即可根据响应体生成 TS type。

如果页面中已经生成过类型，就会将远程和本地的进行 `diff`。

diff 时会忽略空格、分号、注释等不重要的信息，远程和本地代码冲突时需要手动解决冲突，否则会同时保留两者的变更（本地新增、删除或远端新增、删除的都不会改动）

## Cookie

请求时需要 Cookie 时，会通过 `chrome-cookies-secure` 获取你电脑中 chrome 的 cookie。

其原理是读取 chrome 存在本地磁盘中的 cookie 数据，第一次调用时可能需要系统授权（Mac）

## 中间件

基础功能只会处理 JSON 响应体，也不会处理登录态的问题，diff 的策略可能也不是你想要的。

所以你可以自行开发中间件，改变或增强基础功能。

### 中间件配置

请求获取中间件代码时默认不会携带 cookie，如果需要携带 cookie 在链接后添加 `?cookie=1` 即可。

这会读取 chrome 在本地磁盘中存储的 cookie，首次调用时可能需要系统授权。

中间件代码获取成功后会缓存在 vscode 本地存储中，默认 7 天（中间件代码可配），可以执行 `FetchTsType.reloadMWS` 命令手动清理，或者将请求链接改变也可。

### 中间件开发

中间件是运行时加载的 js 文件，通过 `new Function(module = {}, exports = module.exports)` 获取导出的类。

这意味着只能使用 require 导入 node 原生模块，所以必须将代码打包进一个文件中，借助 rollup 你可以轻易完成此操作。

从这个仓库中可以获取到一份基础的模板: https://github.com/lei4519/FTT-base-mw

详见：`src/plugin.d.ts`
```ts
/**
 * 以下为中间件开发的具体说明
 */

/**
 * 中间件以类的形式存在，必须实现这个接口
 * @example
 * class implements MW { }
 */
interface MW {
  /**
   * 中间件代码的缓存时间（毫秒），默认 7 天（1000 * 60 * 60 * 24 * 7）。
   * 可以调用 `FetchTsType.reloadMWS` 命令手动重新加载代码
   */
  cacheTime?: number
  /** 打开一个新的窗口，展示传入的内容，可用于错误提示，在创建实例之后会由外界进行赋值 */
  showDoc: ShowDocFn
  /**
   * 读取 chrome 存在磁盘中的 cookie 数据，第一次调用时可能需要系统授权（Mac）
   * https://github.com/bertrandom/chrome-cookies-chromeCookiesSecure
   */
  chromeCookiesSecure: ChromeCookiesSecure.Default
  /**
   * 主入口：生成类型字符串
   * 如果发生错误，直接抛出错误即可，外部会统一捕获错误并展示错误窗口
   */
  generate(ctx: Ctx, next: NextFn): Promise<Ctx>
  /** 当文档中已生成过代码时，生成 diff 代码 */
  generateDiffCode(ctx: Ctx, next: NextFn): Promise<Ctx>
  /** 卸载时的钩子函数 */
  dispose(): any
}

/** 上下文信息, 中间件可以仍意修改之中的内容，然后交由另一个中间件继续处理 */
interface Ctx {
  config: Config
  /** 文档中之前已经生成的代码，如果没有生成过就为 null */
  existCode: string | null
  /** 调用 generate 生成的代码 */
  newCode: string | null
  /** diff 算法，你也可以用其他的库 */
  diffFn: DiffFn
  /** 调用 generateDiffCode 生成的代码 */
  diffCode: string | null
}

/**
 * 参考 koa 中间件原理
 * 调用 await next 意味着继续由下一个中间件进行处理
 * await next 后的代码意味着下面的中间件已经处理完成，你可以接着对 ctx 做改造
 * 直接 return 不调用 next，意味着你希望当前中间件全权处理，不需要其他中间件插手
 * @example
 *  generate(ctx, next) {
 *    // 处理 ctx...
 *     await next() // 交由下一个中间件处理
 *     // 下一个中间件已经处理完成，接着处理 ctx...
 *     return ctx
 *  }
 */
interface NextFn {
  (): Promise<Ctx>
}

/** 注释中定义的配置信息，下面是基础中间件支持的 */
interface Config {
  /** 生成类型的 namespace */
  namespace: string
  /** 请求地址 */
  url: string
  /** 请求方法 */
  method?: string
  /** 直接传入 JSON 进行解析, 配置 json 后不再请求 url */
  json?: string
  /**
   * 请求时通过 chrome-cookies-secure 获取 chrome cookie
   * 其原理是读取 chrome 存在磁盘中的 cookie 数据，第一次调用时可能需要系统授权（Mac）
   */
  cookie?: boolean
  /** 中间件自行增加，解析格式「@key value」 */
  [key: string]: any
}

/** 展示文档内容 */
interface ShowDocFn {
  /**
 * @param id 唯一 ID
 * @param content 文档中需要显示的内容
 * @param languageId 文档的语言，默认 typescript，首次打开时生效
 * @returns Promise
 */
  (id: string, content: string, languageId?: string): Promise<void>
}

/** diff 算法，具体参考 https://github.com/lei4519/rust-myers-diff */
interface DiffFn {
  /**
  * @param {ParamsType} params
  * @returns {DiffResult}
  */
  (params: ParamsType): DiffResult
}

interface ParamsType {
  /** 旧文本的字符串数组，可以按照需求进行切割（按字符、按行、按段） */
  old_arr: string[];
  /** 新文本的字符串数组 */
  new_arr: string[];
}

/**
 * 0: diff 动作 - 相等、新增、删除
 *
 * 1: 在数组中的开始索引 (新增时为新文本数组索引，反之为旧文本数组索引)
 *
 * 2: 在数组中的结束索引
 */
type DiffResult = Array<["EQ" | "ADD" | "RM", number, number]>

/**
 * chrome-cookies-secure 类型声明
 * https://github.com/bertrandom/chrome-cookies-secure
 */
declare namespace ChromeCookiesSecure {}
```
