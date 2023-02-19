import * as os from "os";
import * as yargs from "yargs";
import { Directory } from "./depot/directory";
import { File } from "./depot/file";
import { FailedResult, Result, SucceededResult } from "./depot/result";
import {getDocumentsFolder} from "platform-folders";
import { CompareResult, compareStrI } from "./depot/compare";
import { getMostRecentlyModified } from "./depot/filesystemHelpers";



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

    const configRes = getConfiguration();
    if (configRes.failed) {
        return configRes;
    }

    const sharexCaptureRes = await getMostRecentSharexScreenCapture();
    if (sharexCaptureRes.failed) {
        return sharexCaptureRes;
    }

    // Do a sanity check and make sure the extensions match.
    const extensionsAreEqual =
        compareStrI(
            configRes.value.dstImgFile.extName,
            sharexCaptureRes.value.extName
        ) === CompareResult.EQUAL;
    if (!extensionsAreEqual) {
        return new FailedResult(`Filename extensions differ between "${configRes.value.dstImgFile.toString()}" and "${sharexCaptureRes.value.toString()}".`);
    }

    await sharexCaptureRes.value.copy(configRes.value.dstImgFile);
    return new SucceededResult(undefined);
}


interface IConfig {
    dstImgFile: File;
}


function getConfiguration(): Result<IConfig, string> {
    const argv = yargs
    .usage(
        [
            "Copies the most recently captured ShareX file to the specified",
            "destination.",
            "",
            "copyLatestShareXImg <destination>"
        ].join(os.EOL)
    )
    .help()
    .wrap(80)
    .argv;

    // Get the destination image file positional parameter.
    const dstImgFile = new File(argv._[0]);
    return new SucceededResult({dstImgFile});
}


async function getMostRecentSharexScreenCapture(): Promise<Result<File, string>> {

    // Get the directory where ShareX saves its files.
    const docsDir = new Directory(getDocumentsFolder());
    const screenshotsDir = new Directory(docsDir, "ShareX", "Screenshots");

    if (!screenshotsDir.existsSync()) {
        return new FailedResult(`ShareX screenshots directory "${screenshotsDir.toString()}" does not exist.`);
    }

    // Within ShareX's "Screenshots" folder, it creates monthly folders (for example, "2023-02").
    // Find the one that has been modified most recently.
    const monthlyDirs = (await screenshotsDir.contents(false)).subdirs;
    const dirRes = await getMostRecentlyModified(monthlyDirs);
    if (dirRes.failed) {
        return dirRes;
    }

    // Find the most recently modified file within the monthly directory.
    const screenshotFiles = (await dirRes.value.fsItem.contents(false)).files;
    const mostRecentScreenshotFileRes = await getMostRecentlyModified(screenshotFiles);
    if (mostRecentScreenshotFileRes.failed) {
        return mostRecentScreenshotFileRes;
    }

    return new SucceededResult(mostRecentScreenshotFileRes.value.fsItem);
}
