import { Directory } from "./depot/directory";
import { GitRepo } from "./depot/gitRepo";
import { FailedResult, Result, SucceededResult } from "./depot/result";
import { spawn, spawnErrorToString } from "./depot/spawn2";


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

    const repoRes = await GitRepo.fromDirectory(new Directory(process.cwd()));
    if (repoRes.failed) {
        return repoRes;
    }
    const repo = repoRes.value;

    const stagedFilesRes = await repo.getStagedFiles("cwd");
    if (stagedFilesRes.failed) {
        return stagedFilesRes;
    }

    const modifiedFiles = await repo.modifiedFiles();

    let inputFiles = stagedFilesRes.value.concat(modifiedFiles);
    inputFiles = inputFiles.filter((file) => file.extName === ".fs");

    if (inputFiles.length === 0) {
        console.log("No staged or modified files found.");
        return new SucceededResult(undefined);
    }

    console.log("Processing:");
    inputFiles.forEach((file) => console.log(file.toString()));

    const spawnOutputs = inputFiles.map((inputFile) => {
        return spawn("dotnet", ["fantomas", inputFile.toString()]);
    });

    const res = Result.all(await Promise.all(spawnOutputs.map((so) => so.closePromise)));
    if (res.failed) {
        return new FailedResult(spawnErrorToString(res.error));
    }

    return new SucceededResult(undefined);
}
