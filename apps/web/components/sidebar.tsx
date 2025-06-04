import SideNavigation from "@/components/side-navigation";
import { ScrollArea } from "@workspace/ui/components/scroll-area";

export function Sidebar() {
  return (
    <aside className="fixed z-30 top-0 h-screen w-full shrink-0 sticky block bg-200 border-r border-muted/50">
      <ScrollArea className="h-full">
        <SideNavigation />
      </ScrollArea>
    </aside>
  );
}
