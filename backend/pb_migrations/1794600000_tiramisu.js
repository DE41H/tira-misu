/// <reference path="../pb_data/types.d.ts" />

const categories = [
  "class", "exam", "paper_distribution", "deadline", "talk", "workshop", "competition",
  "recruitment", "cultural", "sports", "meeting", "campus_service", "other_event",
];

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.passwordAuth.enabled = false;
  users.updateRule = null;
  users.fields.add(new TextField({ name: "irisId", max: 64 }));
  users.addIndex("idx_users_irisId", true, "`irisId`", "`irisId` != ''");
  app.save(users);

  const owner = "user = @request.auth.id";
  const events = new Collection({
    type: "base",
    name: "events",
    listRule: owner,
    viewRule: owner,
    deleteRule: owner,
    createRule: `@request.auth.id != "" && @request.body.user = @request.auth.id && @request.body.audience = "me" && @request.body.manual = true && @request.body.irisId:isset = false`,
    updateRule: owner + " && @request.body.user:isset = false && @request.body.audience:isset = false && @request.body.manual:isset = false && @request.body.irisId:isset = false",
  });
  events.fields.add(
    new RelationField({ name: "user", collectionId: users.id, required: true, cascadeDelete: true, maxSelect: 1 }),
    new TextField({ name: "title", required: true, max: 200 }),
    new SelectField({ name: "category", required: true, maxSelect: 1, values: categories }),
    new SelectField({ name: "audience", required: true, maxSelect: 1, values: ["me", "course", "everyone"] }),
    new TextField({ name: "course", max: 32 }),
    new TextField({ name: "place", max: 200 }),
    new TextField({ name: "link", max: 500, pattern: "^https?://\\S+$" }),
    new DateField({ name: "start", required: true }),
    new DateField({ name: "end" }),
    new BoolField({ name: "allDay" }),
    new BoolField({ name: "cancelled" }),
    new BoolField({ name: "review" }),
    new BoolField({ name: "manual" }),
    new TextField({ name: "irisId", max: 64 }),
    new AutodateField({ name: "created", onCreate: true }),
    new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
  );
  events.addIndex("idx_events_user_start", false, "`user`, `start`", "");
  events.addIndex("idx_events_irisId", true, "`irisId`", "`irisId` != ''");
  app.save(events);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("events"));
  const users = app.findCollectionByNameOrId("users");
  users.passwordAuth.enabled = true;
  users.updateRule = "id = @request.auth.id";
  users.removeIndex("idx_users_irisId");
  users.fields.removeByName("irisId");
  app.save(users);
});
