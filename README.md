# Serve

Tiny live-reloading HTTP server. Alternative to [livereload](https://www.npmjs.com/package/livereload) and [browser-sync](https://browsersync.io/) without any bloat.

### CLI Usage

```sh
# start a server in the cwd
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
