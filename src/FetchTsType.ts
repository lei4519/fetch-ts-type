import { ExtensionContext, Position, ProgressLocation, Range, TextEditor, window, workspace } from "vscode";
import axios from 'axios'
import { TextDocumentContentProvider } from "./TextDocumentContentProvider";
import { diff } from '../lib/rust-myers-diff/pkg/rust_myers_diff'
// @ts-ignore
import * as chrome from '../lib/chrome-cookies-secure'

interface CacheMw {
	/** 请求到的代码 */
	code: string
	/** 下载的时间 */
	downloadTime: number
	/** 到期时间 */
	expireTime: number
}

const isFunction = (v: any) => typeof v === 'function'

const chromeCookiesSecure: ChromeCookiesSecure.Default = {
	getCookies(...args: any) {
		// @ts-ignore
		chrome.getCookies(...args)
	},
	getCookiesPromised: (...args) => new Promise((resolve, reject) => {
		const [url, format, profile] = args

		// @ts-ignore
		chrome.getCookies(url, format || 'object', (err, data) => {
			err ? reject(err) : resolve(data)
		}, profile)
	})
}

interface Arg {
	/** 注释中的配置项 */
	config: Config
	/** 注释块的闭合行号 */
	endLineNumber: number
	/** 点击「生成类型」的编辑器实例 */
	editor: TextEditor
}

interface ExistCodeRecord {
	/** 已存在代码的开始行号 */
	start: number
	/** 结束行号 */
	end: number
	/** 已存在的代码  */
	code: string
}

export class FetchTsType {
	globalState: ExtensionContext['globalState']
	/** 展示文档内容 */
	showDoc: TextDocumentContentProvider['showDoc']
	/** 正在加载中间件 */
	loadingMwsPromise: Promise<any> | null = null
	/** 中间件集 */
	mws: MW[] = []
	/** loading 集 */
	openLoadings = new Set<Function>()


	constructor(showDoc: TextDocumentContentProvider['showDoc'], globalState: ExtensionContext['globalState']) {
		this.showDoc = showDoc
		this.globalState = globalState
		this.load()
	}

	private openLoading(tips: string) {
		let resolve: Function
		const promise = new Promise((r) => {
			resolve = r
		})
		window.withProgress(
			{
				location: ProgressLocation.Window,
				title: tips,
			},
			() => promise
		)
		this.openLoadings.add(resolve!)
		return () => {
			this.openLoadings.delete(resolve!)
			resolve()
		}
	}

	async load(ignoreCache = false) {
		if (this.loadingMwsPromise) {
			// 中间件正在加载
			return
		} else {
			this.loadingMwsPromise =
				this.lodaMws(ignoreCache).then((mws) => {
					this.mws = mws
					this.loadingMwsPromise = null
				})
		}
	}

	private async lodaMws(ignoreCache: boolean) {
		this.dispose()

		const close = this.openLoading('加载中间件...')

		const config = workspace.getConfiguration("FetchTsType")

		const mwsUrl = [...config.get<string[]>('mws', [])]
		const mws: MW[] = []

		while (mwsUrl.length) {
			const mwURL = mwsUrl.shift()!

			if (!ignoreCache) {
				const cache = this.globalState.get<CacheMw>(mwURL)

				if (cache) {
					if (cache.expireTime >= Date.now()) {
						const { code } = cache
						const MW = this.genCtor(code)
						const mw: MW = new MW()
						this.inject(mw)
						mws.push(mw)
						continue
					} else {
						this.globalState.update(mwURL, undefined)
					}
				}
			}

			try {
				const { searchParams } = new URL(mwURL)

				let Cookie = ''

				if (searchParams.get('cookie') === '1') {
					Cookie = await chromeCookiesSecure.getCookiesPromised(mwURL, 'header')
				}

				const { data } = await axios.get(mwURL, {
					headers: {
						Cookie,
						'User-Agent': 'VSCode Ext: FetchTsType/fetch-mw'
					}
				})

				const code = `return function run(module, exports, require) {${data}}`

				const MW = this.genCtor(code)

				try {
					const mw: MW = new MW()

					const methods = ['generate', 'generateDiffCode', 'dispose'] as (keyof MW)[]

					if (methods.every(m => isFunction(mw[m]))) {
						this.inject(mw)
						mws.push(mw)

						const downloadTime = Date.now()
						const expireTime = downloadTime + (mw.cacheTime || 1000 * 60 * 60 * 24 * 7)
						this.globalState.update(mwURL, {
							code,
							downloadTime,
							expireTime
						} as CacheMw)
					} else {
						throw new Error("中间件必须实现 MW 接口")
					}
				} catch {
					throw new Error('中间件必须通过 module.exports 直接导出，必须实现 MW 接口')
				}
			} catch (e) {
				this.showDoc(mwURL, `${mwURL} \n 中间件加载失败：\n\t ${e}`)
			}
		}

		if (ignoreCache) {
			window.showInformationMessage("中间件重新加载成功")
		}
		close()
		return mws
	}

