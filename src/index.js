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

    // Run anchor command
    core.info(`Anchoring ${file}...`);
    let stdout = '';
    await exec.exec('umarise', ['anchor', file], {
      listeners: {
        stdout: (data) => { stdout += data.toString(); },
      },
    });

    // Parse output for origin_id and hash
    const originMatch = stdout.match(/origin_id\s+([a-f0-9-]+)/i);
    const hashMatch = stdout.match(/hash computed:\s+(sha256:[a-f0-9]+)/i);
    const proofPath = `${absPath}.proof`;

    if (originMatch) core.setOutput('origin-id', originMatch[1]);
    if (hashMatch) core.setOutput('hash', hashMatch[1]);
    core.setOutput('proof-path', proofPath);

    // Upload .proof as artifact
    if (uploadArtifact && fs.existsSync(proofPath)) {
      core.info('Uploading .proof artifact...');
      const artifactName = `${path.basename(file)}.proof`;
      const client = new DefaultArtifactClient();
      await client.uploadArtifact(artifactName, [proofPath], path.dirname(proofPath));
      core.info(`✓ artifact uploaded: ${artifactName}`);
    }

    core.info('✓ anchor-action complete');
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
