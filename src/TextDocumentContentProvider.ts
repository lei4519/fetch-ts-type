import axios, { AxiosResponse } from 'axios'
import JsonToTS from 'json-to-ts'
import { myers } from './lib'
import { AbortController } from 'node-abort-controller'
import { camelizeKeys } from 'humps'
import {
  Uri,
  workspace,
  window,
  ViewColumn,
  languages,
  EventEmitter,
  TextDocumentContentProvider as VsCodeTextDocumentContentProvider,
  TextEditor,
  Position,
  Range,
} from 'vscode'

export interface Config {
  namespace: string
  url: string
  path?: string
}

interface RequestRecord {
  status: RequestStatus
  config: Config
  editor: TextEditor
  commentBlockEndLineNumber: number
  response?: any
  transferErrMsg?: any
  typeString?: string
}

interface RequestRecordMap {
  [key: string]: RequestRecord
}

enum RequestStatus {
  penging,
  resolve,
  reject,
  transferErr,
}

interface Arg {
  config: Config
  endLineNumber: number
  showDoc: boolean
  editor: TextEditor
}

export class TextDocumentContentProvider
  implements VsCodeTextDocumentContentProvider {
  scheme = 'fetchTsTypePreview'

  onDidChangeEmitter = new EventEmitter<Uri>()
  onDidChange = this.onDidChangeEmitter.event

  // 请求取消
  controller = new AbortController()

  // 记录每个请求的信息
  requestRecord: RequestRecordMap = {}

  // 记录正在打开的页面
  openingUri: Record<string, boolean> = {}

  // 入口
  async generate(arg: Arg) {
    const { config, showDoc } = arg

    this.fetch(arg)

    showDoc && this.showDoc(config.url)
  }

  // 发送请求
  private async fetch(arg: Arg) {
    const { config } = arg
    const key = this.getURI(config.url).toString()

    const record = this.recordRequest(key, arg)

    return axios
      .get(config.url, { signal: this.controller.signal })
      .then(res => {
        this.recordResolve(record, res)
      })
      .catch(err => {
        this.recordReject(record, err)
      })
  }

  // 记录请求
  private recordRequest(key: string, arg: Arg) {
    const { config, editor, endLineNumber } = arg
    return (this.requestRecord[key] = {
      config,
      editor,
      commentBlockEndLineNumber: endLineNumber,
      status: RequestStatus.penging,
    })
  }

  // 请求成功
  private recordResolve(record: RequestRecord, res: AxiosResponse) {
    record.response = res
    const success = this.toType(record, res.data)

    this.refresh(this.getURI(record.config.url))

    if (success) {
      this.insertCode(record)
    }
  }

  // 请求失败
  private recordReject(record: RequestRecord, err: any) {
    if (err.message === 'canceled') {
      return
    }
    record.status = RequestStatus.reject
    record.response = err

    this.showDoc(record.config.url)

    this.refresh(this.getURI(record.config.url))
  }

  // 获取 uri
  private getURI(url: string) {
    return Uri.parse(`${this.scheme}:${url}`)
  }

  // 转换为 TS 类型
  private toType(record: RequestRecord, data: any) {
    try {
      record.typeString = this.code(record, data)
      record.status = RequestStatus.resolve
      return true
    } catch (err) {
      record.transferErrMsg = err
      record.status = RequestStatus.transferErr
      this.showDoc(record.config.url)
      return false
    }
  }

  // 处理生成的代码
  private code(record: RequestRecord, data: any) {
    data = camelizeKeys(data)
    let type = JsonToTS(data)
      .join('\nexport ')
      .replace(/\n|;/gms, match => {
        if (match === '\n') {
          return '\n\t'
        } else {
          return ''
        }
      })

    return `
export namespace ${record.config.namespace} {\n\texport ${type}\n}
`
  }

  // 刷新页面
  private refresh(uri: Uri) {
    this.onDidChangeEmitter.fire(uri)
  }

  // 向文档中插入代码
  private async insertCode(record: RequestRecord) {
    const { typeString, editor } = record
    if (!typeString) {
      return
    }

    const existCodeRecord = this.codeExist(record)
    if (existCodeRecord) {
      editor.edit(eb => {
        const startPos = editor.document.positionAt(existCodeRecord.start)
        const endPos = editor.document.positionAt(existCodeRecord.end)
        eb.replace(new Range(startPos, endPos), this.diffCode(existCodeRecord.code, typeString))
      })
    } else {
      editor.edit(eb => {
        eb.insert(
          new Position(record.commentBlockEndLineNumber + 1, 0),
          typeString
        )
      })
    }
  }

  // diff code
  private diffCode(oldCodeText: string, newCodeText: string) {
    const oldCodeArr = oldCodeText.trim().split(/(\n|\r\n)/)
    const newCodeArr = newCodeText.trim().split(/(\n|\r\n)/)

    const [oldDiffArr, oldMap] = this.wipeEmptyLineAndGenIndexMap(this.wipeNotNeedDiffChars(oldCodeArr))
    const [newDiffArr, newMap] = this.wipeEmptyLineAndGenIndexMap(this.wipeNotNeedDiffChars(newCodeArr))

    const diffCodeArr = myers(oldDiffArr, newDiffArr)

    if (diffCodeArr.length === 1) {
      const [action] = diffCodeArr[0]
      if (action === 'EQ') {
        return oldCodeText
      } else {
        // 全部新增、全部删除
        return newCodeText.trim()
      }
    }

    // 获取原始的字符串
    const getOrgValue = (arr: string[], map: Record<number, number>, start: number, end: number) => {
      // 第一个从 0 开始
      const realStart = start === 0 ? 0 : map[start]
      // 最后一个选最后
      const realEnd = map[end + 1] ? map[end] : arr.length - 1

      // 拼接不需要 diff 的字符
      let ignoreValue = ''
      // 说明中间有忽略的字符行
      if (start !== 0 && realStart - map[start - 1] > 0) {
        ignoreValue = arr.slice(map[start - 1] + 1, realStart).join('')
      }

      return [ignoreValue, arr.slice(realStart, realEnd + 1).join('')] as [string, string]
    }

    return diffCodeArr.reduce((txt, [action, _, start, end], i) => {
      // 默认取原文本
      let [ignore, value] = getOrgValue(oldCodeArr, oldMap, start, end)
      value = ignore + value
      if (action === 'ADD') {
        // 新增取新文本
        ;[ignore, value] = getOrgValue(newCodeArr, newMap, start, end)
      } else if (action === 'RM') {
        const next = diffCodeArr[i + 1]
        // 删除跟着添加，说明是修改，加 diff
        if (next && next[0] === 'ADD') {
          const [ignoreOldValue, oldValue] = getOrgValue(oldCodeArr, oldMap, start, end)
          const [, newValue] = getOrgValue(newCodeArr, newMap, start, end)
          value = `${ignoreOldValue}<<<<<<<\n${oldValue}\n=======\n${newValue}\n>>>>>>>`
          for (let i = start; i <= end; i++) {
            newCodeArr[newMap[i]] = ''
          }
        } else {
          // 说明是本地添加的，不改动
        }
      }
      return txt + value
    }, '')
  }

  // 去除不需要 diff 的字符
  private wipeNotNeedDiffChars(arr: string[]) {
    // 没有关闭的块级注释标识
    let notCloseBlockComment = false

    const wipe = (line: string) => {
      const blockCommentBegin = '/*'
      const blockCommentEnd = '*/'

      if (notCloseBlockComment) {
        /**
         * 块级注释没有关闭，当前行也没有关闭，替换为空
         * @example
         * /*
         *  123 <-- this
         */
        if (line.indexOf(blockCommentEnd) === -1) {
          return ''
        }
        notCloseBlockComment = false
        // 关闭文本后面可能还有正常字符，清除注释文本，交给后续处理
        line = line.replace(/.*?\*\//g, '')
      }

      const i = line.indexOf(blockCommentBegin)
      // 有块级注释开始文本，替换注释为空，交给后续处理
      if (i !== -1) {
        // 块级注释没有同行结束
        if (line.substring(i + blockCommentBegin.length).indexOf(blockCommentEnd) === -1) {
          notCloseBlockComment = true
          line = line.replace(/\/\*.*/g, '')
        } else {
          line = line.replace(/\/\*.*?\*\//g, '')
        }
      }

      // 去除空字符、分号、单行注释
      return line.replace(/\s|;|(\/\/.*)/g, '')
    }

    return arr.map(wipe)
  }

  // 去除空行，建立与原始数组的索引映射
  private wipeEmptyLineAndGenIndexMap(arr: string[]) {
    // [没有空行的数组，{ 去除空行的索引：原始数组的索引 }]
    return arr.reduce(([emptyArr, map], line, orgIndex) => {
      if (line !== '') {
        emptyArr.push(line)
        map[emptyArr.length - 1] = orgIndex
      }
      return [emptyArr, map] as any
    }, [[], {}] as [string[], Record<number, number>])
  }

  // 文档中已有生成的代码
  private codeExist(record: RequestRecord) {
    const {
      config: { namespace },
      editor,
    } = record
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

  private async showDoc(url: string) {
    const ves = window.visibleTextEditors
    const uri = this.getURI(url)
    const key = uri.toString()

    // 页面正在打开中
    if (this.openingUri[key]) {
      return
    }

    if (ves.some(({ document: { uri: curi } }) => curi.toString() === key)) {
      // 页面之前已经打开了
      return
    }

    try {
      this.openingUri[key] = true

      let doc = await workspace.openTextDocument(uri)

      await window.showTextDocument(doc, {
        viewColumn: ViewColumn.Beside,
      })

      languages.setTextDocumentLanguage(doc, 'typescript')
    } finally {
      this.openingUri[key] = false
    }
  }

  provideTextDocumentContent(uri: Uri): string {
    const req = this.requestRecord[uri.toString()]

    if (!req) {
      return '未找到相关请求'
    }
    let response
    try {
      response = JSON.stringify({ ...req.response, request: null }, null, 2)
    } catch {
      response = req.response
    }

    if (req.status === RequestStatus.transferErr) {
      return `
/*|------------------------------|
| 转换失败                     |
|------------------------------|*/

${req.transferErrMsg}

/**********************************************/

const response = ${response}

/**********************************************/
        `
    }

    if (req.status === RequestStatus.penging) {
      return `
/*|------------------------------|
| 请求中...                     |
|------------------------------|*/
        `
    }

    if (req.status === RequestStatus.reject) {
      return `
/*|------------------------------|
| 请求失败                      |
|------------------------------|*/

/**********************************************/

const response = ${response}

/**********************************************/
        `
    }

    return `
/*|------------------------------|
| 请求成功                      |
|------------------------------|*/

/**********************************************/

${req.typeString}

/**********************************************/

const response = ${response}
        `
  }

  dispose() {
    this.controller.abort()
  }
}
