/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as serializers from "../index";
import * as DevRev from "../../api/index";
import * as core from "../../core";

export const Definedness: core.serialization.Schema<serializers.Definedness.Raw, DevRev.Definedness> =
    core.serialization.enum_(["immutable", "mutable", "undefined"]);

export declare namespace Definedness {
    type Raw = "immutable" | "mutable" | "undefined";
}
