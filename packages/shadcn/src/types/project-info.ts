export interface ProjectInfo {
  isValid: boolean;
  rootPath: string | null;
  reasons: string[];
  isAirdropProject?: boolean;
  isAtRoot?: boolean;
}
