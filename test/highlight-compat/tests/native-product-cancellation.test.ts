import { expect, it, vi } from 'vitest';
import { Component } from '../src/native/component.ts';
import { counter } from '../src/native/owner-state.ts';
import { context } from './native-product-controls.ts';

it.each(['cancel', 'detach', 'dispose'] as const)('retires child work canceled by %s during native result deletion', async mode => {
  const source = '```json\n1\n```\n```json\n2\n```\n';
  const current = await context(source, {}, true), component = await Component.load(), call = component.call;
  await current.owner.applyEdits({ base: current.owner.key(), edits: [{ from: 8, to: 9, insert: '3' }] });
  expect(current.session.retainedBytes()).toBe(0);
  let fired = false;
  const spy = vi.spyOn(component, 'call').mockImplementation(function(name, args = []) {
    const result = call.call(component, name, args);
    if (name !== 'scope_compat_result_delete' || fired) return result;
    fired = true;
    if (mode === 'cancel') current.session.cancel(current.view, counter<'InterestGeneration'>(1));
    if (mode === 'detach') current.session.detachView(current.view);
    if (mode === 'dispose') current.session.dispose();
    return result;
  });
  try {
    current.session.flushOne(); expect(fired).toBe(true); expect(current.session.retainedBytes()).toBe(0);
    if (mode === 'dispose') return;
    if (mode === 'cancel') current.session.request(current.view, { viewport: { from: 0, to: source.length }, theme: 2 });
    const next = mode === 'cancel' ? current.view : current.session.attachView({ from: 0, to: source.length });
    current.session.flushOne(); current.session.flushOne();
    expect(current.session.outcome(next)?.kind).toBe('complete');
  } finally { spy.mockRestore(); current.dispose(); expect(current.session.retainedBytes()).toBe(0); }
});

it('keeps newer partial work when an older child result returns after cancellation', async () => {
  const source = '```json\n1\n```\n```json\n2\n```\n';
  const current = await context(source, {}, true), component = await Component.load(), call = component.call;
  await current.owner.applyEdits({ base: current.owner.key(), edits: [{ from: 8, to: 9, insert: '3' }] });
  let fired = false, nestedBytes = 0;
  const spy = vi.spyOn(component, 'call').mockImplementation(function(name, args = []) {
    const result = call.call(component, name, args);
    if (name !== 'scope_compat_result_delete' || fired) return result;
    fired = true; current.session.cancel(current.view, counter<'InterestGeneration'>(1));
    current.session.request(current.view, { viewport: { from: 0, to: source.length }, theme: 2 });
    current.session.flushOne(); nestedBytes = current.session.retainedBytes(); return result;
  });
  try {
    current.session.flushOne(); expect(fired).toBe(true); expect(nestedBytes).toBeGreaterThan(0);
    expect(current.session.retainedBytes()).toBe(nestedBytes);
    current.session.flushOne(); expect(current.session.outcome(current.view)?.kind).toBe('complete');
  } finally { spy.mockRestore(); current.dispose(); }
  expect(current.session.retainedBytes()).toBe(0);
});
