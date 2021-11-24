import {
  ExtensionContext,
  languages,
  commands,
  workspace,
  window,
  ProgressLocation,
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

  subscriptions.push(
    commands.registerCommand('extension.startTask', () => {
      window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: 'I am long running!',
          cancellable: true,
        },
        (progress, token) => {
          token.onCancellationRequested(() => {
            console.log('User canceled the long running operation')
          })

          progress.report({ increment: 0 })

          setTimeout(() => {
            progress.report({
              increment: 10,
              message: 'I am long running! - still going...',
            })
          }, 1000)

          setTimeout(() => {
            progress.report({
              increment: 40,
              message: 'I am long running! - still going even more...',
            })
          }, 2000)

          setTimeout(() => {
            progress.report({
              increment: 50,
              message: 'I am long running! - almost there...',
            })
          }, 3000)

          const p = new Promise<void>(resolve => {
            setTimeout(() => {
              resolve()
            }, 5000)
          })

          return p
        }
      )
    })
  )
}
