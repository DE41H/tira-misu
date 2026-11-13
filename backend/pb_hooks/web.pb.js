/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/{path...}", (e) => {
  const path = e.request.url.path, h = e.response.header();
  const pub = $os.dirFS(__hooks + "/../pb_public");
  if (path.startsWith("/api/")) {
    throw new NotFoundError();
  }
  if (path.startsWith("/assets/")) {
    h.set("Cache-Control", "public, max-age=31536000, immutable");
    try {
      return $apis.static(pub, false)(e);
    } catch (err) {
      h.del("Cache-Control");
      throw err;
    }
  }
  h.set("Cache-Control", "no-cache");
  return $apis.static(pub, true)(e);
});
