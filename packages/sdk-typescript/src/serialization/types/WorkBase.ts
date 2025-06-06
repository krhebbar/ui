/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as serializers from "../index";
import * as DevRev from "../../api/index";
import * as core from "../../core";
import { PartSummary } from "./PartSummary";
import { ArtifactSummary } from "./ArtifactSummary";
import { UserSummary } from "./UserSummary";
import { LegacyStage } from "./LegacyStage";
import { SyncMetadata } from "./SyncMetadata";
import { TagWithValue } from "./TagWithValue";
import { AtomBase } from "./AtomBase";

export const WorkBase: core.serialization.ObjectSchema<serializers.WorkBase.Raw, DevRev.WorkBase> = core.serialization
    .object({
        actualCloseDate: core.serialization.property("actual_close_date", core.serialization.date().optional()),
        appliesToPart: core.serialization.property("applies_to_part", PartSummary.optional()),
        artifacts: core.serialization.list(ArtifactSummary).optional(),
        body: core.serialization.string().optional(),
        customFields: core.serialization.property(
            "custom_fields",
            core.serialization.record(core.serialization.string(), core.serialization.unknown()).optional()
        ),
        customSchemaFragments: core.serialization.property(
            "custom_schema_fragments",
            core.serialization.list(core.serialization.string()).optional()
        ),
        ownedBy: core.serialization.property("owned_by", core.serialization.list(UserSummary)),
        reportedBy: core.serialization.property("reported_by", core.serialization.list(UserSummary).optional()),
        stage: LegacyStage.optional(),
        stockSchemaFragment: core.serialization.property(
            "stock_schema_fragment",
            core.serialization.string().optional()
        ),
        subtype: core.serialization.string().optional(),
        syncMetadata: core.serialization.property("sync_metadata", SyncMetadata.optional()),
        tags: core.serialization.list(TagWithValue).optional(),
        targetCloseDate: core.serialization.property("target_close_date", core.serialization.date().optional()),
        title: core.serialization.string(),
    })
    .extend(AtomBase);

export declare namespace WorkBase {
    interface Raw extends AtomBase.Raw {
        actual_close_date?: string | null;
        applies_to_part?: PartSummary.Raw | null;
        artifacts?: ArtifactSummary.Raw[] | null;
        body?: string | null;
        custom_fields?: Record<string, unknown> | null;
        custom_schema_fragments?: string[] | null;
        owned_by: UserSummary.Raw[];
        reported_by?: UserSummary.Raw[] | null;
        stage?: LegacyStage.Raw | null;
        stock_schema_fragment?: string | null;
        subtype?: string | null;
        sync_metadata?: SyncMetadata.Raw | null;
        tags?: TagWithValue.Raw[] | null;
        target_close_date?: string | null;
        title: string;
    }
}
