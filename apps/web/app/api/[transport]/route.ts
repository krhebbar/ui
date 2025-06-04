import { createMcpHandler } from "@vercel/mcp-adapter";
import { NextRequest } from "next/server";

import { withAuth } from "@/app/api/lib/withAuth";

import { initTool } from "./tools/init";

const handlerWithAuth = withAuth(
  (
    request: NextRequest,
    context: { params: Promise<{ transport: string }> }
  ) => {
    const project = request.headers.get("x-project");
    console.log("Project:", project);

    return createMcpHandler(
      async (server) => {
        server.tool(
          initTool.name,
          initTool.description,
          initTool.input,
          async (args, extra) => {
            return initTool.handler(args, project, extra);
          }
        );
      },
      {},
      {
        basePath: "/api",
        maxDuration: 60,
        verboseLogs: true,
        redisUrl: process.env.REDIS_URL,
      }
    )(request);
  }
);

export {
  handlerWithAuth as DELETE,
  handlerWithAuth as GET,
  handlerWithAuth as POST,
};
