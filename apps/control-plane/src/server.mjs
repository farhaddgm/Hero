import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  HERO_SERVICE,
  HERO_VERSION,
  getAuthorizationContractSummary,
  getFakeAgentContractSummary,
  getOperationalDataSummary,
  getPublicArchitectureSummary,
  getRunnerContractSummary,
  getWorkflowContractSummary
} from "../../../packages/contracts/src/index.mjs";

function json(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store"
  });
  response.end(payload);
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("HERO_HTTP_PORT must be an integer between 0 and 65535.");
  }
  return port;
}

export function createHeroServer(options = {}) {
  const host = options.host ?? process.env.HERO_HTTP_HOST ?? "127.0.0.1";
  const port = parsePort(options.port ?? process.env.HERO_HTTP_PORT ?? "3100");

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, {
        service: HERO_SERVICE,
        version: HERO_VERSION,
        status: "ok"
      });
    }

    if (request.method === "GET" && url.pathname === "/ready") {
      return json(response, 200, {
        service: HERO_SERVICE,
        status: "ready",
        boundary: "clean-room"
      });
    }

    if (request.method === "GET" && url.pathname === "/architecture") {
      return json(response, 200, {
        service: HERO_SERVICE,
        architecture: getPublicArchitectureSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/data-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        dataContract: getOperationalDataSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/workflow-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        workflowContract: getWorkflowContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/authorization-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        authorizationContract: getAuthorizationContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/runner-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        runnerContract: getRunnerContractSummary()
      });
    }

    if (request.method === "GET" && url.pathname === "/fake-agent-contract") {
      return json(response, 200, {
        service: HERO_SERVICE,
        fakeAgentContract: getFakeAgentContractSummary()
      });
    }

    return json(response, 404, {
      service: HERO_SERVICE,
      status: "not_found"
    });
  });

  return {
    server,
    async start() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      const address = server.address();
      return typeof address === "object" && address ? address : { address: host, port };
    },
    async stop() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    }
  };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (currentFile === invokedFile) {
  const app = createHeroServer();
  const address = await app.start();
  console.log(JSON.stringify({
    level: "info",
    event: "hero.started",
    host: address.address,
    port: address.port,
    version: HERO_VERSION
  }));

  const shutdown = async signal => {
    console.log(JSON.stringify({ level: "info", event: "hero.stopping", signal }));
    await app.stop();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}
