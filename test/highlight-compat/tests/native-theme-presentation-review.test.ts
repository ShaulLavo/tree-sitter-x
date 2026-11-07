import { expect, it, vi } from 'vitest';
import { context, acquisition, complete, acquired, reference } from './native-theme-presentation-controls.ts';
import { Component } from '../src/native/component.ts';
import type { ThemePresentation } from '../src/native/theme-presentation.ts';

function onNativeCall(component: Component, operation: string, action: () => void) {
  const call = component.call;
  let fired = false;
  const spy = vi.spyOn(component, 'call').mockImplementation((name, args = []) => {
    const result = call.call(component, name, args);
    if (name === operation && !fired) { fired = true; action(); }
    return result;
  });
  return { spy, fired: () => fired };
}
async function cleanup(current: Awaited<ReturnType<typeof context>>, hook: ReturnType<typeof onNativeCall> | undefined, pending?: ReturnType<ThemePresentation['select']>): Promise<void> {
  try { if (pending) await pending; } finally { hook?.spy.mockRestore(); current.dispose(); }
}

it('independent review: detaching the last memo holder during another view native result deletion preserves that view', async () => {
  const current = await context(), component = await Component.load();
  let hook: ReturnType<typeof onNativeCall> | undefined;
  try {
    complete(await current.presentation.select(current.view, acquisition()));
    const right = current.session.attachView({ from: 1, to: 2 }); current.session.flushOne();
    hook = onNativeCall(component, 'scope_compat_theme_result_delete', () => current.session.detachView(current.view));
    complete(await current.presentation.select(right, acquisition('inheritance-changed')));
    expect(hook.fired()).toBe(true);
    const held = acquired(current, right); reference(held, current.owner.source, 'inheritance-changed'); held.release();
  } finally { await cleanup(current, hook); }
});

it('independent review: selecting during actual old compiled-theme deletion preserves the later request', async () => {
  const current = await context(), component = await Component.load();
  let hook: ReturnType<typeof onNativeCall> | undefined, next: ReturnType<ThemePresentation['select']> | undefined;
  try {
    complete(await current.presentation.select(current.view, acquisition()));
    hook = onNativeCall(component, 'scope_compat_theme_delete', () => { next = current.presentation.select(current.view, acquisition('inheritance-changed')); });
    const older = current.presentation.select(current.view, acquisition('empty-light'));
    expect((await older).kind).toBe('discarded'); expect(hook.fired()).toBe(true);
    if (!next) throw new Error('Reentry not armed');
    complete(await next);
    const held = acquired(current); reference(held, current.owner.source, 'inheritance-changed'); held.release();
  } finally { await cleanup(current, hook, next); }
});

it('independent review: one throwing presentation subscriber cannot interrupt close invalidation or later subscribers', async () => {
  const component = await Component.load(), baseline = component.liveAllocations();
  const current = await context(), later = vi.fn();
  const removeFailure = current.session.onPresentationChange(() => { throw new Error('presentation observer'); });
  const removeLater = current.session.onPresentationChange(later);
  removeFailure(); removeLater();
  complete(await current.presentation.select(current.view, acquisition()));
  expect(component.liveAllocations()).toBeGreaterThan(baseline);
  for (const pack of current.packs.values()) pack.dispose();
  const removeThrow = current.session.onPresentationChange(() => { throw new Error('presentation observer'); });
  const removeFinal = current.session.onPresentationChange(later);
  try {
    expect(() => current.owner.dispose()).toThrow('Owner notification failed');
    expect(later).toHaveBeenCalledTimes(1);
    expect(current.session.retainedBytes()).toBe(0);
    expect(component.liveAllocations()).toBe(baseline);
  } finally { removeThrow(); removeFinal(); current.dispose(); }
});

it('finishes direct session disposal and all native releases before propagating subscriber errors', async () => {
  const component = await Component.load(), baseline = component.liveAllocations();
  const current = await context(), later = vi.fn();
  complete(await current.presentation.select(current.view, acquisition()));
  expect(component.liveAllocations()).toBeGreaterThan(baseline);
  for (const pack of current.packs.values()) pack.dispose();
  const stop = current.session.onPresentationChange(() => { throw new Error('presentation observer'); });
  const remove = current.session.onPresentationChange(later);
  try {
    expect(() => current.session.dispose()).toThrow();
    expect(later).toHaveBeenCalledTimes(1);
    expect(current.session.retainedBytes()).toBe(0);
    expect(component.liveAllocations()).toBe(baseline);
    expect(() => current.session.dispose()).not.toThrow();
    expect(current.owner.observe().kind).toBe('ready');
  } finally { stop(); remove(); current.dispose(); }
});
