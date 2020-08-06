import * as os from "os";
import * as _ from "lodash";
import {Directory} from "./depot/directory";
import { File } from "./depot/file";
import {mapAsync, filterAsync, getTimerPromise, removeAsync} from "./depot/promiseHelpers";
import {FileComparer} from "./depot/diffDirectories";


if (require.main === module)
{
    windowsSpotlightImagesMain()
    .then((exitCode) =>
    {
        if (exitCode !== 0)
        {
            process.exit(exitCode);
        }
    })
    .catch((err) =>
    {
        console.error(JSON.stringify(err, undefined, 4));
        process.exit(-1);
    });
}


async function windowsSpotlightImagesMain(): Promise<number>
{
    const outDirStr = process.argv[2];
    const outDir = new Directory(outDirStr);
    if (outDir.existsSync())
    {
        console.log(`Using existing output directory '${outDir.toString()}'`);
    }
    else
    {
        outDir.ensureExistsSync();
        console.log(`Created output directory '${outDir.toString()}'.`);
    }

    const spotlightAssetsDir = new Directory(os.homedir(), "AppData", "Local", "Packages",
        "Microsoft.Windows.ContentDeliveryManager_cw5n1h2txyewy", "LocalState", "Assets"
    );

    let assetFiles = spotlightAssetsDir.contentsSync(false).files;

    // Keep only the files greater than a certain size.  This gets rid of icons
    // that are also kept in this directory.
    assetFiles = await filterAsync(assetFiles, async (curFile) => {
        const stats = (await curFile.exists())!;
        return stats.size > 200 * 1024;
    });

    const fileComparers = _.map(assetFiles, (curSrcFile) => {
        const destFile = new File(outDir, curSrcFile.baseName + ".jpg");
        return FileComparer.create(curSrcFile, destFile);
    });

    const removed = await removeAsync(fileComparers, async (curFileComparer) => {
        const areIdentical = await curFileComparer.bothExistAndIdentical();
        return areIdentical;
    });

    console.log(`Identical files: ${removed.length}`);
    console.log(`New files:       ${fileComparers.length}`);

    const destFiles = await mapAsync(fileComparers, (curFileComparer) => {
        return curFileComparer.leftFile.copy(curFileComparer.rightFile);
    });

    await getTimerPromise(5 * 1000, true);
    return 0;
}
