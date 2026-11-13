/// <reference path="../pb_data/types.d.ts" />

const PAGES = 15;

/**
 * Calls the Iris API ($IRIS_URL/api/v1, or a full URL such as a page's next link) with the plugin key
 * and returns the decoded JSON answer (null when empty). Throws on a network error or a non-2xx status.
 */
function iris(method, path, body) {
  const url = path.startsWith("http") ? path : $os.getenv("IRIS_URL") + "/api/v1" + path;
  const res = $http.send({
    url,
    method,
    body: body ? JSON.stringify(body) : "",
    headers: { Authorization: "Bearer " + $os.getenv("IRIS_KEY"), "Content-Type": "application/json" },
    timeout: 10,
  });
  if (res.statusCode >= 300) {
    throw new Error(`iris ${res.statusCode} on ${url.split("?")[0]}`);
  }
  return res.body.length ? JSON.parse(toString(res.body)) : null;
}

/** Follows Iris's paging; done is false when PAGES ran out before the last page. */
function irisList(path) {
  const items = [];
  let next = path;
  for (let i = 0; next && i < PAGES; i++) {
    const page = iris("GET", next);
    items.push(...page.results);
    next = page.next;
  }
  return { items, done: !next };
}

module.exports = { iris, irisList };
