/** The part of a route or a request the matcher compares. */
export interface RouteShape {
  method: string;
  segments: string[];
}

/**
 * Whether a Postman request could reach a Nest route: same method, same
 * number of segments, and each route segment either a `:param`, which
 * accepts any non-empty request segment, or a literal the request repeats
 * exactly. `{{userId}}`, a made-up UUID and `not-a-uuid` all satisfy `:id`.
 * Nest's wildcard and optional segments are not handled; none exist here.
 */
export function matchesRoute(route: RouteShape, request: RouteShape): boolean {
  if (route.method !== request.method) return false;
  if (route.segments.length !== request.segments.length) return false;

  return route.segments.every((segment, index) => {
    const actual = request.segments[index];
    if (actual === undefined || actual === '') return false;
    return segment.startsWith(':') || segment === actual;
  });
}

/** `DELETE /auth/sessions/:id`, the form every failure list uses. */
export function describeRoute(route: RouteShape): string {
  return `${route.method} /${route.segments.join('/')}`;
}
