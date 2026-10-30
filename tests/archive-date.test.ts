/**
 * Date archive regression: /YYYY/, /YYYY/MM/ and /YYYY/MM/DD/ must resolve to
 * an archive filtered to that UTC period instead of 404.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb, type TestDatabase } from '../helpers';
import { schema } from '@/db';

let testDb: TestDatabase;

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: (_d1: any) => testDb, schema: actual.schema };
});

import { prepareDateData } from '@/lib/page-data';

function buildCtx() {
  return {
    db: testDb,
    options: {
      siteUrl: 'https://example.com',
      pageSize: 10,
      categoryPattern: '/category/{slug}/',
      permalinkPattern: '/archives/{cid}/',
      pagePattern: '/{slug}.html',
      commentsAvatarRating: 'G',
      commentsOrder: 'ASC',
      timezone: 0,
      commentsAntiSpam: 0,
      secret: '',
    } as any,
    urls: { siteUrl: 'https://example.com' } as any,
    user: null,
    isLoggedIn: false,
    csrfToken: null,
  };
}

const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe('date archive', () => {
  beforeEach(async () => {
    testDb = await createTestDb();
  });

  it('returns posts within the requested UTC month', async () => {
    await testDb.insert(schema.contents).values([
      {
        title: 'Oct 1', slug: 'oct-1', type: 'post', status: 'publish',
        created: at('2025-10-01T00:00:00Z'), modified: at('2025-10-01T00:00:00Z'),
      },
      {
        title: 'Oct 31', slug: 'oct-31', type: 'post', status: 'publish',
        created: at('2025-10-31T23:59:59Z'), modified: at('2025-10-31T23:59:59Z'),
      },
      {
        title: 'Nov 1', slug: 'nov-1', type: 'post', status: 'publish',
        created: at('2025-11-01T00:00:00Z'), modified: at('2025-11-01T00:00:00Z'),
      },
    ]);

    const props = await prepareDateData(
      buildCtx() as any,
      'https://example.com/2025/10/',
      {},
      new URL('https://example.com/2025/10/'),
      2025,
      10,
    );

    expect(props.archiveType).toBe('date');
    expect(props.archiveTitle).toBe('2025 年 10 月');
    expect(props.posts.map(post => post.title)).toEqual(['Oct 31', 'Oct 1']);
  });
});
