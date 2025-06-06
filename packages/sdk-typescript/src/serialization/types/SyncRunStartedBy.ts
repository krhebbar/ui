/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as serializers from "../index";
import * as DevRev from "../../api/index";
import * as core from "../../core";

export const SyncRunStartedBy: core.serialization.Schema<serializers.SyncRunStartedBy.Raw, DevRev.SyncRunStartedBy> =
    core.serialization.enum_(["periodic_sync_scheduler", "user"]);

export declare namespace SyncRunStartedBy {
    type Raw = "periodic_sync_scheduler" | "user";
}
