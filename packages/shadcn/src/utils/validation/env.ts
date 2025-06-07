import fs from "fs-extra";
import path from "path";
import { logger } from "@/src/utils/logger"; // Adjust path if necessary
import { ENV_FILE, DEFAULT_ENV_CONTENT } from "@/src/utils/validation/constants"; // Adjust path
import prompts from "prompts";

export interface EnvValidationResult {
  isValid: boolean;
  summary: string;
  issues: string[];
  envPath?: string;
}

const REQUIRED_ENV_VARS = ["DEV_ORG", "USER_IMAIL"];

async function validateEnv(
  projectRootPath: string | null,
  attemptFix: boolean
): Promise<EnvValidationResult> {
  const result: EnvValidationResult = {
    isValid: true,
    summary: "",
    issues: [],
  };

  if (!projectRootPath) {
    result.isValid = false; // Cannot check .env without a project root
    result.summary = "Cannot validate .env file: Project root not identified.";
    result.issues.push("Project root not identified.");
    return result;
  }

  result.envPath = path.join(projectRootPath, ENV_FILE);

  if (!(await fs.pathExists(result.envPath))) {
    result.isValid = false;
    const message = `.env file is missing at ${result.envPath}.`;
    result.issues.push(message);

    if (attemptFix) {
      logger.info(`Attempting to fix: Creating ${ENV_FILE}...`);
      try {
        const { confirmCreate } = await prompts({
          type: "confirm",
          name: "confirmCreate",
          message: `Project root is ${projectRootPath}. No ${ENV_FILE} found. Create one with default placeholders?`,
          initial: true,
        });
        if (confirmCreate) {
          await fs.writeFile(result.envPath, DEFAULT_ENV_CONTENT);
          logger.success(`Created ${ENV_FILE} at ${result.envPath} with default values.`);
          logger.warn(`Please update ${ENV_FILE} with your actual DEV_ORG and USER_IMAIL.`);
          result.summary = `Created ${ENV_FILE} with defaults. Please review and update it.`;
          // Since it's created but needs user action, it's not "valid" yet in terms of content.
          // Add an issue to remind user to update.
          result.issues.push(`Newly created ${ENV_FILE} requires your DEV_ORG and USER_IMAIL.`);
          // isValid remains false because critical vars are placeholders
        } else {
          logger.warn(`Skipped creation of ${ENV_FILE}.`);
          result.summary = `${ENV_FILE} is missing and was not created.`;
        }
      } catch (error: any) {
        logger.error(`Failed to create ${ENV_FILE}: ${error.message}`);
        result.summary = `Failed to create ${ENV_FILE}.`;
        result.issues.push(`Failed to create ${ENV_FILE}: ${error.message}`);
      }
    } else {
      result.summary = `${ENV_FILE} is missing. Run with --fix to attempt creation.`;
    }
    return result; // Return after handling missing file
  }

  // .env file exists, now check content
  try {
    const envContent = await fs.readFile(result.envPath, "utf8");
    const lines = envContent.split("\n");
    const envVars: Record<string, string> = {};

    for (const line of lines) {
      if (line.trim() === "" || line.trim().startsWith("#")) {
        continue;
      }
      const parts = line.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join("=").trim();
        envVars[key] = value;
      }
    }

    let allRequiredFound = true;
    for (const reqVar of REQUIRED_ENV_VARS) {
      if (!envVars[reqVar]) {
        allRequiredFound = false;
        result.isValid = false;
        const issueMsg = `Required variable '${reqVar}' is missing from ${ENV_FILE}.`;
        result.issues.push(issueMsg);
      } else if (DEFAULT_ENV_CONTENT.includes(`${reqVar}=${envVars[reqVar]}`) && (envVars[reqVar] === "your-devorg-slug" || envVars[reqVar] === "your-email@example.com")) {
        allRequiredFound = false;
        result.isValid = false;
        const issueMsg = `Required variable '${reqVar}' in ${ENV_FILE} still has its default placeholder value. Please update it.`;
        result.issues.push(issueMsg);
      }
    }

    if (result.issues.length > 0) {
        result.summary = `Found issues in ${ENV_FILE}: ${result.issues.join(" ")}`;
    } else {
        result.summary = `${ENV_FILE} exists and contains all required variables.`;
    }
    result.isValid = result.issues.length === 0;


  } catch (error: any) {
    result.isValid = false;
    const message = `Error reading or parsing ${ENV_FILE}: ${error.message}`;
    result.issues.push(message);
    result.summary = message;
  }

  return result;
}
