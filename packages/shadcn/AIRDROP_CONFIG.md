# Airdrop Configuration and Type System

This system provides configuration and type infrastructure for Airdrop projects.

## Key Features

- **Persistent configuration** via `airdrop.config.mjs`
- **Environment variable management** via `.env`
- **TypeScript type generation** for DevRev and external objects
- **OpenAPI integration** for DevRev API types
- **CLI commands** for configuration management

## File Structure

```
project-root/
├── airdrop.config.mjs          # Main configuration file
├── .env                        # Environment variables (not committed)
├── types/
│   ├── airdrop-config.ts       # Configuration type definitions
│   ├── airdrop.d.ts            # Generated DevRev & external types
│   └── devrev/
│       └── api.d.ts            # Generated DevRev API types
└── openapi.yml                 # Optional: DevRev API specification
```

## CLI Commands

### Initialize Project
```bash
npx shadcn init                 # Interactive setup
npx shadcn init --yes           # Silent setup with defaults
```

### Manage Configuration
```bash
npx shadcn config show          # Show current configuration
npx shadcn config add-devrev ticket issue    # Add DevRev objects
npx shadcn config add-external projects      # Add external sync units
npx shadcn config types         # Regenerate type definitions
```

## Configuration Example

```javascript
/** @type {import('./types/airdrop-config').AirdropProjectConfig} */
export default {
  projectType: "airdrop",
  syncDirection: "two-way",
  devrevObjects: ["dm", "revu", "tag", "ticket"],
  externalSyncUnits: ["issues", "merge_requests"],
  externalSystem: {
    name: "GitLab",
    slug: "gitlab",
    apiBaseUrl: "https://gitlab.com/api/v4",
    testEndpoint: "https://gitlab.com/api/v4/user",
    supportedObjects: ["issues", "merge_requests"],
  },
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
```

## Environment Variables

```bash
GITLAB_CLIENT_ID=your-client-id
GITLAB_CLIENT_SECRET=your-client-secret
```

## Generated Types

The system automatically generates TypeScript definitions for better development experience and type safety. 