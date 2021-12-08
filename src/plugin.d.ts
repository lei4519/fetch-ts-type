/**
 * 中间件是运行时加载的 js 文件，通过 new Function(module = {}, exports = module.exports) 获取导出的类
 * 这意味着只能 require node 原生模块，所以必须将代码打包进一个文件中，借助 rollup 你可以轻易完成此操作。
 * 从这个仓库中可以获取到一份基础的模板: https://github.com/lei4519/FTT-base-mw
 *
 * 以下为中间件开发的具体说明
 */


/**
 * 中间件以类的形式存在，必须实现这个接口
 * @example
 * class implements MW { }
 */
interface MW {
	/**
	 * 当前中间件的名字，用于错误提示时展示分辨
	 */
	mwName: string
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
	 * 在状态栏中展示 loading，返回 closeLoading 函数
	 * tips 为 loading 的文字提示
	 */
	openLoading: (tips: string) => Function
	/**
	 * vscode 输出面板
	 * https://code.visualstudio.com/api/references/vscode-api#OutputChannel
	 */
	outputChannel: OutputChannel
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
declare namespace ChromeCookiesSecure {
	interface Result {
		curl: string
		jar: Object
		'set-cookie': string[]
		header: string
		puppeteer: Object[]
		object: Object
	}

	type Callback<T> = (err: Error, data: T) => void

	function getCookies<T extends keyof Result>(url: string, format: T, callback: Callback<Result[T]>, profile?: any): void
	function getCookies(url: string, callback: Callback<Result['object']>, profile?: any): void

	function getCookiesPromised<T extends keyof Result>(url: string, format: T, profile?: any): Promise<Result[T]>

	export interface Default {
		getCookies: typeof getCookies
		getCookiesPromised: typeof getCookiesPromised
	}
}

declare module 'chrome-cookies-secure' {
	const chrome: ChromeCookiesSecure.Default
	export default chrome
}

interface OutputChannel {

	/**
	 * The human-readable name of this output channel.
	 */
	readonly name: string;

	/**
	 * Append the given value to the channel.
	 *
	 * @param value A string, falsy values will not be printed.
	 */
	append(value: string): void;

	/**
	 * Append the given value and a line feed character
	 * to the channel.
	 *
	 * @param value A string, falsy values will be printed.
	 */
	appendLine(value: string): void;

	/**
	 * Removes all output from the channel.
	 */
	clear(): void;

	/**
	 * Reveal this channel in the UI.
	 *
	 * @param preserveFocus When `true` the channel will not take focus.
	 */
	show(preserveFocus?: boolean): void;

	/**
	 * Reveal this channel in the UI.
	 *
	 * @deprecated Use the overload with just one parameter (`show(preserveFocus?: boolean): void`).
	 *
	 * @param column This argument is **deprecated** and will be ignored.
	 * @param preserveFocus When `true` the channel will not take focus.
	 */
	show(column?: ViewColumn, preserveFocus?: boolean): void;

	/**
	 * Hide this channel from the UI.
	 */
	hide(): void;

	/**
	 * Dispose and free associated resources.
	 */
	dispose(): void;
}

declare enum ViewColumn {
	/**
	 * A *symbolic* editor column representing the currently active column. This value
	 * can be used when opening editors, but the *resolved* {@link TextEditor.viewColumn viewColumn}-value
	 * of editors will always be `One`, `Two`, `Three`,... or `undefined` but never `Active`.
	 */
	Active = -1,
	/**
	 * A *symbolic* editor column representing the column to the side of the active one. This value
	 * can be used when opening editors, but the *resolved* {@link TextEditor.viewColumn viewColumn}-value
	 * of editors will always be `One`, `Two`, `Three`,... or `undefined` but never `Beside`.
	 */
	Beside = -2,
	/**
	 * The first editor column.
	 */
	One = 1,
	/**
	 * The second editor column.
	 */
	Two = 2,
	/**
	 * The third editor column.
	 */
	Three = 3,
	/**
	 * The fourth editor column.
	 */
	Four = 4,
	/**
	 * The fifth editor column.
	 */
	Five = 5,
	/**
	 * The sixth editor column.
	 */
	Six = 6,
	/**
	 * The seventh editor column.
	 */
	Seven = 7,
	/**
	 * The eighth editor column.
	 */
	Eight = 8,
	/**
	 * The ninth editor column.
	 */
	Nine = 9
}