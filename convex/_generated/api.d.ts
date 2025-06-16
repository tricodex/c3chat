/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as ai from "../ai.js";
import type * as analytics from "../analytics.js";
import type * as attachments from "../attachments.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as collaboration from "../collaboration.js";
import type * as http from "../http.js";
import type * as knowledgeBase from "../knowledgeBase.js";
import type * as messages from "../messages.js";
import type * as projects from "../projects.js";
import type * as promptTemplates from "../promptTemplates.js";
import type * as router from "../router.js";
import type * as threads from "../threads.js";
import type * as userSettings from "../userSettings.js";
import type * as utils_streamBuffer from "../utils/streamBuffer.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  analytics: typeof analytics;
  attachments: typeof attachments;
  auth: typeof auth;
  chat: typeof chat;
  collaboration: typeof collaboration;
  http: typeof http;
  knowledgeBase: typeof knowledgeBase;
  messages: typeof messages;
  projects: typeof projects;
  promptTemplates: typeof promptTemplates;
  router: typeof router;
  threads: typeof threads;
  userSettings: typeof userSettings;
  "utils/streamBuffer": typeof utils_streamBuffer;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
