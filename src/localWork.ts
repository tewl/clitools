import * as os from "os";
import { Directory } from "./depot/directory";
import { File } from "./depot/file";
import { GitRepo } from "./depot/gitRepo";
import { FailedResult, Result, SucceededResult } from "./depot/result";
import { indent } from "./depot/stringHelpers";


if (require.main === module) {
    // main() can return a failed result or reject.
    main()
    .then((res) => {
        if (res.failed) {
            console.error(res.error);
            process.exit(-1);
        }
    })
    .catch((err: Error) => {
        console.error(err.message);
        process.exit(-1);
    });
}

async function main(): Promise<Result<undefined, string>> {

    const repos = await getRepos();
    console.log(`Found ${repos.length} repos.`);
    let numProjectsWithLocalWork = 0;
    for (const curRepo of repos) {
        numProjectsWithLocalWork += await report(curRepo) ? 1 : 0;
    }

    return numProjectsWithLocalWork > 0 ?
        new FailedResult(`Projects with local work: ${numProjectsWithLocalWork}`) :
        new SucceededResult(undefined);
}


/**
 * Searches the current working directory recursively for Git repositories.
 *
 * @returns An array of the found Git repositories.
 */
async function getRepos(): Promise<Array<GitRepo>> {
    const cwd = new Directory(".");

    const repos: Array<GitRepo> = [];

    const cwdRepoRes = await GitRepo.fromDirectory(cwd);
    if (cwdRepoRes.succeeded) {
        repos.push(cwdRepoRes.value);
    }

    await cwd.walk(async (item) => {
        // Not interested in files.
        if (item instanceof File) { return false; }

        const repoRes = await GitRepo.fromDirectory(item);
        if (repoRes.succeeded) {
            repos.push(repoRes.value);
            // We found the repo.  Don't recurse any further.
            return false;
        }
        else if (item.toString().includes("node_modules")) {
            return false;
        }
        else {
            return true;
        }

    });
    return repos;
}


/**
 * Prints a status report for the specified project.
 *
 * @param repo - The repo to print a report for
 * @returns A boolean indicating whether the specified project contains local
 * work.
 */
async function report(repo: GitRepo): Promise<boolean> {
    const warnings: Array<string> = [];

    const modifiedFiles = await repo.modifiedFiles();
    if (modifiedFiles.length > 0) {
        warnings.push(`Modified files:    ${modifiedFiles.length}`);
    }

    const untrackedFiles = await repo.untrackedFiles();
    if (untrackedFiles.length > 0) {
        warnings.push(`Untracked files:   ${untrackedFiles.length}`);
    }

    try {
        const {ahead} = await repo.getCommitDeltas();
        if (ahead > 0) {
            warnings.push(`Unpushed commits:  ${ahead}`);
        }
    }
    catch (err) {
        // Intentionally empty.
    }

    const containsLocalWork = warnings.length > 0;
    if (containsLocalWork) {
        console.log(repo.directory.toString());
        console.log(warnings.map((str) => indent(str, 4)).join(os.EOL));
    }
    return containsLocalWork;
}
