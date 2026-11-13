/// <reference path="../pb_data/types.d.ts" />

onBootstrap((e) => {
  e.next();
  const id = $os.getenv("GOOGLE_CLIENT_ID"), secret = $os.getenv("GOOGLE_CLIENT_SECRET");
  if (!id || !secret) {
    e.app.logger().warn("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET are unset.");
    return;
  }
  const users = e.app.findCollectionByNameOrId("users");
  users.oauth2.enabled = true;
  users.oauth2.providers = [{ name: "google", clientId: id, clientSecret: secret }];
  e.app.save(users);
});
