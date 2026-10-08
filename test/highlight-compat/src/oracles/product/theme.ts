// Port of Platform editor/packages/highlighting/src/theme.ts
// platform-commit: 7f0dfc9e29fa9e3ee90c981147f77f6fcb656481
// platform-blob-sha256: ee273440111735563d67e7adc5d04a6c92f5adccfe0837802a4c43aa6e6bc992
// Changes: only the VS Code theme path (workerThemeRegistration, copyThemeSetting, definedColors);
// the Editor palette conversion and revision naming are left out, since neither changes a colour;
// Singapore's registration types are Shiki's ThemeRegistration.
import type { ThemeRegistration } from 'shiki/core'

type VscodeThemeRegistration = ThemeRegistration
type ShikiWorkerThemeRegistration = ThemeRegistration

/** A registration Shiki may normalize in place: owned arrays, no undefined colors. */
export function workerThemeRegistration(
  registration: VscodeThemeRegistration,
  name = registration.name,
): ShikiWorkerThemeRegistration {
  if (!name) throw new Error('Highlight themes require a name')

  return {
    ...registration,
    name,
    colors: definedColors(registration.colors),
    settings: registration.settings?.map(copyThemeSetting),
    tokenColors: registration.tokenColors?.map(copyThemeSetting),
  } as ShikiWorkerThemeRegistration
}

type ThemeSetting = NonNullable<VscodeThemeRegistration['tokenColors']>[number]

function copyThemeSetting(setting: ThemeSetting) {
  return {
    ...setting,
    scope: typeof setting.scope === 'string' ? setting.scope : setting.scope?.slice(),
    settings: { ...setting.settings },
  }
}

function definedColors(source: VscodeThemeRegistration['colors']): Record<string, string> {
  const colors: Record<string, string> = {}
  for (const [name, color] of Object.entries(source ?? {})) {
    if (color === undefined) continue
    colors[name] = color
  }
  return colors
}
