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
import type * as attachments from "../attachments.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as router from "../router.js";
import type * as threads from "../threads.js";
import type * as userSettings from "../userSettings.js";

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
  attachments: typeof attachments;
  auth: typeof auth;
  chat: typeof chat;
  http: typeof http;
  messages: typeof messages;
  router: typeof router;
  threads: typeof threads;
  userSettings: typeof userSettings;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
