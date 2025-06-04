'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@workspace/ui/components/button'

export function CommandCopyButton({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timeout)
    }
  }, [copied])

  const parseCommandForTelemetry = (cmd: string) => {
    // Extract framework from URL (e.g., 'nextjs' from 'password-based-auth-nextjs.json')
    const frameworkMatch = cmd.match(/ui\/r\/.*?-(nextjs|react|react-router|tanstack)\.json/)

    // if the block doesn't have a framework defined (like infinite query), default to react
    const framework = frameworkMatch
      ? (frameworkMatch[1] as 'nextjs' | 'react-router' | 'tanstack' | 'react')
      : 'react'

    // Extract package manager from command prefix (npx, pnpm, yarn, bun)
    const packageManager = cmd.startsWith('npx')
      ? ('npm' as const)
      : cmd.startsWith('pnpm')
        ? ('pnpm' as const)
        : cmd.startsWith('yarn')
          ? ('yarn' as const)
          : cmd.startsWith('bun')
            ? ('bun' as const)
            : ('npm' as const)

    // Extract template title from URL (e.g., 'password-based-auth' from 'password-based-auth-nextjs.json')
    const titleMatch = cmd.match(/\/ui\/r\/(.*?)\.json/)
    const title = (titleMatch?.[1] ?? '').replaceAll(`-${framework}`, '')

    return {
      framework,
      packageManager,
      title,
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        // Copy command to clipboard
        navigator.clipboard.writeText(command)
        setCopied(true)

        // Parse command and send telemetry event
        const { framework, packageManager, title } = parseCommandForTelemetry(command)

        
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}
