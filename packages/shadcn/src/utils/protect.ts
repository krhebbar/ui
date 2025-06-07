import fs from "fs"
import path from "path"
import { logger } from "@/src/utils/logger"

/**
 * Make files read-only (chmod 444)
 */
export function makeReadOnly(
  files: string[],
  root: string
): { success: string[]; failed: string[] } {
  const success: string[] = []
  const failed: string[] = []

  files.forEach((file) => {
    try {
      const filePath = path.join(root, file)

      // Check if file exists before trying to change permissions
      if (!fs.existsSync(filePath)) {
        logger.warn(`File not found, skipping: ${file}`)
        failed.push(file)
        return
      }

      fs.chmodSync(filePath, 0o444) // Read-only for owner, group, and others
      success.push(file)
    } catch (error) {
      logger.warn(`Failed to protect ${file}: ${(error as Error).message}`)
      failed.push(file)
    }
  })

  return { success, failed }
}

/**
 * Make files writable (chmod 644)
 */
export function makeWritable(
  files: string[],
  root: string
): { success: string[]; failed: string[] } {
  const success: string[] = []
  const failed: string[] = []

  files.forEach((file) => {
    try {
      const filePath = path.join(root, file)

      // Check if file exists before trying to change permissions
      if (!fs.existsSync(filePath)) {
        logger.warn(`File not found, skipping: ${file}`)
        failed.push(file)
        return
      }

      fs.chmodSync(filePath, 0o644) // Read-write for owner, read-only for group and others
      success.push(file)
    } catch (error) {
      logger.warn(`Failed to unprotect ${file}: ${(error as Error).message}`)
      failed.push(file)
    }
  })

  return { success, failed }
}

/**
 * Check if a file is currently read-only
 */
export function isReadOnly(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return false
    }

    const stats = fs.statSync(filePath)
    // Check if owner has write permission (bit 7, value 128)
    return (stats.mode & 0o200) === 0
  } catch (error) {
    return false
  }
}

/**
 * Get the protection status of files
 */
export function getProtectionStatus(
  files: string[],
  root: string
): {
  protectedFiles: string[]
  unprotectedFiles: string[]
  missingFiles: string[]
} {
  const protectedFiles: string[] = []
  const unprotectedFiles: string[] = []
  const missingFiles: string[] = []

  files.forEach((file) => {
    const filePath = path.join(root, file)

    if (!fs.existsSync(filePath)) {
      missingFiles.push(file)
    } else if (isReadOnly(filePath)) {
      protectedFiles.push(file)
    } else {
      unprotectedFiles.push(file)
    }
  })

  return { protectedFiles, unprotectedFiles, missingFiles }
}

/**
 * Temporarily make a protected file writable, execute an operation, then restore protection
 */
export async function withTemporaryWriteAccess<T>(
  filePath: string,
  operation: () => Promise<T>
): Promise<T> {
  const wasReadOnly = isReadOnly(filePath)

  if (wasReadOnly) {
    // Temporarily make writable
    fs.chmodSync(filePath, 0o644)
  }

  try {
    const result = await operation()
    return result
  } finally {
    if (wasReadOnly) {
      // Restore read-only protection
      fs.chmodSync(filePath, 0o444)
    }
  }
}

/**
 * Make a single file writable temporarily for CLI operations
 */
export function makeFileWritableIfProtected(filePath: string): boolean {
  if (fs.existsSync(filePath) && isReadOnly(filePath)) {
    try {
      fs.chmodSync(filePath, 0o644)
      return true // Was protected, now made writable
    } catch (error) {
      logger.warn(
        `Failed to make ${filePath} writable: ${(error as Error).message}`
      )
      return false
    }
  }
  return false // Was already writable
}

/**
 * Restore protection to a file
 */
export function restoreFileProtection(filePath: string): void {
  if (fs.existsSync(filePath)) {
    try {
      fs.chmodSync(filePath, 0o444)
    } catch (error) {
      logger.warn(
        `Failed to restore protection to ${filePath}: ${
          (error as Error).message
        }`
      )
    }
  }
}
