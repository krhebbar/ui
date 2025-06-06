/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as DevRev from "../../../../index";

/**
 * @example
 *     {}
 */
export interface IncidentsListRequest {
    acknowledgedDate?: DevRev.DateFilter;
    actualCloseDate?: DevRev.DateFilter;
    /**
     * Filters for incidents that apply to any of the provided parts.
     *
     */
    appliesToParts?: string[];
    /**
     * Filters for incidents created by any of the provided users.
     *
     */
    createdBy?: string[];
    createdDate?: DevRev.DateFilter;
    /**
     * The cursor to resume iteration from. If not provided, then
     * iteration starts from the beginning.
     *
     */
    cursor?: string;
    identifiedDate?: DevRev.DateFilter;
    /** The maximum number of items. */
    limit?: number;
    mitigatedDate?: DevRev.DateFilter;
    mode?: DevRev.ListMode;
    modifiedDate?: DevRev.DateFilter;
    /**
     * Filters for incidents owned by any of the provided users.
     *
     */
    ownedBy?: string[];
    /** Filters for incidents with any of the provided PIAs. */
    pia?: string[];
    /**
     * Filters for incidents with any of the provided playbooks.
     *
     */
    playbook?: string[];
    /**
     * Filters for incidents with any of the provided related docs.
     *
     */
    relatedDocs?: string[];
    /**
     * Filters for incidents with any of the provided reporters.
     *
     */
    reportedBy?: number[];
    /**
     * Filters for incidents containing any of the provided severities.
     *
     */
    severity?: number[];
    /**
     * The list of fields to sort the items by and how to sort them.
     *
     */
    sortBy?: string[];
    /** Filters for incidents with any of the provided sources. */
    source?: number[];
    /** Filters for incidents in any of the provided stages. */
    stage?: string[];
    /** Filters for incidents with any of the provided subtypes. */
    subtype?: string[];
    targetCloseDate?: DevRev.DateFilter;
    /** Filters for incidents by the provided titles. */
    title?: string[];
}
