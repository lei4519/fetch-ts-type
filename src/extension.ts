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

export const ns = 'FetchTsType'

export const ACTION = {
  errTips: `${ns}.errTips`,
  genCode: `${ns}.genCode`,
  reloadMWS: `${ns}.reloadMWS`
}

export function activate({ subscriptions, globalState }: ExtensionContext) {
  const TDCP = new TextDocumentContentProvider()

  let FTT: null | FetchTsType = null

  /** lazy load */
  const getFTT = () => {
    if (FTT === null) {
      FTT = new FetchTsType(TDCP.showDoc.bind(TDCP), globalState)
      subscriptions.push(FTT)
    }
    return FTT
  }

  subscriptions.push(TDCP)

  subscriptions.push(
    commands.registerCommand(ACTION.reloadMWS, () => {
      getFTT().load(true)
    })
  )

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

  subscriptions.push(
    commands.registerCommand(ACTION.genCode, (arg: any) => {
      const editor = window.activeTextEditor!
      getFTT().run({ ...arg, editor })
    })
  )

  subscriptions.push(
    workspace.registerTextDocumentContentProvider(TDCP.scheme, TDCP)
  )
}

