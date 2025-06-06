/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as serializers from "../index";
import * as DevRev from "../../api/index";
import * as core from "../../core";
import { SyncHistory } from "./SyncHistory";

export const AirdropSyncUnitsHistoryResponse: core.serialization.ObjectSchema<
    serializers.AirdropSyncUnitsHistoryResponse.Raw,
    DevRev.AirdropSyncUnitsHistoryResponse
> = core.serialization.object({
    nextCursor: core.serialization.property("next_cursor", core.serialization.string().optional()),
    prevCursor: core.serialization.property("prev_cursor", core.serialization.string().optional()),
    syncHistory: core.serialization.property("sync_history", core.serialization.list(SyncHistory)),
});

export declare namespace AirdropSyncUnitsHistoryResponse {
    interface Raw {
        next_cursor?: string | null;
        prev_cursor?: string | null;
        sync_history: SyncHistory.Raw[];
    }
}
