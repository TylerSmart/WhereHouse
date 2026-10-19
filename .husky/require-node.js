// Stops the pre-commit hook with an actionable message when the active Node is
// older than this repo supports. Without it, lint-staged dies deep inside its
// own source (".toSorted is not a function"), which points at the wrong problem.
//
// Only the lower bound is enforced. Versions above it but outside the declared
// range (odd-numbered releases such as 23.x) are rejected by the Angular CLI
// itself, which already reports that clearly.

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

function readSupportedFloor() {
	const manifest = path.join(repoRoot, 'WhereHouse.Client', 'package.json');
	const engines = JSON.parse(fs.readFileSync(manifest, 'utf8')).engines || {};

	// engines.node is written lowest-range-first, so the first version wins.
	const match = /(\d+)\.(\d+)\.(\d+)/.exec(engines.node || '');
	return match ? match.slice(1, 4).map(Number) : null;
}

function readPinnedVersion() {
	try {
		return fs.readFileSync(path.join(repoRoot, '.nvmrc'), 'utf8').trim();
	} catch (error) {
		return null;
	}
}

function isOlder(candidate, floor) {
	for (let i = 0; i < 3; i++) {
		if (candidate[i] !== floor[i]) {
			return candidate[i] < floor[i];
		}
	}
	return false;
}

const floor = readSupportedFloor();

// A malformed engines.node is a config bug, not a reason to block a commit.
if (!floor) {
	process.exit(0);
}

const active = process.versions.node.split('.').map(Number);

if (!isOlder(active, floor)) {
	process.exit(0);
}

const pinned = readPinnedVersion();
const command = pinned || String(floor[0]);

const message = [
	'',
	'pre-commit stopped: this repo needs a newer Node.js.',
	'',
	'  active       v' + process.versions.node,
	'               ' + process.execPath,
	'  minimum      v' + floor.join('.') + '  (WhereHouse.Client/package.json, engines.node)',
	pinned ? '  recommended  v' + pinned + '  (.nvmrc)' : null,
	'',
	'NVM for Windows switches Node globally and does not read .nvmrc, so an',
	'"nvm use" from another project leaves this hook on the wrong version.',
	'',
	'  nvm install ' + command,
	'  nvm use ' + command,
	'',
	'Then commit again.',
	'',
]
	.filter(function (line) {
		return line !== null;
	})
	.join('\n');

process.stderr.write(message + '\n');
process.exit(1);
