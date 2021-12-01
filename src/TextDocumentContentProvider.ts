import {
  Uri,
  workspace,
  window,
  ViewColumn,
  languages,
  EventEmitter,
  TextDocumentContentProvider as VsCodeTextDocumentContentProvider,
} from 'vscode'

export class TextDocumentContentProvider
  implements VsCodeTextDocumentContentProvider {
  scheme = 'fetchTsTypePreview'

  // 文档中需要显示的内容
  private documentContentMap = {} as Record<string, { content: string, languageId: string }>

  onDidChangeEmitter = new EventEmitter<Uri>()
  onDidChange = this.onDidChangeEmitter.event

  /**
   * 记录正在打开的页面
   * 1: 表示正在加载中
   * 2: 表示加载中进行了修改，加载完成后需要刷新页面
   */
  private openingUri: Record<string, 1 | 2> = {}

  /**
   * 展示文档内容
   * @param id 唯一 ID
   * @param content 文档中需要显示的内容
   * @param languageId 文档的语言，默认 typescript，首次打开时生效
   * @returns Promise
   */
  async showDoc(id: string, content: string, languageId: string = "typescript") {
    const ves = window.visibleTextEditors
    const uri = this.resolveURI(id)
    const key = uri.toString()

    this.setDocumentContent(key, content, languageId)

    // 页面正在打开中
    if (this.openingUri[key]) {
      this.openingUri[key] = 2
      return
    }

    if (ves.some(({ document: { uri: curi } }) => curi.toString() === key)) {
      // 页面之前已经打开了
      this.refresh(uri)
      return
    }

    try {
      this.openingUri[key] = 1

      let doc = await workspace.openTextDocument(uri)

      await window.showTextDocument(doc, {
        viewColumn: ViewColumn.Beside,
      })

      languages.setTextDocumentLanguage(doc, languageId)
    } finally {
      if (this.openingUri[key] === 2) {
        this.refresh(uri)
      }
      Reflect.deleteProperty(this.openingUri, key)
    }
  }

  // 获取 uri
  private resolveURI(id: string) {
    return Uri.parse(`${this.scheme}:${id}`)
  }

  private setDocumentContent(id: string, content: string, languageId: string) {
    this.documentContentMap[id] = { content, languageId }
  }

  /** 触发 provideTextDocumentContent 执行 */
  private refresh(uri: Uri) {
    this.onDidChangeEmitter.fire(uri)
  }

  /** 向 vscode 注入文档内容 */
  provideTextDocumentContent(uri: Uri) {
    return this.documentContentMap[uri.toString()].content
  }

  dispose() { }
}
