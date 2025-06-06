/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as DevRev from "../../../../index";

/**
 * @example
 *     {}
 */
export interface SlasListRequest {
    /** The object types the SLA applies to. */
    appliesTo?: DevRev.SlaAppliesTo[];
    appliesToOp?: DevRev.SlasFilterAppliesToOperatorType;
    /**
     * The cursor to resume iteration from. If not provided, then
     * iteration starts from the beginning.
     *
     */
    cursor?: string;
    /**
     * The maximum number of SLAs to return. The default is '50'.
     *
     */
    limit?: number;
    mode?: DevRev.ListMode;
    /** The SLA types the filter matches. */
    slaType?: DevRev.SlaType[];
    /**
     * Fields to sort the SLAs by and the direction to sort them.
     *
     */
    sortBy?: string[];
    /** The SLA statuses the filter matches. */
    status?: DevRev.SlaStatus[];
}
