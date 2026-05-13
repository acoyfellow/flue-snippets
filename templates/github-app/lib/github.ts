// templates/github-app/lib/github.ts, minimal Octokit wrapper.
//
// We import only what we use to keep the bundle small. For more APIs
// (commit statuses, labels, reviews) see https://octokit.github.io/rest.js/.

import { Octokit } from '@octokit/core';

export async function postIssueComment(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  const octokit = new Octokit({ auth: token });
  await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}
