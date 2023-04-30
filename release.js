/**
 * Semi-automated git tagging & publish to npm. Run this from *`main`* AFTER release
 * PR is merged (i.e. version number changes)
 */
const readline = require('readline');
const { exec } = require('child_process');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const prompt = async (prompt, defaultVal = '') => {
	return new Promise((ok, err) => {
		rl.question(`❓ ${prompt} `, (cmd) => {
			ok(cmd == '' ? defaultVal : cmd);
		});
	});
};

const package = require('./package.json');

const cmdRunner = async (cmd, debug = true) => {
	return new Promise((ok, error) => {
		exec(cmd, (err, stdout, stderr) => {
			if (debug) {
				console.log(`📺  ${stdout}`);
				console.log(`🪵  ${stderr}`);
			}
			if (err) {
				error(err);
			} else {
				ok(stdout);
			}
		});
	});
};

(async () => {
	console.log(`🔍 package version: ${package['version']})`);
	const lastCommit = (
		await cmdRunner(`git log -1 --pretty=%B`, false)
	).trim();
	const desc = await prompt(
		`release note (required)\n   last commit: "${lastCommit}"\n:`,
		lastCommit
	);
	if (desc.trim() === '') {
		console.error('❌ release note is required');
		process.exit(1);
	}

	console.log(`⚠️  tag         : v${package['version']}`);
	console.log(`⚠️  release note: ${desc}`);

	const confirm = await prompt(`ready to tag and release? (y/N)`);
	if (confirm.toLowerCase() != 'y') {
		return;
	}

	const commands = [
		`echo '# tagging...' && git tag -a v${package['version']} -m "${desc}" && git tag -n`,
		`echo '# pushing tag...' && git push --tags origin`,
		`echo '# publishing to npm...' && npm publish --access public`,
	];

	try {
		for (const cmd of commands) {
			await cmdRunner(cmd);
		}
		console.log(`✅  tagged and pushed!`);
		process.exit(0);
	} catch (err) {
		console.error(`❌`, err);
		process.exit(1);
	}
})();
