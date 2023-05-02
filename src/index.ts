/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
    GITHUB_PERSONAL_ACCESS_TOKEN?: string;
    GITHUB_USERNAME?: string;
}

import { Octokit } from "octokit";
import { User } from "./types";
import { drawLanguageStatSvg } from "./draw";

const query = `query userInfo($login: String!) {
  user(login: $login) {
    repositories(ownerAffiliations: OWNER, isFork: false, first: 100) {
      nodes {
        visibility
        isTemplate
        archivedAt
        name
        updatedAt
        languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
          edges {
            size
            node {
              name
              color
            }
          }
        }
      }
    }
  }
}`

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        const github_token = env.GITHUB_PERSONAL_ACCESS_TOKEN;
        const user_name = env.GITHUB_USERNAME;

        if (github_token === undefined) {
            return new Response("GITHUB_PERSONAL_ACCESS_TOKEN is not set", {
                status: 500,
            });
        }
        if (user_name === undefined) {
            return new Response("GITHUB_USERNAME is not set", {
                status: 500,
            });
        }

        const octokit = new Octokit({ auth: github_token });
        await octokit.rest.users.getAuthenticated();

        const response = await octokit.graphql<{ user: User }>(
            query,
            { login: user_name }
        );

        const svgString = drawLanguageStatSvg(response);

        return new Response(svgString, {
            headers: {
                "content-type": "image/svg+xml",
            }
        });
    },
};
