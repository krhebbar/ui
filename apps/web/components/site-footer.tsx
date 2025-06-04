import { siteConfig } from '@/config/site'

export function SiteFooter() {
  return (
    <footer className="py-6 px-4 md:px-8 md:py-0 mx-auto w-full max-w-site">
      <div className="flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Snap-in Blocks</span> is a library of reusable building blocks for creating Snap-ins on the DevRev platform.
        </p>
      </div>
    </footer>
  )
}
