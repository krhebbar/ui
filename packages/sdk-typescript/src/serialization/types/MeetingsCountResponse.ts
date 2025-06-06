/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as serializers from "../index";
import * as DevRev from "../../api/index";
import * as core from "../../core";

export const MeetingsCountResponse: core.serialization.ObjectSchema<
    serializers.MeetingsCountResponse.Raw,
    DevRev.MeetingsCountResponse
> = core.serialization.object({
    count: core.serialization.number(),
});

export declare namespace MeetingsCountResponse {
    interface Raw {
        count: number;
    }
}
