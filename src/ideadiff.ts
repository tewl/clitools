import * as yargs from "yargs";
import { Directory } from "./depot/directory";
import { File } from "./depot/file";
import { pipe } from "./depot/pipe";
import { FailedResult, Result, SucceededResult } from "./depot/result";
import { spawn } from "./depot/spawn2";


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
    left: Directory | File;
    right: Directory | File;
}


async function main(): Promise<Result<undefined, string>> {

    const configRes = getConfiguration();
    if (configRes.failed) {
        return configRes;
    }

    const ideRes = await findIde();
    if (ideRes.failed) {
        return ideRes;
    }
    else {
        console.log(`Found IDE: ${ideRes.value.toString()}`);
    }

    const spawnRes =
        spawn(ideRes.value.absPath(),
              ["diff", configRes.value.left.absPath(), configRes.value.right.absPath()]);
    await spawnRes.closePromise;

    return new SucceededResult(undefined);
}


function getConfiguration(): Result<IConfig, string> {
    const argv = yargs
    .usage("Diffs two directories or two files.")
    .help()
    .wrap(80)
    .argv;

    function isDirOrFile(val: string): Result<Directory | File, string> {
        const dir = new Directory(val);
        if (dir.existsSync()) { return new SucceededResult(dir); }

        const file = new File(val);
        if (file.existsSync()) { return new SucceededResult(file); }

        return new FailedResult(`${val} is not a directory or file.`);
    }

    function argToDirOrFile(arg: string | undefined) {
        return pipe(arg)
        .pipe((arg) => arg === undefined ? new FailedResult("File or directory not specified.") : new SucceededResult(arg))
        .pipe((res) => Result.bind(isDirOrFile, res))
        .end();
    }

    return pipe(Result.all([argToDirOrFile(argv._[0]), argToDirOrFile(argv._[1])]))
    .pipe((res) => Result.augment(
        ([left, right]) => {
            return left.constructor.name === right.constructor.name ?
                    new SucceededResult({}) :
                    new FailedResult("Both arguments must be either a directory or a file.");
        },
        res
    ))
    .pipe((res) => Result.mapSuccess(([left, right]) => ({left, right}), res))
    .end();
}


async function findIde(): Promise<Result<File, string>> {
    const progFilesDir = new Directory("c:", "Program Files", "JetBrains");
    let foundExe: File | undefined = undefined;

    await progFilesDir.walk((item) => {
        if (item instanceof File) {
            if (item.fileName === "rider64.exe" ||
                item.fileName === "webstorm64.exe") {
                foundExe = item;
            }
        }
        // Only recurse into directories when an exe has not been found.
        return foundExe === undefined;
    });

    return foundExe === undefined ?
        new FailedResult("Could not find JetBrains IDE executable.") :
        new SucceededResult(foundExe);
}
