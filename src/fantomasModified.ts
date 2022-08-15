import * as os from "os";
import * as yargs from "yargs";
import { insertIf } from "./depot/arrayHelpers";
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


interface IConfig {
    check: boolean;
}


function getConfiguration(): Result<IConfig, string> {
    const argv = yargs
    .usage([
        "Runs Fantomas F# style checker on all staged and modified .fs files."
    ].join(os.EOL))
    .help()
    .option(
        "check",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "Only check the files.  Do not fix them."
        }
    )
    .wrap(80)
    .argv;

    return new SucceededResult({check: argv.check});
}


async function main(): Promise<Result<undefined, string>> {

    const configRes = getConfiguration();
    if (configRes.failed) {
        return new FailedResult("Invalid configuration.");
    }

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
        const args = [
            "fantomas",
            ...insertIf(configRes.value.check, "--check"),
            inputFile.toString()
        ];

        return spawn("dotnet", args);
    });

    const res = Result.all(await Promise.all(spawnOutputs.map((so) => so.closePromise)));
    if (res.failed) {
        return new FailedResult(spawnErrorToString(res.error));
    }

    console.log(res.value);

    return new SucceededResult(undefined);
}
