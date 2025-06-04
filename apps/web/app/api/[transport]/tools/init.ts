export const initTool = {
  name: "init",
  description: "Clone the Airdrop template repository from GitHub.",
  input: {}, // No parameters required
  handler: async (args: any, project: any, extra: any) => {
    console.log("project", project);
    console.log("extra", extra);
    return {
      content: [
        {
          type: "text" as const,
          text: `🚀 **Initialize Airdrop Project**\n\nUse the following command to clone the official [Airdrop Template](https://github.com/devrev/airdrop-template):\n\n\`\`\`bash\ngit clone https://github.com/devrev/airdrop-template\ncd airdrop-template\n\`\`\`\n\n💡 You can now begin working with the cloned template.`,
        },
      ],
    };
  },
};
