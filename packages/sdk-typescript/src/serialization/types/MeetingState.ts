/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as serializers from "../index";
import * as DevRev from "../../api/index";
import * as core from "../../core";

export const MeetingState: core.serialization.Schema<serializers.MeetingState.Raw, DevRev.MeetingState> =
    core.serialization.enum_(["canceled", "completed", "no_show", "rescheduled", "scheduled"]);

export declare namespace MeetingState {
    type Raw = "canceled" | "completed" | "no_show" | "rescheduled" | "scheduled";
}
