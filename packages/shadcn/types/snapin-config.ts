// Airdrop configuration types
export interface AirdropProjectConfig {
  projectType: "airdrop" | "snap-in";
  syncDirection?: "one-way" | "two-way";
  devrevObjects: string[]; // This is not optional in Zod, can be empty
  externalSyncUnits?: string[];

  externalSystem?: {
    name: string;
    slug: string;
    apiBaseUrl: string; // Primarily for accessMethod: "api"
    testEndpoint: string; // Primarily for accessMethod: "api"
    externalObjects: string[]; // Renamed from supportedObjects
    accessMethod: "sdk" | "api"; // new
    isComplete?: boolean; // new
    documentationUrl?: string; // new
    sdkBaseUrl?: string; // new, for accessMethod: "sdk"
    sdkPackages?: string[]; // new, for accessMethod: "sdk"
    connection: { // Moved from top level
      type: string; // If connection object exists, type is mandatory
      id: string;
      clientId?: string;
      clientSecret?: string;
      authorize?: { url: string; tokenUrl: string; grantType: string; scope: string; scopeDelimiter: string; };
      refresh?: { url: string; method: string; };
      revoke?: { url: string; method: string; };
      isSubdomain?: boolean;
      subdomain?: string;
      secretTransform?: string;
      tokenVerification?: { url: string; method: string; headers?: Record<string, string>; };
      fields?: Array<{ id: string; name: string; description: string; }>;
      [key: string]: any;
    };
  };
}
