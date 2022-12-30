# Serve

Tiny live-reloading HTTP server. Alternative to [live-server](https://www.npmjs.com/package/live-server) and [browser-sync](https://browsersync.io/) without all of the features/dependencies.

Reloads the page after any changes in the served directory, through a snippet of code injected into all served HTML files.

### CLI Usage

```sh
# start a server in the current dir
serve

# start a server in a specific dir
serve ./dist

# run directly from npm
npx @danprince/serve ./dist
```

### Programmatic Usage

```js
import { createLiveReloadServer } from "@danprince/serve";

createLiveReloadServer({
  dir: "./dist",
  port: 8080,
});
```

See `src/cli.ts` for a more comprehensive example.
