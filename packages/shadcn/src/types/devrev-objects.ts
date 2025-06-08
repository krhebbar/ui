import { z } from "zod"

// =============================================================================
// Base DevRev Object Schema
// =============================================================================

export const baseDevRevObjectSchema = z.object({
  id: z.string().describe("Unique identifier for the object"),
  created_date: z.string().describe("ISO timestamp when the object was created"),
  modified_date: z.string().describe("ISO timestamp when the object was last modified"),
  created_by_id: z.string().optional().describe("User ID of the user that created the object"),
  modified_by_id: z.string().optional().describe("User ID of the user that last modified the object"),
  tags: z.array(z.string()).optional().describe("Tags associated with the object"),
  item_url_field: z.string().optional().describe("Link to the item in the origin system"),
})

// =============================================================================
// Enum Definitions
// =============================================================================

export const severityEnum = z.enum(["sev0", "sev1", "sev2", "sev3"])
export const priorityEnum = z.enum(["p0", "p1", "p2", "p3"])
export const stateEnum = z.enum(["active", "inactive", "deactivated"])
export const environmentEnum = z.enum(["production", "development", "staging"])
export const visibilityEnum = z.enum(["public", "private", "internal"])
export const accessLevelEnum = z.enum(["public", "private", "restricted"])
export const userTypeEnum = z.enum(["user", "group"])
export const groupTypeEnum = z.enum(["static", "dynamic"])

// =============================================================================
// DevRev Object Schemas
// =============================================================================

export const accountSchema = baseDevRevObjectSchema.extend({
  display_name: z.string().describe("Name of the Organization"),
  description: z.string().optional().describe("Description of the corresponding Account"),
  environment: environmentEnum.optional().describe("The environment of the Org. Defaults to 'production' if not specified"),
  owned_by: z.array(z.string()).describe("List of Dev user IDs owning this Account"),
  phone_numbers: z.array(z.string()).optional().describe("Phone numbers of the Organization"),
  state: stateEnum.describe("State of the Organization"),
  websites: z.array(z.string()).optional().describe("Websites"),
}).describe("DevRev Account object")

export const airdropAuthorizationPolicySchema = baseDevRevObjectSchema.extend({
  groups: z.array(z.string()).optional().describe("Groups this role applies to"),
  privileges: z.array(z.string()).optional().describe("Privileges the role provides"),
  targets: z.array(z.string()).describe("Target object types the role applies to"),
  users: z.array(z.string()).optional().describe("Users this role applies to"),
}).describe("Airdrop authorization policy object type")

export const airdropPlatformGroupSchema = baseDevRevObjectSchema.extend({
  key: z.string().describe("Key of the platform provided group"),
}).describe("Airdrop platform group object type")

export const articleSchema = baseDevRevObjectSchema.extend({
  title: z.string().describe("Title of the article"),
  content: z.string().optional().describe("Content of the article"),
  authored_by_ids: z.array(z.string()).optional().describe("Users that authored the article"),
  owned_by_ids: z.array(z.string()).describe("Users that own the article"),
  status: z.enum(["draft", "published", "archived"]).optional().describe("Status of the article"),
  language: z.string().optional().describe("Language of the article for i18n support"),
  published_date: z.string().optional().describe("Timestamp when the article was published"),
  access_level: accessLevelEnum.optional().describe("Default access level for the object"),
  aliases: z.array(z.string()).optional().describe("Aliases for the URL of the article"),
  applies_to_part_ids: z.array(z.string()).optional().describe("Parts relevant to the article"),
}).describe("DevRev Article object")

