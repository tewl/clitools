import * as yargs from "yargs";
import { Directory } from "./depot/directory";
import { File } from "./depot/file";
import { pipe } from "./depot/pipe";
import { FailedResult, Result, SucceededResult } from "./depot/result";


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

    // TODO: Find C:\Program Files\JetBrains\JetBrains Rider 2022.1.2\bin\rider.bat
    // TODO: Invoke: rider --diff fileOrDirA fileOrDirB

    await 5;
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
        return pipe(
            arg,
            (arg) => arg === undefined ? new FailedResult("File or directory not specified.") : new SucceededResult(arg),
            (res) => Result.bind(isDirOrFile, res)
        );
    }

    return pipe(
        Result.all([argToDirOrFile(argv._[0]), argToDirOrFile(argv._[1])]),
        (res) => Result.augment(
            ([left, right]) => {
                return left.constructor.name === right.constructor.name ?
                    new SucceededResult({}) :
                    new FailedResult("Both arguments must be either a directory or a file.");
            },
            res
        ),
        (res) => Result.mapSuccess(([left, right]) => ({left, right}), res)
    );
}
