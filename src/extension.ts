import {
  ExtensionContext,
  languages,
  commands,
  workspace,
  window,
} from 'vscode'
import { CodelensProvider } from './CodelensProvider'
import { TextDocumentContentProvider } from './TextDocumentContentProvider'
export const ns = 'fetch-ts-type'

export const action = {
  errTips: `${ns}.errTips`,
  preview: `${ns}.preview`,
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
    commands.registerCommand(action.errTips, (args: any) => {
      window.showErrorMessage(args)
    })
  )

  const provider = new TextDocumentContentProvider()

  subscriptions.push(provider)

  subscriptions.push(
    commands.registerCommand(action.genCode, (arg: any) => {
      const editor = window.activeTextEditor!
      provider.generate({ ...arg, editor })
    })
  )

  subscriptions.push(
    workspace.registerTextDocumentContentProvider(provider.scheme, provider)
  )
}

