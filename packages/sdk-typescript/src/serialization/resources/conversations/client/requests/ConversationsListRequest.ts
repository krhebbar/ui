/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as serializers from "../../../../index";
import * as DevRev from "../../../../../api/index";
import * as core from "../../../../../core";
import { ListMode } from "../../../../types/ListMode";
import { SlaSummaryFilter } from "../../../../types/SlaSummaryFilter";
import { StageFilter } from "../../../../types/StageFilter";
import { TagWithValueFilter } from "../../../../types/TagWithValueFilter";

export const ConversationsListRequest: core.serialization.Schema<
    serializers.ConversationsListRequest.Raw,
    DevRev.ConversationsListRequest
> = core.serialization.object({
    appliesToParts: core.serialization.property(
        "applies_to_parts",
        core.serialization.list(core.serialization.string()).optional()
    ),
    cursor: core.serialization.string().optional(),
    customFields: core.serialization.property(
        "custom_fields",
        core.serialization.record(core.serialization.string(), core.serialization.unknown()).optional()
    ),
    group: core.serialization.list(core.serialization.string()).optional(),
    isCreatorVerified: core.serialization.property("is_creator_verified", core.serialization.boolean().optional()),
    isSpam: core.serialization.property("is_spam", core.serialization.boolean().optional()),
    limit: core.serialization.number().optional(),
    members: core.serialization.list(core.serialization.string()).optional(),
    mode: ListMode.optional(),
    ownedBy: core.serialization.property("owned_by", core.serialization.list(core.serialization.string()).optional()),
    revOrg: core.serialization.property("rev_org", core.serialization.list(core.serialization.string()).optional()),
    revOrgs: core.serialization.property("rev_orgs", core.serialization.list(core.serialization.string()).optional()),
    slaSummary: core.serialization.property("sla_summary", SlaSummaryFilter.optional()),
    sourceChannel: core.serialization.property(
        "source_channel",
        core.serialization.list(core.serialization.string()).optional()
    ),
    sourceChannels: core.serialization.property(
        "source_channels",
        core.serialization.list(core.serialization.string()).optional()
    ),
    stage: StageFilter.optional(),
    subtype: core.serialization.list(core.serialization.string()).optional(),
    tags: core.serialization.list(core.serialization.string()).optional(),
    tagsV2: core.serialization.property("tags_v2", core.serialization.list(TagWithValueFilter).optional()),
});

export declare namespace ConversationsListRequest {
    interface Raw {
        applies_to_parts?: string[] | null;
        cursor?: string | null;
        custom_fields?: Record<string, unknown> | null;
        group?: string[] | null;
        is_creator_verified?: boolean | null;
        is_spam?: boolean | null;
        limit?: number | null;
        members?: string[] | null;
        mode?: ListMode.Raw | null;
        owned_by?: string[] | null;
        rev_org?: string[] | null;
        rev_orgs?: string[] | null;
        sla_summary?: SlaSummaryFilter.Raw | null;
        source_channel?: string[] | null;
        source_channels?: string[] | null;
        stage?: StageFilter.Raw | null;
        subtype?: string[] | null;
        tags?: string[] | null;
        tags_v2?: TagWithValueFilter.Raw[] | null;
    }
}
