graph TD
    A[Command Starts] --> B{Check .env vars}
    B -->|Missing/Placeholder| C[Report Error]
    B -->|Valid| D[Validate JWT Token]
    D -->|Valid| E[Execute Command]
    D -->|Expired| F[Re-authenticate]
    F -->|Success| G[Verify Token]
    F -->|Failed| H[Report Auth Error]
    G -->|Valid| E
    G -->|Still Invalid| H