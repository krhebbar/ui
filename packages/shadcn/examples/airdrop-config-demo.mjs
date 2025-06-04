/** @type {import('./types/airdrop-config').AirdropProjectConfig} */
export default {
  projectType: "airdrop",
  syncDirection: "two-way",

  // Selected DevRev objects to sync
  devrevObjects: ["dm", "revu", "tag", "ticket", "conversation"],

  // External sync units (dynamically mapped from external system)
  externalSyncUnits: ["issues", "merge_requests", "users"],

  externalSystem: {
    name: "GitLab",
    slug: "gitlab",
    apiBaseUrl: "https://gitlab.com/api/v4",
    testEndpoint: "https://gitlab.com/api/v4/user",
    supportedObjects: ["issues", "merge_requests", "users", "projects"],
  },

  // OAuth2 connection example (GitLab)
  connection: {
    type: "oauth2",
    id: "gitlab-oauth-connection",
    clientId: process.env.GITLAB_CLIENT_ID,
    clientSecret: process.env.GITLAB_CLIENT_SECRET,
    authorize: {
      url: "https://gitlab.com/oauth/authorize",
      tokenUrl: "https://gitlab.com/oauth/token",
      grantType: "authorization_code",
      scope: "read_api api",
      scopeDelimiter: " ",
    },
    refresh: {
      url: "https://gitlab.com/oauth/token",
      method: "POST",
    },
    revoke: {
      url: "https://gitlab.com/oauth/revoke",
      method: "POST",
    },
  },
} 