/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as serializers from "../index";
import * as DevRev from "../../api/index";
import * as core from "../../core";
import { Meeting } from "./Meeting";

export const MeetingsCreateResponse: core.serialization.ObjectSchema<
    serializers.MeetingsCreateResponse.Raw,
    DevRev.MeetingsCreateResponse
> = core.serialization.object({
    meeting: Meeting,
});

export declare namespace MeetingsCreateResponse {
    interface Raw {
        meeting: Meeting.Raw;
    }
}
