import { appendToCaptlogIfNeeded } from "./captlog";
import { Directory } from "./depot/directory";
import { File } from "./depot/file";
import { openInEmacs } from "./depot/editor";
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


async function main(): Promise<Result<undefined, string>> {
    // Append to the captlog file if needed.
    const captlogRes = await appendToCaptlogIfNeeded();
    const todoFileRes = getTodoFile();
    const clipPaletteFileRes = getClipPaletteFile();
    const notesDirRes = getNotesFolder();

    const allRes = Result.allM(captlogRes, todoFileRes, clipPaletteFileRes, notesDirRes);
    if (allRes.failed) {
        return allRes;
    }

    openInEmacs(
        [
            allRes.value[2],
            allRes.value[3],
            allRes.value[0],
            allRes.value[1]
        ],
        false
    );

    return new SucceededResult(undefined);
}


function getTodoFile(): Result<File, string> {
    const cloudHome = process.env.CLOUDHOME;
    if (!cloudHome) {
        return new FailedResult(`CLOUDHOME environment variable is not set.`);
    }

    return new SucceededResult(new File(cloudHome, "data", "todo.org"));
}


function getClipPaletteFile(): Result<File, string> {
    const cloudHome = process.env.CLOUDHOME;
    if (!cloudHome) {
        return new FailedResult(`CLOUDHOME environment variable is not set.`);
    }

    return new SucceededResult(new File(cloudHome, "data", "clippalette.org"));
}


function getNotesFolder(): Result<Directory, string> {
    const cloudHome = process.env.CLOUDHOME;
    if (!cloudHome) {
        return new FailedResult(`CLOUDHOME environment variable is not set.`);
    }

    return new SucceededResult(new Directory(cloudHome, "data", "notes"));
}
