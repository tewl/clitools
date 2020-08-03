import * as os from "os";
import * as _ from "lodash";
import {Directory} from "./depot/directory";
import { File } from "./depot/file";
import {mapAsync, filterAsync} from "./depot/promiseHelpers";


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
    console.log(`Output directory: ${process.argv[2]}`);

    const outDirStr = process.argv[2];
    const outDir = new Directory(outDirStr);
    if (!outDir.existsSync())
    {
        console.error(`ERROR: The output directory "${outDirStr}" does not exist.`);
        return Promise.resolve(-1);
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

    const destFiles = await mapAsync(assetFiles, (curFile) => {
        const dstFile = new File(outDir, curFile.baseName + ".jpg");
        return curFile.copy(dstFile);
    });

    console.log(`Copied ${destFiles.length} files.`);
    return 0;
}
