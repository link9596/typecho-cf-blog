/**
 * Regression: list items carry the content status so the theme can show
 * “仅登录可见 / 私密” tags next to the date.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb, type TestDatabase } from '../helpers';
import { schema } from '@/db';

let testDb: TestDatabase;

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: (_d1: any) => testDb, schema: actual.schema };
});

import { prepareIndexData } from '@/lib/page-data';

const NOW = Math.floor(Date.now() / 1000);

function buildCtx(user: any) {
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
    user,
    isLoggedIn: true,
    csrfToken: null,
  };
}

describe('post list visibility status', () => {
  beforeEach(async () => {
    testDb = await createTestDb();
  });

  it('exposes publish and logged statuses to the theme', async () => {
    await testDb.insert(schema.users).values({
      name: 'author',
      mail: 'author@example.com',
      screenName: 'Author',
      group: 'editor',
      authCode: 'x',
    });
    const author = (await testDb.query.users.findFirst())!;

    await testDb.insert(schema.contents).values([
      {
        title: 'Public', slug: 'public-status', type: 'post', status: 'publish',
        authorId: author.uid, created: NOW - 120, modified: NOW - 120,
      },
      {
        title: 'Logged', slug: 'logged-status', type: 'post', status: 'logged',
        authorId: author.uid, created: NOW - 60, modified: NOW - 60,
      },
    ]);

    const props = await prepareIndexData(
      buildCtx(author) as any,
      'https://example.com/',
      {},
      new URL('https://example.com/'),
    );

    expect(props.posts.map(post => post.status).sort()).toEqual(['logged', 'publish']);
  });
});
