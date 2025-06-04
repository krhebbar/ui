export interface NavItem {
  title: string;
  href?: string;
  disabled?: boolean;
  external?: boolean;
  new?: boolean;
  icon?: any;
  label?: string;
}

export interface NavItemWithChildren extends NavItem {
  items: NavItemWithChildren[];
}

export interface MainNavItem extends NavItem {}

export interface SidebarNavItem extends NavItemWithChildren {}

export interface SidebarNavGroup extends NavItem {
  items: (SidebarNavItem & { commandItemLabel: string })[];
}
