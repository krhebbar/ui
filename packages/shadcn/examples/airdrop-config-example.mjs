/** @type {import('../types/snapin-config').AirdropProjectConfig} */
export default {
  projectType: "airdrop",
  syncDirection: "two-way",
  devrevObjects: ["account"],
  externalSystem: {
    name: "Enter your external system name",
    slug: "airdrop-enter-your-external-system-name",
    apiBaseUrl: "https://api.example.com/v1", // Used when accessMethod is "api"
    testEndpoint: "https://api.example.com/v1/me", // Used when accessMethod is "api"
    documentationUrl: "https://docs.example.com", // New: URL for the external system's documentation
    externalObjects: [], // Renamed from supportedObjects
    accessMethod: "api", // New: "sdk" or "api"
    // sdkBaseUrl: "https://sdk.example.com/v1", // New: Used when accessMethod is "sdk"
    // sdkPackages: ["example-sdk-package"], // New: Used when accessMethod is "sdk"
    isComplete: false, // New: true if configuration is complete and not using example.com URLs

    connection: { // Moved from top level
      type: "oauth2",
      id: "airdrop-enter-your-external-system-name-oauth2",
      clientId: process.env.AIRDROP_ENTER_YOUR_EXTERNAL_SYSTEM_NAME_CLIENT_ID,
      clientSecret: process.env.AIRDROP_ENTER_YOUR_EXTERNAL_SYSTEM_NAME_CLIENT_SECRET,
      authorize: {
        url: "https://api.example.com/v1/oauth/authorize",
        tokenUrl: "https://api.example.com/v1/oauth/token",
        grantType: "authorization_code",
        scope: "read write api",
        scopeDelimiter: " "
      },
      refresh: {
        url: "https://api.example.com/v1/oauth/token",
        method: "POST"
      },
      revoke: {
        url: "https://api.example.com/v1/oauth/revoke",
        method: "POST"
      }
    }
  }
};
