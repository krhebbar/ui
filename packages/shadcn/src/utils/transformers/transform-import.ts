import { Config } from "@/src/utils/get-config"
import { Transformer } from "@/src/utils/transformers"

export const transformImport: Transformer = async ({
  sourceFile,
  config,
}) => {
  const importDeclarations = sourceFile.getImportDeclarations()

  if (![".ts", ".js"].includes(sourceFile.getExtension())) {
    return sourceFile
  }

  for (const importDeclaration of importDeclarations) {
    const moduleSpecifier = updateImportAliases(
      importDeclaration.getModuleSpecifierValue(),
      config
    )

    importDeclaration.setModuleSpecifier(moduleSpecifier)
  }

  return sourceFile
}

function updateImportAliases(
  moduleSpecifier: string,
  config: Config
) {
  // Only handle local imports starting with "@/"
  if (!moduleSpecifier.startsWith("@/")) {
    return moduleSpecifier
  }

  // Handle component imports
  if (moduleSpecifier.startsWith("@/functions/")) {
    return moduleSpecifier.replace("@/functions/", config.aliases.components + "/")
  }

  if (moduleSpecifier.startsWith("@/lib/")) {
    return moduleSpecifier.replace("@/lib/", config.aliases.lib + "/")
  }

  if (moduleSpecifier.startsWith("@/hooks/")) {
    return moduleSpecifier.replace("@/hooks/", config.aliases.hooks + "/")
  }

  // Default: replace @/ with components alias
  const alias = config.aliases.components.split("/")[0]
  return moduleSpecifier.replace(/^@\//, `${alias}/`)
}
