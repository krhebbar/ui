/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as serializers from "../../../../index";
import * as DevRev from "../../../../../api/index";
import * as core from "../../../../../core";
import { DateFilter } from "../../../../types/DateFilter";
import { ListMode } from "../../../../types/ListMode";

export const IncidentsGroupRequest: core.serialization.Schema<
    serializers.IncidentsGroupRequest.Raw,
    DevRev.IncidentsGroupRequest
> = core.serialization.object({
    acknowledgedDate: core.serialization.property("acknowledged_date", DateFilter.optional()),
    actualCloseDate: core.serialization.property("actual_close_date", DateFilter.optional()),
    appliesToParts: core.serialization.property(
        "applies_to_parts",
        core.serialization.list(core.serialization.string()).optional()
    ),
    createdBy: core.serialization.property(
        "created_by",
        core.serialization.list(core.serialization.string()).optional()
    ),
    createdDate: core.serialization.property("created_date", DateFilter.optional()),
    cursor: core.serialization.string().optional(),
    groupBy: core.serialization.property("group_by", core.serialization.string()),
    identifiedDate: core.serialization.property("identified_date", DateFilter.optional()),
    limit: core.serialization.number().optional(),
    limitPerGroup: core.serialization.property("limit_per_group", core.serialization.number().optional()),
    mitigatedDate: core.serialization.property("mitigated_date", DateFilter.optional()),
    mode: ListMode.optional(),
    modifiedDate: core.serialization.property("modified_date", DateFilter.optional()),
    ownedBy: core.serialization.property("owned_by", core.serialization.list(core.serialization.string()).optional()),
    pia: core.serialization.list(core.serialization.string()).optional(),
    playbook: core.serialization.list(core.serialization.string()).optional(),
    relatedDocs: core.serialization.property(
        "related_docs",
        core.serialization.list(core.serialization.string()).optional()
    ),
    reportedBy: core.serialization.property(
        "reported_by",
        core.serialization.list(core.serialization.number()).optional()
    ),
    severity: core.serialization.list(core.serialization.number()).optional(),
    sortBy: core.serialization.property("sort_by", core.serialization.list(core.serialization.string()).optional()),
    source: core.serialization.list(core.serialization.number()).optional(),
    stage: core.serialization.list(core.serialization.string()).optional(),
    subtype: core.serialization.list(core.serialization.string()).optional(),
    targetCloseDate: core.serialization.property("target_close_date", DateFilter.optional()),
    title: core.serialization.list(core.serialization.string()).optional(),
});

export declare namespace IncidentsGroupRequest {
    interface Raw {
        acknowledged_date?: DateFilter.Raw | null;
        actual_close_date?: DateFilter.Raw | null;
        applies_to_parts?: string[] | null;
        created_by?: string[] | null;
        created_date?: DateFilter.Raw | null;
        cursor?: string | null;
        group_by: string;
        identified_date?: DateFilter.Raw | null;
        limit?: number | null;
        limit_per_group?: number | null;
        mitigated_date?: DateFilter.Raw | null;
        mode?: ListMode.Raw | null;
        modified_date?: DateFilter.Raw | null;
        owned_by?: string[] | null;
        pia?: string[] | null;
        playbook?: string[] | null;
        related_docs?: string[] | null;
        reported_by?: number[] | null;
        severity?: number[] | null;
        sort_by?: string[] | null;
        source?: number[] | null;
        stage?: string[] | null;
        subtype?: string[] | null;
        target_close_date?: DateFilter.Raw | null;
        title?: string[] | null;
    }
}
