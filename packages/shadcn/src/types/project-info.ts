export interface ProjectInfo {
  isValid: boolean;
  rootPath: string | null;
  reasons: string[];
  isAirdropProject?: boolean; // To distinguish between a general project and an Airdrop project
  isAtRoot?: boolean; // To specifically track if CWD is the project root
}
