sequenceDiagram
    participant User
    participant CLI as init.ts
    participant Orchestrator as init/index.ts
    participant Preflight as preflight-init.ts
    participant ConfigGather as init-config-gathering.ts
    participant Utils as init-utils.ts
    participant TemplateClone as init-template-cloning.ts
    participant FileGen as init-file-generation.ts
    participant EnvMgmt as init-env-management.ts
    participant SnapInConfig as airdrop-config.ts

    User->>CLI: devrev init [options]
    CLI->>CLI: Parse options & validate
    CLI->>Orchestrator: runInit(options)
    
    Note over Orchestrator: Phase 1: Preflight & Project State Detection
    Orchestrator->>Preflight: preFlightInit(options)
    Preflight->>Preflight: Check directory exists/create if needed
    Preflight->>Preflight: Find project root
    Preflight->>Preflight: Check manifest.yml/yaml exists
    Preflight->>Preflight: Check code/ directory exists
    Preflight-->>Orchestrator: {errors, projectRootPath, isExistingProjectStructure, manifestFileExists}
    
    Orchestrator->>Orchestrator: Adjust options.isNewProject based on preflight results
    
    Note over Orchestrator: Phase 2: Manifest Overwrite Handling
    alt manifestFileExists && !force
        alt !yes (interactive mode)
            Orchestrator->>User: Prompt: Overwrite existing manifest.yaml?
            User-->>Orchestrator: overwriteManifest (true/false)
        else yes mode
            Orchestrator->>Orchestrator: Skip overwrite due to --yes without --force
        end
    end
    
    Note over Orchestrator: Phase 3: Configuration Gathering with Auto-detection
    Orchestrator->>ConfigGather: gatherAirdropConfiguration(options)
    ConfigGather->>Utils: isProjectInitialized(cwd)
    Utils-->>ConfigGather: boolean
    ConfigGather->>Utils: autoDetectProjectType(cwd)
    Utils-->>ConfigGather: 'airdrop' | 'snap-in' | null
    
    alt isInitialized
        ConfigGather->>Utils: readExistingManifest(cwd)
        Utils-->>ConfigGather: Partial<AirdropProjectConfig> | null
        ConfigGather->>Utils: readExistingSnapInConfig(cwd)
        Utils->>SnapInConfig: getSnapInConfig(cwd)
        SnapInConfig-->>Utils: {validatedConfig, rawConfig, error}
        Utils-->>ConfigGather: Partial<AirdropProjectConfig> | null
    end
    
    alt silent || yes mode
        ConfigGather->>Utils: mergeExistingConfigurations(manifest, snapIn, defaults)
        Utils-->>ConfigGather: AirdropProjectConfig
    else interactive mode
        alt autoDetectedType
            ConfigGather->>User: Confirm auto-detected project type?
            User-->>ConfigGather: confirmation
        else no auto-detection
            ConfigGather->>User: Select project type (airdrop/snap-in)
            User-->>ConfigGather: projectType
        end
        
        alt projectType === 'airdrop'
            ConfigGather->>ConfigGather: gatherAirdropProjectConfiguration()
            ConfigGather->>User: Prompts with existing values as defaults
            User-->>ConfigGather: Project configuration
        else projectType === 'snap-in'
            ConfigGather->>ConfigGather: gatherSnapInProjectConfiguration()
            alt !isInitialized
                ConfigGather->>User: Select snap-in template
                User-->>ConfigGather: selectedTemplate
            end
            ConfigGather->>User: Prompts with existing values as defaults
            User-->>ConfigGather: Project configuration
        end
    end
    ConfigGather-->>Orchestrator: Complete configuration
    
    Note over Orchestrator: Phase 4: Template Cloning (New Projects Only)
    alt needsTemplateCloning (isNewProject && !manifestFileExists)
        Orchestrator->>Orchestrator: handleNewProjectSetup()
        alt projectName exists
            Orchestrator->>TemplateClone: createProjectDirectory(cwd, projectName)
            TemplateClone-->>Orchestrator: newProjectPath
        end
        
        alt selectedSnapInTemplateName || projectType === 'airdrop'
            Orchestrator->>TemplateClone: cloneProjectTemplate(type, path, template)
            TemplateClone->>TemplateClone: Determine template to use
            TemplateClone->>TemplateClone: Clone from git repository
            TemplateClone-->>Orchestrator: cloneSuccess
        else existing project
            Orchestrator->>Orchestrator: Skip template cloning
        end
    end
    
    Note over Orchestrator: Phase 5: Config Overwrite Handling
    Orchestrator->>SnapInConfig: hasSnapInConfig(cwd)
    SnapInConfig-->>Orchestrator: boolean
    alt hasExistingSnapInConfig && !force && !isNewProject
        alt !yes mode
            Orchestrator->>User: Overwrite existing snapin.config.mjs?
            User-->>Orchestrator: overwrite decision
        end
    end
    
    Note over Orchestrator: Phase 6: Project Files Generation
    Orchestrator->>Orchestrator: generateProjectFiles()
    
    par Write Configuration
        Orchestrator->>FileGen: writeProjectConfig(cwd, config)
        FileGen->>SnapInConfig: writeSnapInConfig(cwd, config)
        SnapInConfig-->>FileGen: Configuration written
    and Handle Environment Variables
        Orchestrator->>Utils: extractEnvVarsFromConfig(config)
        Utils-->>Orchestrator: envVars
        Orchestrator->>EnvMgmt: updateEnvFile(cwd, envVars)
        EnvMgmt-->>Orchestrator: .env updated
        Orchestrator->>EnvMgmt: validateAndWarnEnvVars(cwd, config)
        EnvMgmt-->>Orchestrator: Validation warnings
    and Generate Types
        Orchestrator->>FileGen: generateProjectTypes(cwd, config)
        FileGen-->>Orchestrator: Types generated
    and Update Manifest
        Orchestrator->>FileGen: updateManifestYaml(cwd, config, shouldGenerate, isNew)
        alt manifestExists
            FileGen->>FileGen: Read existing manifest
            FileGen->>FileGen: Update with new values
            FileGen->>FileGen: Write updated manifest
        else new manifest needed
            FileGen->>FileGen: Generate project-specific manifest
            FileGen->>FileGen: Write new manifest
        end
        FileGen-->>Orchestrator: Manifest updated/created
    end
    
    Orchestrator->>User: Success! Project initialization completed
    Orchestrator-->>CLI: Completion
    CLI->>User: Success message and instructions