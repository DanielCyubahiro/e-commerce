import { readCollections, readEnvironment } from './postman-model';
import { describeRoute, matchesRoute } from './route-match';
import { readRoutes } from './routes-model';

// Shape only: a controller has a collection, a route has a request, a
// request has a route, a variable has a declaration. Expected statuses,
// descriptions, scripts and auth settings are not read; AGENTS.md lists
// them as discipline.
const routes = readRoutes();
const collections = readCollections();
const environment = readEnvironment();
const controllerRoots = [...new Set(routes.map((route) => route.root))].sort();
const collectionRoots = collections.map((collection) => collection.root);

describe('postman collections', () => {
  it('every controller has a collection file, and every file names a controller', () => {
    expect({
      controllersWithoutCollection: controllerRoots.filter(
        (root) => !collectionRoots.includes(root),
      ),
      collectionsWithoutController: collectionRoots.filter(
        (root) => !controllerRoots.includes(root),
      ),
    }).toEqual({
      controllersWithoutCollection: [],
      collectionsWithoutController: [],
    });
  });

  it('every route has a happy-path request in its controller collection', () => {
    const missing = routes
      .filter((route) => {
        const collection = collections.find((c) => c.root === route.root);
        return !collection?.requests.some(
          (request) => request.happyPath && matchesRoute(route, request),
        );
      })
      .map(describeRoute);

    expect(missing).toEqual([]);
  });

  it('every request targets a route of its own controller', () => {
    const orphaned = collections.flatMap((collection) =>
      collection.requests
        .filter(
          (request) =>
            !routes.some(
              (route) =>
                route.root === collection.root && matchesRoute(route, request),
            ),
        )
        .map(
          (request) =>
            `${collection.root}: ${describeRoute(request)} (${request.name})`,
        ),
    );

    expect(orphaned).toEqual([]);
  });

  it('every referenced variable is declared in the environment or the collection', () => {
    const undeclared = collections.flatMap((collection) =>
      collection.references
        .filter(
          (name) =>
            !environment.keys.includes(name) &&
            !collection.variables.includes(name),
        )
        .map((name) => `${collection.root}: ${name}`),
    );

    expect(undeclared).toEqual([]);
  });
});
