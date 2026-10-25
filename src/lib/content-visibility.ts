import { and, eq, lte, or } from 'drizzle-orm';
import { schema } from '@/db';

type VisibleContent = Pick<
  typeof schema.contents.$inferSelect,
  'type' | 'status' | 'created' | 'authorId'
>;

export interface ContentViewer {
  uid?: number | null;
  isLoggedIn?: boolean;
}

export function nowSeconds(now = Date.now()): number {
  return Math.floor(now / 1000);
}

/** Canonical condition for posts visible in public lists and resolvers. */
export function publishedPostCondition(now = nowSeconds()) {
  return and(
    eq(schema.contents.type, 'post'),
    eq(schema.contents.status, 'publish'),
    lte(schema.contents.created, now),
  );
}

/**
 * List condition for posts that respects viewer permissions.
 * - Unauthenticated: only 'publish'
 * - Authenticated: 'publish' + all 'logged' + own 'private'
 *   （隐藏 'hidden' 文章不在列表中显示）
 */
export function listPostCondition(viewer: ContentViewer, now = nowSeconds()) {
  const baseType = eq(schema.contents.type, 'post');
  const baseDate = lte(schema.contents.created, now);

  if (viewer.isLoggedIn && viewer.uid != null) {
    return and(
      baseType,
      baseDate,
      or(
        eq(schema.contents.status, 'publish'),
        eq(schema.contents.status, 'logged'),
        and(
          eq(schema.contents.status, 'private'),
          eq(schema.contents.authorId, viewer.uid)
        )
      )
    );
  } else {
    return and(baseType, eq(schema.contents.status, 'publish'), baseDate);
  }
}

export function canViewContent(
  content: VisibleContent,
  viewer: ContentViewer,
  now = nowSeconds(),
): boolean {
  const isAuthor = !!viewer.isLoggedIn && !!viewer.uid && viewer.uid === content.authorId;
  const isDraft = content.type?.endsWith('_draft');
  const isPrivate = content.status === 'private';
  const isLogged = content.status === 'logged';
  const isPublished = content.status === 'publish' || content.status === 'hidden';
  const isFuture = (content.created ?? 0) > now;

  if (isDraft || isPrivate || (isPublished && isFuture)) return isAuthor;
  if (isLogged) {
    if (isFuture) return isAuthor;
    return !!viewer.isLoggedIn;
  }

  return isPublished;
}
