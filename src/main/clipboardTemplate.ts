export interface ClipboardTemplateContext {
  remotePath: string
  filename: string
  host: string
  username: string
  timestamp: number
}

const TOKEN_PATTERN = /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g

export function renderClipboardTemplate(
  template: string,
  context: ClipboardTemplateContext
): string {
  const values: Record<string, string> = {
    remotePath: context.remotePath,
    filename: context.filename,
    host: context.host,
    username: context.username,
    timestamp: new Date(context.timestamp).toISOString()
  }

  return template.replace(TOKEN_PATTERN, (token, key: string) => {
    return key in values ? values[key] : token
  })
}
