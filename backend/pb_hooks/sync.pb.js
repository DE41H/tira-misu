/// <reference path="../pb_data/types.d.ts" />

if ($os.getenv("IRIS_URL") && $os.getenv("IRIS_KEY")) {
  cronAdd("irisSync", "*/5 * * * *", () => {
    try {
      require(`${__hooks}/sync.js`).syncIris();
    } catch (err) {
      $app.logger().error("iris sync failed", "error", String(err));
    }
  });
} else {
  $app.logger().warn("IRIS_URL or IRIS_KEY are unset, so mail is not synced.");
}
