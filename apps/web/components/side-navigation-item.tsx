"use client";

import Link, { LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import { SidebarNavItem } from "@/types/nav";
import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";

interface NavigationItemProps
  extends Omit<LinkProps, "href">,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  item: SidebarNavItem;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

const NavigationItem: React.FC<NavigationItemProps> = ({
  item,
  onClick,
  ...props
}) => {
  const pathname = usePathname();

  // Use the href directly from the item
  const href = item.href || "#";

  // Determine if this link represents the current page
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      {...props}
      onClick={onClick}
      className={cn(
        "relative",
        "flex",
        "items-center justify-between",
        "h-8",
        "text-sm",
        "text-muted-foreground px-6",
        !isActive && "hover:bg-indigo-900/50 hover:text-foreground",
        isActive && "bg-indigo-900/50 text-foreground",
        "transition-all",
        props.className
      )}
    >
      {/* Active indicator bar */}
      <div
        className={cn(
          "transition",
          "absolute left-0 w-1 h-full bg-indigo-500",
          isActive ? "opacity-100" : "opacity-0"
        )}
      />
      {item.title}
      {item.new && (
        <Badge variant="default" className="capitalize">
          NEW
        </Badge>
      )}
    </Link>
  );
};

NavigationItem.displayName = "NavigationItem";

export default NavigationItem;
