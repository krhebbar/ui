graph TD
    A["runInit()"] --> B["preFlightInit()"]
    B --> C["Auto-detect project state"]
    C --> D{"Already initialized?<br/>(manifest.yaml exists)"}
    
    D -->|Yes| E["Read existing configs"]
    D -->|No| F["Set as new project"]
    
    E --> G["readExistingManifest()"]
    E --> H["readExistingSnapInConfig()"]
    G --> I["Auto-detect project type"]
    H --> I
    F --> I
    
    I --> J{"Project type detection"}
    J -->|"Folder starts with 'airdrop-'"| K["Set type: airdrop"]
    J -->|"Folder ends with '-snap-in'"| L["Set type: snap-in"]
    J -->|"No pattern match"| M["Show type selection prompt"]
    
    K --> N["gatherAirdropConfiguration()"]
    L --> N
    M --> N
    
    N --> O{"Pre-fill prompts?"}
    O -->|Yes| P["Use existing config values<br/>as prompt defaults"]
    O -->|No| Q["Use standard defaults"]
    
    P --> R["Show prompts with<br/>existing values"]
    Q --> R
    
    R --> S{"Need template cloning?"}
    S -->|"New project"| T["cloneProjectTemplate()"]
    S -->|"Existing project"| U["Skip template cloning"]
    
    T --> V["generateProjectFiles()"]
    U --> V
    
    V --> W["writeProjectConfig()"]
    V --> X["updateManifestYaml()"]
    V --> Y["generateProjectTypes()"]
    V --> Z["updateEnvFile()"]
    
    X --> AA{"Manifest exists?"}
    AA -->|Yes| BB["Update existing manifest<br/>with new values"]
    AA -->|No| CC["Create new manifest<br/>with project-specific content"]
    
    BB --> DD["Success!"]
    CC --> DD
    W --> DD
    Y --> DD
    Z --> DD
    
    style D fill:#e1f5fe
    style I fill:#e1f5fe
    style J fill:#fff3e0
    style S fill:#e8f5e8
    style AA fill:#fce4ec