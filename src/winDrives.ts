////////////////////////////////////////////////////////////////////////////////
//
// A script that maps most frequently used folders to drive letters.
//
////////////////////////////////////////////////////////////////////////////////

import _ from "lodash";
import { Directory } from "./depot/directory";
import { FailedResult, Result, SucceededResult } from "./depot/result";
import { spawn, spawnErrorToString } from "./depot/spawn2";


type DriveMappings = Map<string, Directory>;
// type IDriveMapping {
//     driveLetter: string;
//     dir:         Directory;
// }

function getMappings(): Result<DriveMappings, string> {

    const homeRes = Result.requireTruthy("HOME environment variable does not exist.", process.env.HOME);
    if (homeRes.failed) {
        return homeRes;
    }

    const mapping = new Map<string, Directory>([
        ["O", new Directory(homeRes.value, "OneDrive - Rockwell Automation, Inc", "home", "rok_data")]
    ]);
    return new SucceededResult(mapping);

}


if (require.main === module) {
    main()
    .then((exitCode) => {
        if (exitCode !== 0) {
            process.exit(exitCode);
        }
    })
    .catch((err: Error) => {
        console.error(err.message);
        process.exit(-1);
    });
}


async function main(): Promise<number> {

    const mappingsRes = getMappings();
    if (mappingsRes.failed) {
        console.error(mappingsRes.error);
        return -1;
    }

    const results = await createMappings(mappingsRes.value);
    const [successes, failures] = _.partition(results, (curRes) => curRes.succeeded);
    successes.forEach((curSuccess) => {
        console.log(curSuccess.value);
    });
    failures.forEach((curFailure) => {
        console.error(curFailure.error);
    });

    return failures.length > 0 ? -1 : 0;
}


async function createMappings(mappings: DriveMappings): Promise<Array<Result<string, string>>> {

    const promiseResults =
        Array.from(mappings.entries())
        .map(([driverLetter, dir]) => createMapping(driverLetter, dir));

    return Promise.all(promiseResults);

}


async function createMapping(driverLetter: string, dir: Directory): Promise<Result<string, string>> {

    const driveStr = `${driverLetter}:`;

    const driveDir = new Directory(driveStr);
    if (driveDir.existsSync()) {
        return new FailedResult(`Drive letter ${driveStr} is already in use.`);
    }

    const res = await spawn("subst", [driveStr, dir.absPath()]).closePromise;
    return res.succeeded ?
        new SucceededResult(`Successfully mapped ${driveStr} to ${dir.toString()}`) :
        new FailedResult(spawnErrorToString(res.error));
}
