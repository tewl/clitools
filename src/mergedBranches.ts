import { Directory } from "./depot/directory";
import { GitBranch } from "./depot/gitBranch";
import { GitRepo } from "./depot/gitRepo";
import { IChoiceString, promptForChoice } from "./depot/prompts";
import { failed, succeeded } from "./depot/result";

if (require.main === module) {
    main()
    .then((exitCode) => {
        if (exitCode !== 0) {
            process.exit(exitCode);
        }
    })
    .catch((err) => {
        console.error(err.toString());
        process.exit(-1);
    });
}


async function main(): Promise<number> {
    const destBranch = process.argv[2];
    if (!destBranch) {
        throw new Error("Please specify name of destination branch.");
    }

    // Get a repo representing the current working directory.
    const cwd = new Directory(process.cwd());
    const repoResult = await GitRepo.fromDirectory(cwd);
    if (failed(repoResult)) {
        throw new Error(repoResult.error);
    }
    const repo = repoResult.value;

    // Get the target branch.
    const targetBranchResult = await GitBranch.create(repo, destBranch);
    if (failed(targetBranchResult)) {
        const errMsg = `Failed to find 'develop' branch.  ${targetBranchResult.error}`;
        throw new Error(errMsg);
    }

    // Find the branches that have been merged into the target branch.
    const mergedBranchesResult = await repo.getMergedBranches(targetBranchResult.value, true, false);
    if (failed(mergedBranchesResult)) {
        const errMsg = `Failed to get merged branches.  ${mergedBranchesResult.error}`;
        throw new Error(errMsg);
    }

    const mergedBranches = mergedBranchesResult.value;
    console.log(`The following ${mergedBranches.length} branches have been merged to ${targetBranchResult.value.toString()}:`);
    console.log(mergedBranches.join("\n") + "\n");

    for (const curLocalBranch of mergedBranches) {
        const branchesToDelete = await promptToDeleteBranch(curLocalBranch);
        for (const branchToDelete of branchesToDelete) {
            const deleteResult = await branchToDelete.repo.deleteBranch(branchToDelete, true);
            if (succeeded(deleteResult)) {
                console.log(`Deleted ${branchToDelete}.`);
            }
            else {
                console.log(`Failed to delete ${branchToDelete}. ${deleteResult.error}`);
            }
        }
    }

    return 0;
}

async function promptToDeleteBranch(branch: GitBranch): Promise<Array<GitBranch>> {
    const choices: Array<IChoiceString> = [];
    choices.push({name: "Skip",                                     value: "none"});
    choices.push({name: `Delete local branch ${branch.toString()}`, value: "local"});

    const remoteBranch = await branch.getTrackedBranch();
    if (remoteBranch) {
        choices.push({name: `Delete remote branch ${remoteBranch.toString()}`, value: "remote"});
        choices.push({name: `Delete local and remote branches`, value: "both"});
    }

    const answer = await promptForChoice("Delete branches?", choices);
    if (answer === "none") {
        return [];
    }
    else if (answer === "local") {
        return [branch];
    }
    else if (answer === "remote") {
        return [remoteBranch!];
    }
    else {
        return [branch, remoteBranch!];
    }
}
