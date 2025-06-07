import fs from "fs"
import path from "path"
import { logger } from "@/src/utils/logger"

interface VSCodeSettings {
  "files.readonlyInclude"?: Record<string, boolean>
  [key: string]: any
}

/**
 * Update VS Code settings to reflect read-only status of files
 */
export function updateVSCodeReadonlySettings(
  files: string[],
  root: string,
  enable: boolean
): { success: boolean; error?: string } {
  try {
    const vscodeDir = path.join(root, '.vscode')
    const settingsPath = path.join(vscodeDir, 'settings.json')
    
    let settings: VSCodeSettings = {}

    // Create .vscode directory if it doesn't exist
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true })
      logger.info("Created .vscode directory")
    }

    // Read existing settings if the file exists
    if (fs.existsSync(settingsPath)) {
      try {
        const settingsContent = fs.readFileSync(settingsPath, 'utf-8')
        settings = JSON.parse(settingsContent)
      } catch (parseError) {
        logger.warn("Failed to parse existing VS Code settings, creating new ones")
        settings = {}
      }
    }

    // Initialize files.readonlyInclude if it doesn't exist
    if (!settings["files.readonlyInclude"]) {
      settings["files.readonlyInclude"] = {}
    }

    // Update readonly settings for each file
    files.forEach(file => {
      if (enable) {
        settings["files.readonlyInclude"]![file] = true
      } else {
        // Remove the entry when disabling protection
        delete settings["files.readonlyInclude"]![file]
      }
    })

    // Clean up empty objects
    if (Object.keys(settings["files.readonlyInclude"]!).length === 0) {
      delete settings["files.readonlyInclude"]
    }

    // Write updated settings back to file
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
    
    return { success: true }
  } catch (error) {
    const errorMessage = `Failed to update VS Code settings: ${(error as Error).message}`
    logger.warn(errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Get the current VS Code readonly settings for files
 */
export function getVSCodeReadonlySettings(root: string): Record<string, boolean> {
  try {
    const settingsPath = path.join(root, '.vscode', 'settings.json')
    
    if (!fs.existsSync(settingsPath)) {
      return {}
    }

    const settingsContent = fs.readFileSync(settingsPath, 'utf-8')
    const settings: VSCodeSettings = JSON.parse(settingsContent)
    
    return settings["files.readonlyInclude"] || {}
  } catch (error) {
    logger.warn(`Failed to read VS Code settings: ${(error as Error).message}`)
    return {}
  }
}

/**
 * Check if VS Code settings exist
 */
export function hasVSCodeSettings(root: string): boolean {
  const settingsPath = path.join(root, '.vscode', 'settings.json')
  return fs.existsSync(settingsPath)
} 