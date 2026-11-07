import type { FontStyle } from '../schema.ts';
import type { EffectiveStyle, Profile } from './theme-contract.ts';

export interface NamedEffectiveStyle {
  readonly foreground: string; readonly background: string; readonly fontMask: number; readonly fontStyle: FontStyle | 'reset';
}
export type AppliedStyle = NamedEffectiveStyle | Omit<NamedEffectiveStyle,'background'>;
function rgba(word: number): string { return `#${word.toString(16).padStart(8,'0')}`; }
export function namedStyle(style: EffectiveStyle): NamedEffectiveStyle {
  const mask = style.fontMask;
  const font: {-readonly [K in keyof FontStyle]: FontStyle[K]} = {};
  if (mask & 1) font.italic = true;
  if (mask & 2) font.bold = true;
  if (mask & 4) font.underline = true;
  if (mask & 8) font.strikethrough = true;
  return Object.freeze({foreground:rgba(style.foreground),background:rgba(style.background),fontMask:mask,
    fontStyle:mask ? Object.freeze(font) : 'reset'} satisfies NamedEffectiveStyle);
}
export function appliedStyle(profile: Profile, style: EffectiveStyle): AppliedStyle {
  const effective = namedStyle(style);
  if (profile === 'raw') return effective;
  const {background:_background,...applied} = effective;
  return Object.freeze(applied);
}
