// Port of Platform editor/packages/editor/src/shiki/scopePath.ts
// platform-commit: 7f0dfc9e29fa9e3ee90c981147f77f6fcb656481
// platform-blob-sha256: 96b4618ed8a5212b2eedd57bfb406473e949f0fbd8d4dbe6788cdf2c83972585
// Changes: constructor parameter properties are spelled as fields (type stripping cannot erase them).
import type { Theme } from 'shiki/textmate'

type TextmateScopePath = NonNullable<Parameters<Theme['match']>[0]>

/** Structural implementation of TextMate's scope path, whose constructor is not exported. */
export class ScopePath implements TextmateScopePath {
  readonly parent: TextmateScopePath | null
  readonly scopeName: string

  constructor(parent: TextmateScopePath | null, scopeName: string) {
    this.parent = parent
    this.scopeName = scopeName
  }

  push(scopeName: string): ScopePath {
    return new ScopePath(this, scopeName)
  }

  getSegments(): string[] {
    const names = [this.scopeName]
    for (let path = this.parent; path; path = path.parent) names.push(path.scopeName)
    return names.reverse()
  }

  toString(): string {
    return this.getSegments().join(' ')
  }

  extends(other: TextmateScopePath): boolean {
    return this.getExtensionIfDefined(other) !== undefined
  }

  getExtensionIfDefined(base: TextmateScopePath | null): string[] | undefined {
    const names = this.getSegments()
    const prefix = base?.getSegments() ?? []
    if (prefix.length > names.length) return undefined
    if (prefix.some((name, index) => names[index] !== name)) return undefined
    return names.slice(prefix.length)
  }
}
