import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up orphaned attachments daily
crons.interval(
  "cleanup orphaned attachments",
  { hours: 24 },
  internal.attachmentCleanup.cleanupOrphans
);

export default crons;