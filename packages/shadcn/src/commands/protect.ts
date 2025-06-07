import path from "path"
import { Command } from "commander"
import { handleError } from "@/src/utils/handle-error"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import { PROTECTED_FILES } from "@/src/utils/file-protection/protect-files"
import { makeReadOnly, makeWritable, getProtectionStatus } from "@/src/utils/protect"
import { updateVSCodeReadonlySettings, hasVSCodeSettings } from "@/src/utils/vscode-settings"

export const protect = new Command()
  .name("protect")
  .description("toggle read-only mode for critical project files")
  .option("--on", "enable protection (make files read-only)")
  .option("--off", "disable protection (make files writable)")
  .option("--status", "show current protection status of files")
  .option("--skip-vscode", "skip updating VS Code settings")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts) => {
    try {
      const cwd = path.resolve(opts.cwd)
      const protectedFiles = [...PROTECTED_FILES] // Convert readonly to mutable array
      
      // Show status if requested
      if (opts.status) {
        const status = getProtectionStatus(protectedFiles, cwd)
        
        logger.info("📊 File Protection Status:")
        logger.break()
        
        if (status.protectedFiles.length > 0) {
          logger.info(`${highlighter.success("🔒 Protected files:")} ${status.protectedFiles.length}`)
          status.protectedFiles.forEach(file => {
            logger.info(`  ✅ ${file}`)
          })
          logger.break()
        }
        
        if (status.unprotectedFiles.length > 0) {
          logger.info(`${highlighter.info("🔓 Unprotected files:")} ${status.unprotectedFiles.length}`)
          status.unprotectedFiles.forEach(file => {
            logger.info(`  📝 ${file}`)
          })
          logger.break()
        }
        
        if (status.missingFiles.length > 0) {
          logger.info(`${highlighter.warn("❓ Missing files:")} ${status.missingFiles.length}`)
          status.missingFiles.forEach(file => {
            logger.info(`  ⚠️  ${file}`)
          })
          logger.break()
        }
        
        // Show VS Code settings status
        if (hasVSCodeSettings(cwd)) {
          logger.info(`${highlighter.info("VS Code:")} settings.json exists`)
        } else {
          logger.info(`${highlighter.warn("VS Code:")} no settings.json found`)
        }
        
        return
      }

      // Require either --on or --off
      if (!opts.on && !opts.off) {
        logger.error("Please specify either --on to enable protection or --off to disable protection.")
        logger.info("Use --status to see current protection status.")
        process.exit(1)
      }

      if (opts.on && opts.off) {
        logger.error("Cannot specify both --on and --off at the same time.")
        process.exit(1)
      }

      const enableProtection = opts.on
      const protectSpinner = spinner(
        enableProtection 
          ? "Enabling file protection..." 
          : "Disabling file protection..."
      ).start()

      // Apply file system protection
      const result = enableProtection 
        ? makeReadOnly(protectedFiles, cwd)
        : makeWritable(protectedFiles, cwd)

      // Update VS Code settings unless skipped
      let vscodeResult = { success: true }
      if (!opts.skipVscode) {
        vscodeResult = updateVSCodeReadonlySettings(protectedFiles, cwd, enableProtection)
      }

      protectSpinner.succeed()

      // Report results
      if (result.success.length > 0) {
        const action = enableProtection ? "protected" : "unprotected"
        logger.log(`${highlighter.success("Success!")} ${result.success.length} files ${action}.`)
        
        if (result.success.length <= 5) {
          result.success.forEach(file => {
            logger.info(`  ${enableProtection ? '🔒' : '🔓'} ${file}`)
          })
        } else {
          logger.info(`  Files: ${result.success.slice(0, 3).join(', ')}... and ${result.success.length - 3} more`)
        }
      }

      if (result.failed.length > 0) {
        logger.warn(`${result.failed.length} files could not be processed:`)
        result.failed.forEach(file => {
          logger.warn(`  ❌ ${file}`)
        })
      }

      // VS Code settings feedback
      if (!opts.skipVscode) {
        if (vscodeResult.success) {
          logger.info(`${highlighter.success("VS Code:")} settings updated successfully`)
        } else {
          logger.warn(`${highlighter.warn("VS Code:")} ${'error' in vscodeResult ? vscodeResult.error : 'Unknown error'}`)
        }
      }

      logger.break()
      if (enableProtection) {
        logger.info("💡 Files are now read-only. Use --off to make them writable again.")
      } else {
        logger.info("💡 Files are now writable. Use --on to protect them again.")
      }

    } catch (error) {
      logger.break()
      handleError(error)
    }
  })
