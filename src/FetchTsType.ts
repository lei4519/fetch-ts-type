import { Position, Range, TextEditor } from "vscode";
import { TextDocumentContentProvider } from "./TextDocumentContentProvider";
import { diff } from '../lib/rust-myers-diff/pkg/rust_myers_diff'
import { BasePlugin } from "./BasePlugin";

export interface Config {
	/** 生成类型的 namespace */
	namespace: string
	/** 请求地址 */
	url: string
	/** 请求方法 */
	method?: string
	/** 直接传入 JSON 进行解析 */
	json?: string
	/** 插件自行增加，解析格式「@key value」 */
	[key: string]: any
}

interface Arg {
	/** 注释中的配置项 */
	config: Config
	/** 注释块的闭合行号 */
	endLineNumber: number
	/** 点击「生成类型」的编辑器实例 */
	editor: TextEditor
}

export interface Plugin {
	/** 主入口：生成类型字符串 */
	generate(config: Config): string | null | Promise<string | null>
	/**
	 * 当文档中已生成过代码时，生成 diff 代码
	 * @param existCode 文档中已存在的代码
	 * @param newCode 调用 generate 新生成的代码
	 * @param myers myers diff 算法 https://github.com/lei4519/rust-myers-diff
	 */
	generateDiffCode?: (existCode: string, newCode: string, myers: typeof diff) => string | null
	/** 卸载时的钩子函数 */
	dispose(): any
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
	/** 展示文档内容 */
	showDoc: TextDocumentContentProvider['showDoc']
	plugin: Plugin

	constructor(showDoc: TextDocumentContentProvider['showDoc']) {
		this.showDoc = showDoc
		this.plugin = new BasePlugin(showDoc)
	}
	/** 入口 */
	async run(arg: Arg) {
		const code = await this.plugin.generate(arg.config)
		if (!code) { return }
		const existCodeRecode = this.matchCodeExist(arg)
		if (existCodeRecode) {
			this.replaceExistCode(arg, existCodeRecode, code)
		} else {
			this.insertCode(arg, code)
		}
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
	private replaceExistCode({ editor }: Arg, { code: oldCode, start, end }: ExistCodeRecord, newCode: string) {
		editor.edit(eb => {
			let diffCode = newCode
			if (typeof this.plugin.generateDiffCode === 'function') {
				const dc = this.plugin.generateDiffCode(oldCode, newCode, diff)
				if (dc === null) { return }
				diffCode = dc
			}
			const startPos = editor.document.positionAt(start)
			const endPos = editor.document.positionAt(end)
			eb.replace(new Range(startPos, endPos), diffCode)
		})
	}

	dispose() {
		this.plugin.dispose()
	}
}