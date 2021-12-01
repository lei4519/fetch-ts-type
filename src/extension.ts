import {
  ExtensionContext,
  languages,
  commands,
  workspace,
  window,
} from 'vscode'
import { CodelensProvider } from './CodelensProvider'
import { FetchTsType } from './FetchTsType'
import { TextDocumentContentProvider } from './TextDocumentContentProvider'

export const ns = 'fetch-ts-type'

export const ACTION = {
  errTips: `${ns}.errTips`,
  genCode: `${ns}.genCode`,
}

export function activate({ subscriptions }: ExtensionContext) {
  subscriptions.push(
    languages.registerCodeLensProvider(
      [{ language: 'typescript' }, { language: 'typescriptreact' }],
      new CodelensProvider()
    )
  )

  subscriptions.push(
    commands.registerCommand(ACTION.errTips, (args: any) => {
      window.showErrorMessage(args)
    })
  )

  const TDCP = new TextDocumentContentProvider()

  const FTT = new FetchTsType(TDCP.showDoc.bind(TDCP))

  subscriptions.push(TDCP)
  subscriptions.push(FTT)

  subscriptions.push(
    commands.registerCommand(ACTION.genCode, (arg: any) => {
      const editor = window.activeTextEditor!
      FTT.run({ ...arg, editor })
    })
  )

  subscriptions.push(
    workspace.registerTextDocumentContentProvider(TDCP.scheme, TDCP)
  )
}

