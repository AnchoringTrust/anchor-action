/**
 * AnchoringTrust/anchor-action
 * 
 * Thin wrapper around @umarise/cli.
 * Installs the CLI, runs `umarise anchor <file>`, uploads the .proof artifact.
 */

const core = require('@actions/core');
const exec = require('@actions/exec');
const { DefaultArtifactClient } = require('@actions/artifact');
const path = require('path');
const fs = require('fs');

async function run() {
  try {
    const file = core.getInput('file', { required: true });
    const uploadArtifact = core.getInput('upload-artifact') !== 'false';

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

    if (originMatch) core.setOutput('origin-id', originMatch[1]);
    if (hashMatch) core.setOutput('hash', hashMatch[1]);
    core.setOutput('proof-path', proofPath);

    // Upload .proof as artifact (if it exists — only when proof is anchored)
    if (uploadArtifact && fs.existsSync(proofPath)) {
      core.info('Uploading .proof artifact...');
      const artifactName = `${path.basename(file)}.proof`;
      const client = new DefaultArtifactClient();
      await client.uploadArtifact(artifactName, [proofPath], path.dirname(proofPath));
      core.info(`✓ artifact uploaded: ${artifactName}`);
    } else if (uploadArtifact) {
      // Proof pending — create a minimal status file so there's always an artifact
      const statusFile = `${absPath}.anchor-status.json`;
      const status = {
        origin_id: originMatch ? originMatch[1] : null,
        hash: hashMatch ? hashMatch[1] : null,
        proof_status: 'pending',
        message: 'Bitcoin proof is pending. Re-run this workflow after ~2 hours to download the complete .proof bundle.',
        anchored_at: null,
        created_at: new Date().toISOString(),
      };
      fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
      const artifactName = `${path.basename(file)}.anchor-status`;
      const client = new DefaultArtifactClient();
      await client.uploadArtifact(artifactName, [statusFile], path.dirname(statusFile));
      core.info(`✓ status artifact uploaded: ${artifactName} (proof pending)`);
    }

    core.info('✓ anchor-action complete');
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
