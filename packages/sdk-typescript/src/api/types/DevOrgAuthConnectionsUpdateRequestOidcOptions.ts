/**
 * This file was auto-generated by Fern from our API Definition.
 */

/**
 * Object encapsulating the configuration parameters for an OIDC
 * authentication connection.
 */
export interface DevOrgAuthConnectionsUpdateRequestOidcOptions {
    /** Client ID for the OIDC authentication connection. */
    clientId?: string;
    /** Client secret for the OIDC authentication connection. */
    clientSecret?: string;
    /** Issuer URL of the OIDC authentication connection. */
    issuer?: string;
}
