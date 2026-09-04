import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ACCEPTANCE_CRITERIA } from './acceptance-criteria.matrix';

describe('PRD acceptance criteria matrix', () => {
  it('contains one evidence row for each of the 27 criteria', () => {
    expect(ACCEPTANCE_CRITERIA).toHaveLength(27);
    expect(ACCEPTANCE_CRITERIA.map((criterion) => criterion.id)).toEqual(
      Array.from({ length: 27 }, (_, index) => index + 1),
    );

    for (const criterion of ACCEPTANCE_CRITERIA) {
      expect(criterion.requirements).not.toHaveLength(0);
      expect(criterion.summary).not.toHaveLength(0);
      expect(criterion.testPaths.length).toBeGreaterThan(0);

      for (const testPath of criterion.testPaths) {
        expect(existsSync(resolve(process.cwd(), testPath))).toBe(true);
      }
    }
  });
});
