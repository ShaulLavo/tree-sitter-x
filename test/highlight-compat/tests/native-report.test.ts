import { describe, expect, it } from 'vitest';
import { unionScore, strictlyImproves, reportIdentity } from '../src/native-report.ts';
import { sourceIdentity } from '../src/native/component-inputs.ts';

describe('native report boundaries', () => {
  it('counts an incomplete candidate as zero on a shared union denominator', () => {
    expect(unionScore([{ units: 10, nonWhitespace: 5, matching: 4, matchingNonWhitespace: 2 },
      { units: 90, nonWhitespace: 45 }])).toEqual({ matching: 4, units: 100, matchingNonWhitespace: 2, nonWhitespace: 50, macro: 0.2 });
    expect(strictlyImproves(unionScore([{ units: 10, nonWhitespace: 5, matching: 4, matchingNonWhitespace: 2 }]),
      unionScore([{ units: 10, nonWhitespace: 5, matching: 4, matchingNonWhitespace: 2 }]))).toBe(false);
  });
  it('keeps an empty denominator N/A and never counts it as an improvement', () => {
    const empty = unionScore([]);
    expect(empty.macro).toBeNull(); expect(strictlyImproves(empty, empty)).toBe(false);
  });
  it('identifies runtime, artifacts and inputs independently of moving commit metadata', () => {
    const content = { runtime: 'runtime-hash', component: 'component-hash', corpus: 'input-hash' };
    expect(reportIdentity(content)).toBe(reportIdentity({ ...content }));
    expect(reportIdentity(content)).not.toBe(reportIdentity({ ...content, corpus: 'changed-input' }));
    expect(reportIdentity(content)).not.toBe(reportIdentity({ ...content, runtime: 'changed-runtime' }));
    const source = { inputs: [{ path: 'input.c', sha256: 'content-hash' }], observedCommit: 'head-before' };
    expect(reportIdentity({ source: sourceIdentity(source), ...content })).toBe(
      reportIdentity({ source: sourceIdentity({ ...source, observedCommit: 'head-after' }), ...content }));
  });
});
