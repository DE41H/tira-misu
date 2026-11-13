/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/invite", (e) => {
  if (e.auth.getString("irisId")) {
    return e.json(200, { linked: true });
  }
  const { iris } = require(`${__hooks}/iris.js`);
  let c;
  try {
    c = iris("POST", "/codes/", {});
  } catch (err) {
    e.app.logger().error("iris code failed", "error", String(err));
    return e.json(502, { error: "Iris did not answer. Try again." });
  }
  e.setCookie(new Cookie({ name: "iris_code", value: c.code, path: "/api/invite", httpOnly: true, secure: true, sameSite: 2 /* Lax */, maxAge: 180 }));
  return e.json(200, { url: c.url });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/invite/{code}", (e) => {
  const code = e.request.pathValue("code");
  let cookie = "";
  try {
    cookie = e.request.cookie("iris_code").value;
  } catch {}
  if (!cookie || cookie !== code) {
    throw new BadRequestError("This link is not yours. Connect again.");
  }
  e.setCookie(new Cookie({ name: "iris_code", path: "/api/invite", httpOnly: true, secure: true, maxAge: -1 }));

  const { iris } = require(`${__hooks}/iris.js`);
  let s;
  try {
    s = iris("GET", `/codes/${encodeURIComponent(code)}/`);
  } catch (err) {
    e.app.logger().error("iris code check failed", "error", String(err));
    return e.json(502, { error: "Iris did not answer. Try again." });
  }
  if (s.status !== "accepted" || !s.user) {
    return e.json(200, { linked: false });
  }
  const user = e.app.findRecordById("users", e.auth.id);
  if (e.app.findRecordsByFilter("users", "irisId = {:iris} && id != {:id}", "", 1, 0, { iris: s.user, id: user.id }).length) {
    throw new ApiError(409, "This Iris account already belongs to a Tira account.");
  }
  if (!user.getString("irisId")) {
    user.set("irisId", s.user);
    e.app.save(user);
  }
  return e.json(200, { linked: true });
}, $apis.requireAuth("users"));
