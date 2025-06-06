/**
 * This file was auto-generated by Fern from our API Definition.
 */

import * as DevRev from "../../../../index";

/**
 * @example
 *     {
 *         id: "id"
 *     }
 */
export interface ConversationsUpdateRequest {
    appliesToParts?: DevRev.ConversationsUpdateRequestAppliesToParts;
    /** Application-defined custom fields. */
    customFields?: Record<string, unknown>;
    customSchemaSpec?: DevRev.CustomSchemaSpec;
    /** The updated description for the conversation. */
    description?: string;
    /** The group that the conversation is associated with. */
    group?: string;
    /** The ID of the conversation to update. */
    id: string;
    /** Whether the conversation is spam. */
    isSpam?: boolean;
    metadata?: DevRev.ConversationsUpdateRequestMetadata;
    ownedBy?: DevRev.ConversationsUpdateRequestOwnedBy;
    stage?: DevRev.StageUpdate;
    /** The updated status of the conversation. */
    status?: string;
    tags?: DevRev.ConversationsUpdateRequestTags;
    /** The updated title of the conversation. */
    title?: string;
    userSessions?: DevRev.ConversationsUpdateRequestUserSessions;
}
