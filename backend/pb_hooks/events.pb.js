/// <reference path="../pb_data/types.d.ts" />

onRecordValidate((e) => {
  const end = e.record.getDateTime("end");
  if (!end.isZero() && end.before(e.record.getDateTime("start"))) {
    throw new BadRequestError("Failed to save the event.", {
      end: new ValidationError("validation_end_before_start", "End must be after start."),
    });
  }
  e.next();
}, "events");
