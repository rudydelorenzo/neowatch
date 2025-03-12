import { $ } from "bun";
import { readFile } from "fs/promises";

const BUMP_COMMIT_USERNAME = "GitHub Actions";
const BUMP_COMMIT_EMAIL = "ci@rudydelorenzo.noreply.ca";

const getMatchInMessages = (messages: string[], matchRegex: RegExp) => {
    for (const message of messages) {
        if (matchRegex.test(message)) return true;
    }
};

// Check if author identity is set
const config = (await $`git config --list`.quiet()).text().split(/\n/);

const configMap: Record<string, string> = {};
config.map((line) => {
    const [prop, val] = line.split(/=/, 2);
    if (prop && val) configMap[prop] = val;
});

if (
    configMap["user.name"] === undefined ||
    configMap["user.email"] === undefined
) {
    console.info("Setting git identity");
    await $`git config --global user.email ${BUMP_COMMIT_EMAIL}`;
    await $`git config --global user.name ${BUMP_COMMIT_USERNAME}`;
} else {
    console.info("Skipping setting identity");
}

// Check for uncommitted changes
const status = await $`git status --porcelain`.quiet();
if (!!status.text() && !process.env.FORCE) {
    console.error(
        "There are uncommitted changes. Commit them before releasing or run with FORCE=true.",
    );
    process.exit(1);
}

// Determine which version to bump
const commits = JSON.parse(
    await readFile(new URL(process.env.GITHUB_EVENT_PATH, import.meta.url)),
).commits;

if (!commits) {
    console.log("NO COMMITS, SKIPPING BUMP AND PUSH");
    process.exit(0);
}

const commitMessages = commits.map((commit: any) => commit.message);

console.log("Commit Messages:");
console.log(commitMessages);

let logicalBump = "patch";

if (getMatchInMessages(commitMessages, /BREAKING/)) {
    console.log("BUMPING MAJOR");
    logicalBump = "major";
} else if (getMatchInMessages(commitMessages, /feat:/)) {
    console.log("BUMPING MINOR");
    logicalBump = "minor";
} else {
    console.log("BUMPING PATCH");
}

// Bump version
const semverPart = Bun.argv[3] || logicalBump || "patch";
const json = await Bun.file("./package.json").json();
const [major, minor, patch] = json.version
    .split(".")
    .map((s: string) => parseInt(s));
json.version = bump([major, minor, patch], semverPart);
await Bun.write("./package.json", JSON.stringify(json, null, 2));

// Commit, tag and push
await $`git add package.json`;
await $`git commit -m v${json.version}`;
await $`git tag ${json.version}`;
await $`git push`;
await $`git push origin ${json.version}`;

function bump(semver: [number, number, number], semverPart = "patch") {
    switch (semverPart) {
        case "major":
            semver[0]++;
            semver[1] = 0;
            semver[2] = 0;
            break;
        case "minor":
            semver[1]++;
            semver[2] = 0;
            break;
        case "patch":
            semver[2]++;
            break;
        default:
            throw new Error(`Invalid semver part: ${semverPart}`);
    }

    return semver.join(".");
}