	genCtor(code: string) {
		const m = {
			exports: null as any
		}

		new Function(code)()(m, m.exports, require)

		return m.exports
	}

	private inject(mw: MW) {
		mw.chromeCookiesSecure = chromeCookiesSecure
		mw.showDoc = this.showDoc
		mw.openLoading = this.openLoading.bind(this)
		mw.outputChannel = window.createOutputChannel(mw.mwName || 'FTT-untitle-mw')
	}

	/** 入口 */
	async run(arg: Arg) {
		if (this.loadingMwsPromise) {
			window.showWarningMessage("中间件加载中...")
			await this.loadingMwsPromise
			window.showInformationMessage("中间件加载完成")
		}

		if (this.mws.length === 0) {
			window.showErrorMessage("没有配置中间件，无法生成类型")
			return
		}

		const ctx: Ctx = {
			config: arg.config,
			existCode: null,
			newCode: null,
			diffFn: diff,
			diffCode: null
		}

		let newCode: string | null = null

		let closeLoading = this.openLoading('生成类型中...')
		try {
			newCode = (await this.genNext('generate', ctx)()).newCode
		} catch (e) {
			this.showDoc(arg.config.url, `${e}`)
		}
		closeLoading()

		if (!newCode) { return }

		const existCodeRecode = this.matchCodeExist(arg)

		if (existCodeRecode) {
			closeLoading = this.openLoading('diff 类型中...')
			try {
				ctx.existCode = existCodeRecode.code
				await this.genNext('generateDiffCode', ctx)()
			} catch (e) {
				this.showDoc(arg.config.url, `${e}`)
			}
			closeLoading()
		}

		if (existCodeRecode && (ctx.diffCode || ctx.newCode)) {
			this.replaceExistCode(arg, existCodeRecode.start, existCodeRecode.end, (ctx.diffCode || ctx.newCode)!)
		} else {
			ctx.newCode && this.insertCode(arg, ctx.newCode)
		}
	}

	private genNext(method: keyof Pick<MW, 'generate' | 'generateDiffCode'>, ctx: Ctx) {
		let i = this.mws.length - 1
		const next = () => {
			if (i < 0) {
				return Promise.resolve(ctx)
			}
			return this.mws[i--][method](ctx, next)
		}
		return next
	}

	/** 是否已生成过代码，若是：生成已存在的代码信息 */
	private matchCodeExist(arg: Arg): ExistCodeRecord | null {
		const {
			config: { namespace },
			editor,
		} = arg
		const reg = new RegExp(`(?:export\\s*)*namespace\\s+${namespace}\\s*{`)
		const docText = editor.document.getText()

		const exist = reg.exec(docText)

		if (exist) {
			const nsLength = exist.index + exist[0].length
			const content = docText.substring(nsLength)
			const pair = /{|}/g
			let match,
				i = 1
			while ((match = pair.exec(content)) !== null) {
				match[0] === '{' ? i++ : i--
				if (i === 0) {
					const start = exist.index
					const end = match.index + nsLength + 1
					return {
						start,
						end,
						code: docText.substring(start, end),
					}
				}
			}
		}

		return null
	}

	/** 向文档中插入代码 */
	private insertCode({ editor, endLineNumber }: Arg, code: string) {
		editor.edit(eb => {
			eb.insert(
				new Position(endLineNumber + 1, 0),
				code
			)
		})
	}

	/** 替换文档中已存在的代码 */
	private replaceExistCode({ editor }: Arg, start: number, end: number, diffCode: string) {
		editor.edit(eb => {
			const startPos = editor.document.positionAt(start)
			const endPos = editor.document.positionAt(end)
			eb.replace(new Range(startPos, endPos), diffCode)
		})
	}

	dispose() {
		this.mws.forEach(mw => {
			mw.outputChannel.dispose()
			mw.dispose()
		})
		this.mws = []
		this.openLoadings.forEach(close => close())
		this.openLoadings.clear()
	}
}