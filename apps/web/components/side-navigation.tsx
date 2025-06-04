import Link from "next/link";

import NavigationItem from "@/components/side-navigation-item";
import { aiEditorsRules, gettingStarted } from "@/config/docs";

function SideNavigation() {
  return (
    <nav className="flex flex-col h-full min-w-[220px]">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <Link href="/">
            <svg
              id="Layer_2"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1337.8 215.99"
              fill="currentColor"
              style={{
                height: "20px",
              }}
            >
              <path d="m54,51.5v51.5C25.2,103,1.5,79.75,1.5,51.5S25.2,0,54,0s52.5,23.25,52.5,51.5h-52.5Z"></path>
              <path d="m150,161.5v51.5c-28.8,0-52.5-23.25-52.5-51.5s23.7-51.5,52.5-51.5,52.5,23.25,52.5,51.5h-52.5Z"></path>
              <polygon points="150 101.5 204 1.5 96 1.5 150 101.5"></polygon>
              <polygon points="54 211.5 108 111.5 0 111.5 54 211.5"></polygon>
              <path d="m388.48,211.49h-79.49V1.51h79.49c63.29,0,101.99,39.3,101.99,104.99s-38.7,104.99-101.99,104.99Zm-3-33c45.3,0,65.99-25.2,65.99-71.99s-20.7-71.99-65.99-71.99h-37.5v143.99h37.5Z"></path>
              <path d="m580.46,215.99c-49.5,0-80.99-35.7-80.99-82.49s32.1-82.49,80.09-82.49c39.9,0,63.59,21,73.49,52.2,3.6,11.7,5.1,24.6,5.1,37.8v6h-119.99c.9,19.5,15.6,40.5,42.3,40.5,20.4,0,30.9-11.4,34.5-21h40.2c-8.7,27.3-33.9,49.5-74.69,49.5Zm-42.3-97.49h81.29c-.9-20.7-15-39-39.9-39s-39,18.3-41.4,39Z"></path>
              <path d="m692.06,55.51l21.6,59.99c6.9,18,12.3,38.7,16.8,55.49h1.2c4.5-16.8,9.9-37.5,16.8-55.49l21.6-59.99h39.6l-59.99,155.98h-37.2l-60-155.98h39.6Z"></path>
              <path d="m1062.65,215.99c-49.5,0-80.99-35.7-80.99-82.49s32.1-82.49,80.09-82.49c39.9,0,63.6,21,73.49,52.2,3.6,11.7,5.1,24.6,5.1,37.8v6h-119.99c.9,19.5,15.6,40.5,42.3,40.5,20.4,0,30.9-11.4,34.5-21h40.2c-8.7,27.3-33.9,49.5-74.69,49.5Zm-42.3-97.49h81.29c-.9-20.7-15-39-39.9-39s-38.99,18.3-41.4,39Z"></path>
              <path d="m1174.25,55.51l21.6,59.99c6.9,18,12.3,38.7,16.8,55.49h1.2c4.5-16.8,9.9-37.5,16.8-55.49l21.6-59.99h39.6l-59.99,155.98h-37.2l-59.99-155.98h39.6Z"></path>
              <path d="m920.23,127.18h-.05c37.23-3.01,61.14-27.59,61.14-62.68,0-37.5-27.3-62.99-68.99-62.99h-89.76v209.98h39v-83.99h14.36l64.26,83.99h46.06l-66.01-84.31Zm-58.67-32.68v-59.99h50.76c18,0,30,12,30,30s-12,30-30,30h-50.76Z"></path>
              <path d="m1320.18,47.81c9.66,0,17.62,7.97,17.62,17.62s-7.97,17.62-17.62,17.62-17.62-7.97-17.62-17.62,7.97-17.62,17.62-17.62Zm0,31.62c7.72,0,14-6.28,14-14s-6.28-14-14-14-14,6.28-14,14,6.28,14,14,14Zm2.17-12.08h0c3.51-.28,5.76-2.6,5.76-5.91,0-3.53-2.57-5.94-6.5-5.94h-8.46v19.79h3.68v-7.92h1.35l6.06,7.92h4.34l-6.22-7.95Zm-5.53-3.55v-5.66h4.79c1.7,0,2.83,1.13,2.83,2.83s-1.13,2.83-2.83,2.83h-4.79Z"></path>
            </svg>
          </Link>
        </div>
        <h1 className="text-muted-foreground text-sm">
          Smarter connector development—AI helps you build faster, not alone.
        </h1>
      </div>
      <div className="pb-6 space-y-0.5">
        <div className="font-mono uppercase text-xs text-muted-foreground/75 mb-2 px-6 tracking-widest">
          {gettingStarted.title}
        </div>
        {gettingStarted.items.map((item, i) => (
          <NavigationItem item={item} key={`${item.href}-${i}`} />
        ))}
      </div>

      <div className="pb-6">
        <div className="font-mono uppercase text-xs text-muted-foreground/75 mb-2 px-6 tracking-widest">
          {aiEditorsRules.title}
        </div>
        {aiEditorsRules.items.map((item, i) => (
          <NavigationItem item={item} key={`${item.href}-${i}`} />
        ))}
      </div>

      <div className="pb-6 flex-1">
        <div className="font-mono uppercase text-xs text-muted-foreground/75 mb-2 px-6 tracking-widest">
          Airdrop Connections
        </div>
        <div className="space-y-0.5">
          <NavigationItem
            item={{
              title: "Secret Connection",
              href: "/docs/airdrop/connection/secret",
              items: [],
            }}
            key="/docs/airdrop/connection/secret"
          />
          <NavigationItem
            item={{
              title: "OAuth2 Connection",
              href: "/docs/airdrop/connection/oauth2",
              items: [],
            }}
            key="/docs/airdrop/connection/oauth2"
          />
        </div>
      </div>
    </nav>
  );
}

export default SideNavigation;
