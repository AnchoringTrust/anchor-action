/**
 * AnchoringTrust/anchor-action
 * 
 * Thin wrapper around @umarise/cli.
 * Installs the CLI, runs `umarise proof <file>`, uploads the .proof artifact,
 * and optionally posts a summary comment on Pull Requests.
 */

const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const { DefaultArtifactClient } = require('@actions/artifact');
const path = require('path');
const fs = require('fs');

const COMMENT_MARKER = '<!-- umarise-anchor-bot -->';

async function run() {
  try {
    const file = core.getInput('file', { required: true });
    const uploadArtifact = core.getInput('upload-artifact') !== 'false';
    const prComment = core.getInput('pr-comment') !== 'false';
    const githubToken = core.getInput('github-token');

    // Verify file exists
    const absPath = path.resolve(file);
    if (!fs.existsSync(absPath)) {
      throw new Error(`File not found: ${file}`);
    }

    // Install @umarise/cli globally
    core.info('Installing @umarise/cli...');
    await exec.exec('npm', ['install', '-g', '@umarise/cli']);

    // Run proof command (full lifecycle: anchor + resolve + download)
    core.info(`Anchoring ${file}...`);
    let stdout = '';
    let exitCode = 0;
    try {
      await exec.exec('umarise', ['proof', file], {
        listeners: {
          stdout: (data) => { stdout += data.toString(); },
        },
      });
    } catch (err) {
      // proof command may exit non-zero on pending — that's OK
      exitCode = err.exitCode || 1;
      core.info(`Proof command exited with code ${exitCode}`);
    }

    // Parse output for origin_id and hash
    const originMatch = stdout.match(/origin_id\s+([a-f0-9-]+)/i);
    const hashMatch = stdout.match(/hash:\s+(sha256:[a-f0-9]+)/i);
    const proofPath = `${absPath}.proof`;

    const originId = originMatch ? originMatch[1] : null;
    const hash = hashMatch ? hashMatch[1] : null;
    const proofExists = fs.existsSync(proofPath);
    const status = proofExists ? 'confirmed' : 'pending';

    if (originId) core.setOutput('origin-id', originId);
    if (hash) core.setOutput('hash', hash);
    core.setOutput('proof-path', proofPath);
    core.setOutput('status', status);

    // Upload .proof as artifact (if it exists — only when proof is anchored)
    if (uploadArtifact && proofExists) {
      core.info('Uploading .proof artifact...');
      const artifactName = `${path.basename(file)}.proof`;
      const client = new DefaultArtifactClient();
      await client.uploadArtifact(artifactName, [proofPath], path.dirname(proofPath));
      core.info(`✓ artifact uploaded: ${artifactName}`);
    } else if (uploadArtifact) {
      // Proof pending — create a minimal status file so there's always an artifact
      const statusFile = `${absPath}.anchor-status.json`;
      const statusData = {
        origin_id: originId,
        hash: hash,
        proof_status: 'pending',
        message: 'Bitcoin proof is pending. Re-run this workflow after ~2 hours to download the complete .proof bundle.',
        anchored_at: null,
        created_at: new Date().toISOString(),
      };
      fs.writeFileSync(statusFile, JSON.stringify(statusData, null, 2));
      const artifactName = `${path.basename(file)}.anchor-status`;
      const client = new DefaultArtifactClient();
      await client.uploadArtifact(artifactName, [statusFile], path.dirname(statusFile));
      core.info(`✓ status artifact uploaded: ${artifactName} (proof pending)`);
    }

    // Post PR comment (if on a pull request)
    if (prComment && githubToken) {
      await postPRComment({ githubToken, file, originId, hash, status });
    }

    core.info('✓ anchor-action complete');
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function postPRComment({ githubToken, file, originId, hash, status }) {
  const { context } = github;

  // Determine PR number
  let prNumber = null;
  if (context.payload.pull_request) {
    prNumber = context.payload.pull_request.number;
  } else if (context.eventName === 'push') {
    // On push, try to find associated PR
    try {
      const octokit = github.getOctokit(githubToken);
      const { data: prs } = await octokit.rest.pulls.list({
        owner: context.repo.owner,
        repo: context.repo.repo,
        head: `${context.repo.owner}:${context.ref.replace('refs/heads/', '')}`,
        state: 'open',
      });
      if (prs.length > 0) {
        prNumber = prs[0].number;
      }
    } catch (err) {
      core.info(`Could not find associated PR: ${err.message}`);
    }
  }

  if (!prNumber) {
    core.info('No PR found — skipping comment');
    return;
  }

  const octokit = github.getOctokit(githubToken);
  const statusEmoji = status === 'confirmed' ? '✅' : '⏳';
  const statusLabel = status === 'confirmed' ? 'Bitcoin Confirmed' : 'Pending (~2 hours)';

  const body = `${COMMENT_MARKER}
## ${statusEmoji} Anchored by Umarise

| Field | Value |
|-------|-------|
| **File** | \`${file}\` |
| **Hash** | \`${hash || 'computing...'}\` |
| **Origin ID** | \`${originId || 'pending'}\` |
| **Status** | ${statusLabel} |

${status === 'pending' 
  ? '> ⏳ Bitcoin proof is pending. The proof will be confirmed in ~2 hours.\n> Re-run this workflow to download the complete `.proof` bundle.' 
  : '> ✅ This artifact is independently verifiable on Bitcoin — forever, without trusting Umarise.'}

<sub>🔒 Privacy: only the SHA-256 hash left this runner. Source code never leaves your system.</sub>
<sub>Powered by [Umarise Anchor](https://github.com/marketplace/actions/umarise-anchor) · [Verify independently](https://verify-anchoring.org)</sub>`;

  try {
    // Check for existing comment to update (avoid duplicates)
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
    });

    const existingComment = comments.find(c => c.body && c.body.includes(COMMENT_MARKER));

    if (existingComment) {
      await octokit.rest.issues.updateComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: existingComment.id,
        body,
      });
      core.info(`✓ Updated PR comment on #${prNumber}`);
    } else {
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
        body,
      });
      core.info(`✓ Posted PR comment on #${prNumber}`);
    }
  } catch (err) {
    // Don't fail the action if commenting fails (permissions may vary)
    core.warning(`Could not post PR comment: ${err.message}`);
  }
}

run();
