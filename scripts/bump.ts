import { $ } from "bun";

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
    await $`git config --global user.email "actions@github.com"`;
    await $`git config --global user.name "Github Actions"`;
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

// Bump version
const semverPart = Bun.argv[3] || "patch";
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
