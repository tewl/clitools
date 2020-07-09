import * as os from "os";
import * as _ from "lodash";
import {Directory} from "./depot/directory";
import { File } from "./depot/file";


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
    console.log(`argv: ${process.argv[2]}`);

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
    const contents = spotlightAssetsDir.contentsSync(false);

    const promises = _.map(contents.files, async (curAssetFile) => {
        const dstFile = new File(outDir, curAssetFile.baseName + ".jpg");
        curAssetFile.copy(dstFile);
    });

    await Promise.all(promises);
    return 0;
}