export const capabilitySchema = baseDevRevObjectSchema.extend({
  name: z.string().describe("Name of the part"),
  description: z.string().optional().describe("Description of the part"),
  parent_part: z.string().describe("Parent of this part"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the part"),
  delivered_as: z.array(z.string()).optional().describe("Methods the product can be delivered as"),
  fulfilled_by: z.array(z.string()).optional().describe("IDs of the runnables that fulfill this capability"),
  part_of_part_id: z.string().optional().describe("Product ID of this Capability"),
  pm_owner_id: z.string().optional().describe("User ID of the PM owner of the part"),
  ref_url: z.string().optional().describe("URL to the part details (git url, website, etc.)"),
}).describe("DevRev Capability object")

export const channelSchema = baseDevRevObjectSchema.extend({
  name: z.string().optional().describe("The name of the channel"),
  title: z.string().optional().describe("The title given to the chat"),
  access_level: accessLevelEnum.optional().describe("The access level for the channel"),
}).describe("DevRev Channel object")

export const commentSchema = baseDevRevObjectSchema.extend({
  body: z.string().describe("Comment body"),
  parent_object_id: z.string().describe("The object this relates to"),
  parent_object_type: z.string().optional().describe("The object type this relates to"),
  grandparent_object_id: z.string().optional().describe("The object this relates to"),
  grandparent_object_type: z.string().optional().describe("The object type this relates to"),
  visibility: visibilityEnum.optional().describe("Visibility of the comment"),
  creator_display_name: z.string().optional().describe("Creator display name"),
  external_ref: z.string().optional().describe("The external reference to associate with the entry"),
}).describe("DevRev Comment object")

export const componentSchema = baseDevRevObjectSchema.extend({
  name: z.string().describe("Name of the part"),
  description: z.string().optional().describe("Description of the part"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the part"),
  development_owner_id: z.string().optional().describe("User ID of the development owner of the part"),
  pm_owner_id: z.string().optional().describe("User ID of the PM owner of the part"),
  qa_owner_id: z.string().optional().describe("User ID of the QA owner of the part"),
  parent_part: z.string().optional().describe("Parent of this part"),
  delivered_as: z.array(z.string()).optional().describe("Methods the product can be delivered as"),
  ref_url: z.string().optional().describe("URL to the part details (git url, website, etc.)"),
}).describe("DevRev Component object")

export const conversationSchema = baseDevRevObjectSchema.extend({
  title: z.string().optional().describe("Title of the conversation object"),
  description: z.string().optional().describe("Description of the conversation object"),
  conversation_type: z.string().describe("A type of object used to track conversations"),
  member_ids: z.array(z.string()).describe("User IDs of the users in the conversation"),
  owned_by_ids: z.array(z.string()).optional().describe("Users that own the conversation"),
  priority: priorityEnum.optional().describe("Priority of the conversation"),
  stage: z.enum(["new", "in_progress", "resolved", "closed"]).optional().describe("Stage of the conversation"),
  applies_to_part_ids: z.array(z.string()).optional().describe("Details of the parts relevant to the conversation"),
  group: z.string().optional().describe("Group that owns the conversation"),
  participant_oids: z.array(z.string()).optional().describe("Globally unique IDs of participating orgs"),
  participant_uids: z.array(z.string()).optional().describe("Globally unique ID of DevRev rev users"),
  source_channel: z.string().optional().describe("Source channel for the conversation"),
  started_by_id: z.string().optional().describe("User that started the conversation"),
}).describe("DevRev Conversation object")

export const customLinkSchema = baseDevRevObjectSchema.extend({
  link_type_id: z.string().describe("Link Type"),
  source_id: z.string().describe("Source object ID"),
  target_id: z.string().describe("Target object ID"),
}).describe("DevRev Custom Link object")

export const customPartSchema = baseDevRevObjectSchema.extend({
  name: z.string().describe("Name of the part"),
  description: z.string().optional().describe("Description of the part"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the part"),
  parent_part: z.string().optional().describe("Parent of this part"),
  delivered_as: z.array(z.string()).optional().describe("Methods the product can be delivered as"),
  ref_url: z.string().optional().describe("URL to the part details (git url, website, etc.)"),
}).describe("DevRev Custom Part object")

export const devuSchema = baseDevRevObjectSchema.extend({
  display_name: z.string().describe("The user's display name. The name is non-unique and mutable"),
  email: z.string().optional().describe("Email address of the user"),
  full_name: z.string().optional().describe("Full name of the user"),
  state: stateEnum.optional().describe("State of the user"),
  external_identities: z.array(z.record(z.any())).optional().describe("IDs of the Dev User outside the DevRev SOR"),
}).describe("DevRev Dev User object")

export const directorySchema = baseDevRevObjectSchema.extend({
  title: z.string().describe("Title of the directory"),
  description: z.string().optional().describe("Description of the directory"),
  published: z.boolean().describe("Whether the directory is published"),
  parent: z.string().optional().describe("Parent directory"),
  rank: z.string().optional().describe("Rank of the directory"),
  icon: z.string().optional().describe("Icon of the directory"),
  language: z.string().optional().describe("Language of the directory"),
  body: z.string().optional().describe("Body of the directory"),
  thumbnail: z.string().optional().describe("Thumbnail of the directory"),
}).describe("DevRev Directory object")

export const dmSchema = baseDevRevObjectSchema.extend({
  title: z.string().optional().describe("The title given to the chat"),
  user_ids: z.array(z.string()).describe("The users in the direct message"),
  is_default: z.boolean().optional().describe("Whether this is the default DM for messaging the constituent users"),
  record_ids: z.array(z.string()).optional().describe("The associated records for this DM"),
}).describe("DevRev Direct Message object")

export const enhancementSchema = baseDevRevObjectSchema.extend({
  name: z.string().describe("Name of the part"),
  description: z.string().optional().describe("Description of the part"),
  parent_part: z.string().describe("Parent of this part"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the part"),
  stage: z.enum(["triage", "in_progress", "completed"]).optional().describe("Stage of the part"),
  target_close_date: z.string().optional().describe("Target close date for the object"),
  target_start_date: z.string().optional().describe("Target start date for the object"),
  potential_revenue: z.number().optional().describe("Potential revenue from the enhancement"),
  account_ids: z.array(z.string()).optional().describe("Accounts associated to enhancement"),
  opportunity_ids: z.array(z.string()).optional().describe("Opportunities from the enhancement"),
  ticket_ids: z.array(z.string()).optional().describe("Tickets associated with the enhancement"),
  rev_score: z.number().optional().describe("Rev Score of the enhancement"),
  rev_score_tier: z.string().optional().describe("Rev Score tier of the enhancement"),
  release_notes: z.string().optional().describe("Release notes of the enhancement"),
  delivered_as: z.array(z.string()).optional().describe("Methods the product can be delivered as"),
  ref_url: z.string().optional().describe("URL to the part details (git url, website, etc.)"),
}).describe("DevRev Enhancement object")

export const featureSchema = baseDevRevObjectSchema.extend({
  name: z.string().describe("Name of the part"),
  description: z.string().optional().describe("Description of the part"),
  parent_part: z.string().describe("Parent of this part"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the part"),
  development_owner_id: z.string().optional().describe("User ID of the development owner of the part"),
  pm_owner_id: z.string().optional().describe("User ID of the PM owner of the part"),
  qa_owner_id: z.string().optional().describe("User ID of the QA owner of the part"),
  part_of_part_id: z.string().optional().describe("Capability ID or Parent Feature ID of this feature"),
  fulfilled_by: z.array(z.string()).optional().describe("IDs of the runnables that fulfill this feature"),
  delivered_as: z.array(z.string()).optional().describe("Methods the product can be delivered as"),
  ref_url: z.string().optional().describe("URL to the part details (git url, website, etc.)"),
  api_endpoints: z.array(z.record(z.any())).optional().describe("Associated API endpoints"),
  api_parameters_summary: z.array(z.string()).optional().describe("Associated API parameters"),
  api_prefix_summary: z.array(z.string()).optional().describe("Common Path Denominators of the Api Operations"),
  discoveryevidences: z.array(z.string()).optional().describe("A evidences that the inferer were able to find"),
}).describe("DevRev Feature object")

export const groupSchema = baseDevRevObjectSchema.extend({
  name: z.string().describe("Name of the group"),
  description: z.string().describe("Description of the group"),
  member_type: userTypeEnum.optional().describe("Type of the members in the group"),
  type: groupTypeEnum.optional().describe("Type of the group"),
  includes: z.array(z.string()).optional().describe("IDs of the group(s) that the group includes"),
  owner: z.string().optional().describe("Owner of the group"),
}).describe("DevRev Group object")

export const incidentSchema = baseDevRevObjectSchema.extend({
  title: z.string().describe("Title of the work object"),
  body: z.string().optional().describe("Body of the work object"),
  severity: severityEnum.describe("Severity of the work"),
  stage: z.enum(["new", "in_progress", "resolved", "closed"]).describe("Stage of the incident"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the work"),
  target_close_date: z.string().optional().describe("Timestamp when the work is expected to be complete"),
  applies_to_part_ids: z.array(z.string()).optional().describe("Parts to which the work is attached"),
  acknowledged_date: z.string().optional().describe("Timestamp when the incident was acknowledged"),
  identified_date: z.string().optional().describe("Time when the incident was identified/reported"),
  mitigated_date: z.string().optional().describe("Timestamp when the incident was mitigated"),
  reported_by: z.string().optional().describe("The entity that first reported the incident"),
  pia_ids: z.array(z.string()).optional().describe("The article ids of the Post-Incident Analysis(PIA)"),
  playbook_ids: z.array(z.string()).optional().describe("The article ids of the playbook(s)"),
  related_doc_ids: z.array(z.string()).optional().describe("The article ids of other documents"),
}).describe("DevRev Incident object")

export const issueSchema = baseDevRevObjectSchema.extend({
  title: z.string().describe("Title of the work object"),
  body: z.string().optional().describe("Body of the work object"),
  applies_to_part_id: z.string().describe("Details of the part relevant to the work"),
  priority: priorityEnum.describe("Priority of the work based upon impact and criticality"),
  stage: z.enum(["open", "in_progress", "fixed", "closed"]).describe("Stage of the object"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the work"),
  reported_by_ids: z.array(z.string()).optional().describe("User IDs of the users that reported the work"),
  actual_close_date: z.string().optional().describe("Timestamp when the work was actually completed"),
  actual_effort: z.number().optional().describe("Actual effort to complete the issue"),
  estimated_effort: z.number().optional().describe("Estimated effort to complete the issue"),
  applies_to_version_ids: z.array(z.string()).optional().describe("Part versions relevant to the work"),
  release_version_ids: z.array(z.string()).optional().describe("Versions that will contain the resolving commit IDs"),
  account_ids: z.array(z.string()).optional().describe("Accounts associated to issues"),
  rev_org_ids: z.array(z.string()).optional().describe("Rev orgs associated to issues"),
  sprint_id: z.string().optional().describe("Sprint to which the issue belongs"),
  sla_id: z.string().optional().describe("The ID of the SLA applying to this object"),
  sla_tracker_id: z.string().optional().describe("The ID of the SLA tracker applied to this object"),
  target_close_date: z.string().optional().describe("Timestamp when the work is expected to be complete"),
  target_start_date: z.string().optional().describe("Target start date for the object"),
  fallback_parts: z.string().optional().describe("Other values that could serve as part"),
}).describe("DevRev Issue object")

export const linkSchema = baseDevRevObjectSchema.extend({
  link_type: z.string().describe("Type of link used to define the relationship"),
  source_id: z.string().describe("Source object ID"),
  target_id: z.string().describe("Target object ID"),
  source_object_type: z.string().optional().describe("Source object type"),
  target_object_type: z.string().optional().describe("Target object type"),
  transformed_from_id: z.string().optional().describe("Transformed from ID"),
}).describe("DevRev Link object")

export const linkableSchema = baseDevRevObjectSchema.extend({
  name: z.string().describe("Name of the part"),
  description: z.string().optional().describe("Description of the part"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the part"),
  kind: z.string().optional().describe("The kind of linkable"),
  parent_part: z.string().optional().describe("Parent of this part"),
  coderepo_paths: z.string().optional().describe("Paths in the repository for the code part"),
  coderepo_url: z.string().optional().describe("URL to the server & repo for the code part"),
  delivered_as: z.array(z.string()).optional().describe("Methods the product can be delivered as"),
  discoveryevidences: z.array(z.string()).optional().describe("A evidences that the inferer were able to find"),
  ref_url: z.string().optional().describe("URL to the part details (git url, website, etc.)"),
}).describe("DevRev Linkable object")

export const meetingSchema = baseDevRevObjectSchema.extend({
  title: z.string().describe("Title of the meeting object"),
  channel: z.string().describe("The channel of meeting"),
  organizer_id: z.string().describe("ID of the organizer of the meeting"),
  member_ids: z.array(z.string()).describe("IDs of the members in the meeting"),
  scheduled_date: z.string().describe("Time at which meeting was scheduled to start"),
  state: z.enum(["scheduled", "in_progress", "ended", "cancelled"]).describe("The state of meeting"),
  description: z.string().optional().describe("Description of the meeting"),
  ended_date: z.string().optional().describe("Time at which meeting ended"),
  engagement_new_ref: z.string().optional().describe("Reference ID associated with the new engagement"),
  external_ref_id: z.string().optional().describe("External reference of the meeting"),
  external_url: z.string().optional().describe("External URL associated with the meeting"),
  parent_id: z.string().optional().describe("Parent ID of the meeting"),
  parent_object_type: z.string().optional().describe("Parent Object Type"),
  recording_url: z.string().optional().describe("Recording URL of the meeting"),
}).describe("DevRev Meeting object")

export const microserviceSchema = baseDevRevObjectSchema.extend({
  name: z.string().describe("Name of the part"),
  description: z.string().optional().describe("Description of the part"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the part"),
  development_owner_id: z.string().optional().describe("User ID of the development owner of the part"),
  pm_owner_id: z.string().optional().describe("User ID of the PM owner of the part"),
  qa_owner_id: z.string().optional().describe("User ID of the QA owner of the part"),
  parent_part: z.string().optional().describe("Parent of this part"),
  delivered_as: z.array(z.string()).optional().describe("Methods the product can be delivered as"),
  ref_url: z.string().optional().describe("URL to the part details (git url, website, etc.)"),
}).describe("DevRev Microservice object")

export const objectMemberSchema = baseDevRevObjectSchema.extend({
  member_id: z.string().describe("ID of the user or group"),
  object_id: z.string().describe("Globally unique DevRev Object Name (DON) for the object"),
  target_object_type: z.string().describe("Type of target object"),
  valid_from_date: z.string().describe("Timestamp when this membership is valid"),
  valid_to_date: z.string().optional().describe("Timestamp when this membership expires"),
  conditional_role_id: z.string().optional().describe("Conditional Role that entails the permissions of the member"),
  role_id: z.string().optional().describe("Role that entails the permissions of the member"),
}).describe("DevRev Object Member")

export const opportunitySchema = baseDevRevObjectSchema.extend({
  title: z.string().describe("Title of the work object"),
  body: z.string().optional().describe("Body of the work object"),
  account_id: z.string().optional().describe("ID of the account that the opportunity is related to"),
  amount: z.number().optional().describe("Total opportunity amount"),
  stage: z.enum(["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"]).describe("Stage of the object"),
  priority: priorityEnum.describe("Priority of the opportunity"),
  forecast_category: z.enum(["committed", "best_case", "pipeline", "omitted"]).describe("Forecast category of the opportunity"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the work"),
  actual_close_date: z.string().optional().describe("Timestamp when the work was actually completed"),
  annual_contract_value: z.record(z.any()).optional().describe("Annual contract value of the opportunity"),
  annual_recurring_revenue: z.number().optional().describe("Annual recurring revenue of the opportunity"),
  budget: z.record(z.any()).optional().describe("Budget of the opportunity"),
  contact_ids: z.array(z.string()).optional().describe("Contacts involved in the opportunity"),
  customer_budget: z.number().optional().describe("Budget of the customer"),
  probability: z.number().optional().describe("Probability of winning the deal, value lies between 0.0% and 100.0%"),
  reported_by_ids: z.array(z.string()).optional().describe("User IDs of the users that reported the work"),
  target_close_date: z.string().optional().describe("Timestamp when the work is expected to be complete"),
  value: z.record(z.any()).optional().describe("Value of the opportunity"),
  fallback_parts: z.string().optional().describe("Other values that could serve as part"),
}).describe("DevRev Opportunity object")

export const productSchema = baseDevRevObjectSchema.extend({
  name: z.string().describe("Name of the part"),
  description: z.string().optional().describe("Description of the part"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the part"),
  pm_owner_id: z.string().optional().describe("User ID of the PM owner of the part"),
  delivered_as: z.array(z.string()).optional().describe("Methods the product can be delivered as"),
  fulfilled_by: z.array(z.string()).optional().describe("IDs of the runnables that fulfill this product"),
  product_delivered_as: z.string().optional().describe("Product Delivered as"),
  ref_url: z.string().optional().describe("URL to the part details (git url, website, etc.)"),
}).describe("DevRev Product object")

export const revuSchema = baseDevRevObjectSchema.extend({
  display_name: z.string().describe("The user's display name. The name is non-unique and mutable"),
  email: z.string().optional().describe("Email address of the user"),
  full_name: z.string().optional().describe("Full name of the user"),
  external_uid: z.string().optional().describe("External ref is a mutable unique identifier for a user"),
  rev_org: z.string().optional().describe("The ID of the parent Rev Organization"),
  state: stateEnum.optional().describe("State of the user"),
  description: z.string().optional().describe("Description of the Rev user"),
  display_handle: z.string().optional().describe("The user's display handle. This field is deprecated"),
  display_picture: z.string().optional().describe("Artifact ID of the user's display picture"),
  phone_numbers: z.array(z.string()).optional().describe("Phone numbers of the user"),
  user_type: z.string().optional().describe("Type of the user"),
}).describe("DevRev Rev User object")

export const runnableSchema = baseDevRevObjectSchema.extend({
  name: z.string().describe("Name of the part"),
  description: z.string().optional().describe("Description of the part"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the part"),
  kind: z.string().optional().describe("The kind of runnable"),
  parent_part: z.string().optional().describe("Parent of this part"),
  coderepo_paths: z.string().optional().describe("Paths in the repository for the code part"),
  coderepo_url: z.string().optional().describe("URL to the server & repo for the code part"),
  delivered_as: z.array(z.string()).optional().describe("Methods the product can be delivered as"),
  discoveryevidences: z.array(z.string()).optional().describe("A evidences that the inferer were able to find"),
  ref_url: z.string().optional().describe("URL to the part details (git url, website, etc.)"),
}).describe("DevRev Runnable object")

export const sysuSchema = baseDevRevObjectSchema.extend({
  display_name: z.string().describe("The user's display name. The name is non-unique and mutable"),
  full_name: z.string().optional().describe("Full name of the user"),
  state: stateEnum.optional().describe("State of the user"),
}).describe("DevRev System User object")

export const tagSchema = baseDevRevObjectSchema.extend({
  name: z.string().describe("Name of the tag"),
  description: z.string().optional().describe("Description of the tag"),
  style: z.string().optional().describe("hex color of in the format #RRGGBB"),
  access_level: accessLevelEnum.optional().describe("Access level for the tag"),
}).describe("DevRev Tag object")

export const taskSchema = baseDevRevObjectSchema.extend({
  title: z.string().describe("Title of the work object"),
  body: z.string().optional().describe("Body of the work object"),
  stage: z.enum(["open", "in_progress", "done"]).describe("Stage of the object"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the work"),
  target_close_date: z.string().optional().describe("Timestamp when the work is expected to be complete"),
  estimated_effort: z.number().optional().describe("Estimated effort to complete the task"),
  actual_effort: z.number().optional().describe("Actual effort to complete the task"),
  actual_close_date: z.string().optional().describe("Timestamp when the work was actually completed"),
  applies_to_part_id: z.string().optional().describe("Details of the part relevant to the work"),
  applies_to_version_ids: z.array(z.string()).optional().describe("Part versions relevant to the work"),
  embedded: z.boolean().optional().describe("Whether this task is an embedded task of another work or not"),
  priority: priorityEnum.optional().describe("Priority of the work based upon impact and criticality"),
  reported_by_ids: z.array(z.string()).optional().describe("User IDs of the users that reported the work"),
  start_date: z.string().optional().describe("Timestamp when the task was started"),
  fallback_parts: z.string().optional().describe("Other values that could serve as part"),
}).describe("DevRev Task object")

export const testCustomTypeSchema = baseDevRevObjectSchema.extend({
  title: z.string().optional().describe("Title of the custom object"),
}).describe("Test custom object type for testing purposes")

export const ticketSchema = baseDevRevObjectSchema.extend({
  title: z.string().describe("Title of the work object"),
  body: z.string().optional().describe("Body of the work object"),
  applies_to_part_id: z.string().describe("Details of the part relevant to the work"),
  severity: severityEnum.describe("Severity of the ticket"),
  stage: z.enum(["new", "in_progress", "resolved", "closed"]).describe("Stage of the object"),
  owned_by_ids: z.array(z.string()).describe("User IDs of the users that own the work"),
  account_id: z.string().optional().describe("Globally unique ID for a DevRev account"),
  needs_response: z.boolean().optional().describe("Whether the ticket needs a response"),
}).describe("DevRev Ticket object")

// =============================================================================
// Schema Map and Union Types
// =============================================================================

export const devRevObjectSchemas = {
  account: accountSchema,
  airdrop_authorization_policy: airdropAuthorizationPolicySchema,
  airdrop_platform_group: airdropPlatformGroupSchema,
  article: articleSchema,
  capability: capabilitySchema,
  channel: channelSchema,
  comment: commentSchema,
  component: componentSchema,
  conversation: conversationSchema,
  custom_link: customLinkSchema,
  custom_part: customPartSchema,
  devu: devuSchema,
  directory: directorySchema,
  dm: dmSchema,
  enhancement: enhancementSchema,
  feature: featureSchema,
  group: groupSchema,
  incident: incidentSchema,
  issue: issueSchema,
  link: linkSchema,
  linkable: linkableSchema,
  meeting: meetingSchema,
  microservice: microserviceSchema,
  object_member: objectMemberSchema,
  opportunity: opportunitySchema,
  product: productSchema,
  revu: revuSchema,
  runnable: runnableSchema,
  sysu: sysuSchema,
  tag: tagSchema,
  task: taskSchema,
  test_custom_type: testCustomTypeSchema,
  ticket: ticketSchema,
} as const

// Create discriminated union based on object type
export const devRevObjectSchema = z.discriminatedUnion("object_type", [
  accountSchema.extend({ object_type: z.literal("account") }),
  airdropAuthorizationPolicySchema.extend({ object_type: z.literal("airdrop_authorization_policy") }),
  airdropPlatformGroupSchema.extend({ object_type: z.literal("airdrop_platform_group") }),
  articleSchema.extend({ object_type: z.literal("article") }),
  capabilitySchema.extend({ object_type: z.literal("capability") }),
  channelSchema.extend({ object_type: z.literal("channel") }),
  commentSchema.extend({ object_type: z.literal("comment") }),
  componentSchema.extend({ object_type: z.literal("component") }),
  conversationSchema.extend({ object_type: z.literal("conversation") }),
  customLinkSchema.extend({ object_type: z.literal("custom_link") }),
  customPartSchema.extend({ object_type: z.literal("custom_part") }),
  devuSchema.extend({ object_type: z.literal("devu") }),
  directorySchema.extend({ object_type: z.literal("directory") }),
  dmSchema.extend({ object_type: z.literal("dm") }),
  enhancementSchema.extend({ object_type: z.literal("enhancement") }),
  featureSchema.extend({ object_type: z.literal("feature") }),
  groupSchema.extend({ object_type: z.literal("group") }),
  incidentSchema.extend({ object_type: z.literal("incident") }),
  issueSchema.extend({ object_type: z.literal("issue") }),
  linkSchema.extend({ object_type: z.literal("link") }),
  linkableSchema.extend({ object_type: z.literal("linkable") }),
  meetingSchema.extend({ object_type: z.literal("meeting") }),
  microserviceSchema.extend({ object_type: z.literal("microservice") }),
  objectMemberSchema.extend({ object_type: z.literal("object_member") }),
  opportunitySchema.extend({ object_type: z.literal("opportunity") }),
  productSchema.extend({ object_type: z.literal("product") }),
  revuSchema.extend({ object_type: z.literal("revu") }),
  runnableSchema.extend({ object_type: z.literal("runnable") }),
  sysuSchema.extend({ object_type: z.literal("sysu") }),
  tagSchema.extend({ object_type: z.literal("tag") }),
  taskSchema.extend({ object_type: z.literal("task") }),
  testCustomTypeSchema.extend({ object_type: z.literal("test_custom_type") }),
  ticketSchema.extend({ object_type: z.literal("ticket") }),
])

// =============================================================================
// TypeScript Types (inferred from Zod schemas)
// =============================================================================

export type BaseDevRevObject = z.infer<typeof baseDevRevObjectSchema>
export type Account = z.infer<typeof accountSchema>
export type AirdropAuthorizationPolicy = z.infer<typeof airdropAuthorizationPolicySchema>
export type AirdropPlatformGroup = z.infer<typeof airdropPlatformGroupSchema>
export type Article = z.infer<typeof articleSchema>
export type Capability = z.infer<typeof capabilitySchema>
export type Channel = z.infer<typeof channelSchema>
export type Comment = z.infer<typeof commentSchema>
export type Component = z.infer<typeof componentSchema>
export type Conversation = z.infer<typeof conversationSchema>
export type CustomLink = z.infer<typeof customLinkSchema>
export type CustomPart = z.infer<typeof customPartSchema>
export type Devu = z.infer<typeof devuSchema>
export type Directory = z.infer<typeof directorySchema>
export type Dm = z.infer<typeof dmSchema>
export type Enhancement = z.infer<typeof enhancementSchema>
export type Feature = z.infer<typeof featureSchema>
export type Group = z.infer<typeof groupSchema>
export type Incident = z.infer<typeof incidentSchema>
export type Issue = z.infer<typeof issueSchema>
export type Link = z.infer<typeof linkSchema>
export type Linkable = z.infer<typeof linkableSchema>
export type Meeting = z.infer<typeof meetingSchema>
export type Microservice = z.infer<typeof microserviceSchema>
export type ObjectMember = z.infer<typeof objectMemberSchema>
export type Opportunity = z.infer<typeof opportunitySchema>
export type Product = z.infer<typeof productSchema>
export type Revu = z.infer<typeof revuSchema>
export type Runnable = z.infer<typeof runnableSchema>
export type Sysu = z.infer<typeof sysuSchema>
export type Tag = z.infer<typeof tagSchema>
export type Task = z.infer<typeof taskSchema>
export type TestCustomType = z.infer<typeof testCustomTypeSchema>
export type Ticket = z.infer<typeof ticketSchema>

export type DevRevObject = z.infer<typeof devRevObjectSchema>
export type DevRevObjectType = keyof typeof devRevObjectSchemas

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get schema for a specific DevRev object type
 */
export function getDevRevObjectSchema(objectType: DevRevObjectType) {
  return devRevObjectSchemas[objectType]
}

/**
 * Validate a DevRev object against its schema
 */
export function validateDevRevObject(objectType: DevRevObjectType, data: unknown) {
  const schema = getDevRevObjectSchema(objectType)
  return schema.safeParse(data)
}

/**
 * Get all supported DevRev object types
 */
export function getSupportedDevRevObjectTypes(): DevRevObjectType[] {
  return Object.keys(devRevObjectSchemas) as DevRevObjectType[]
}

/**
 * Check if an object type is supported
 */
export function isValidDevRevObjectType(objectType: string): objectType is DevRevObjectType {
  return objectType in devRevObjectSchemas
} 