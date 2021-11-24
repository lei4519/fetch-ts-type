import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  Position,
  Range,
  TextDocument,
} from 'vscode'
import { action } from './extension'
import { Config } from './TextDocumentContentProvider'

/**
 * CodelensProvider
 */
export class CodelensProvider implements CodeLensProvider {
  private codeLenses: CodeLens[] = []

  // 匹配注释块
  private matchBlock = /\/\*\*\sfetchTsComment\n(.*?)\*\//gms
  // 匹配配置项
  private matchConfig = /@(?<name>[^\s]+)(?<value>[^@]*)/gms

  private resolveConfig(text: string) {
    const matchConfig = new RegExp(this.matchConfig)
    return [...text.matchAll(matchConfig)].reduce((res, t) => {
      res[t.groups!.name] = t.groups!.value.trim()
      return res
    }, {} as any) as Config
  }

  public provideCodeLenses(
    document: TextDocument,
    token: CancellationToken
  ): CodeLens[] | Thenable<CodeLens[]> {
    this.codeLenses = []
    const text = document.getText()
    const regex = new RegExp(this.matchBlock)
    let matches
    while ((matches = regex.exec(text)) !== null) {
      const startLineNumber = document.positionAt(matches.index).line
      const endLineNumber = document.positionAt(
        matches.index + matches[0].length
      ).line

      const startPos = new Position(startLineNumber, 0)
      const endPos = new Position(endLineNumber, 0)
      const range = new Range(startPos, endPos)

      const config = this.resolveConfig(matches[1].replace(/\n\s*\*/gms, ''))

      if (!config.url?.trim()) {
        this.codeLenses.push(
          new CodeLens(range, {
            title: '请配置 url',
            command: action.errTips,
            arguments: ['请配置 url'],
          })
        )
      } else if (!config.namespace?.trim()) {
        this.codeLenses.push(
          new CodeLens(range, {
            title: '请配置 namespace',
            command: action.errTips,
            arguments: ['请配置 namespace'],
          })
        )
      } else {
        this.codeLenses.push(
          new CodeLens(range, {
            title: '生成类型',
            command: action.genCode,
            arguments: [{ config, endLineNumber, showDoc: false }],
          })
        )
        // this.codeLenses.push(
        //   new CodeLens(range, {
        //     title: '预览',
        //     command: action.genCode,
        //     arguments: [{ config, endLineNumber, showDoc: true }],
        //   })
        // )
      }
    }
    return this.codeLenses
  }

  public resolveCodeLens(codeLens: CodeLens, token: CancellationToken) {
    console.log('resolveCodeLens')
    return codeLens
  }
}
