////////////////////////////////////////////////////////////////////////////////
//
// A script that maps most frequently used folders to drive letters.
//
////////////////////////////////////////////////////////////////////////////////

import _ from "lodash";
import table from "text-table";
import { Directory } from "./depot/directory";
import { FailedResult, Result, SucceededResult } from "./depot/result";
import { spawn, spawnErrorToString } from "./depot/spawn2";


interface IDriveMapping {
    driveLetter: string;
    dir:         Directory;
}


function getMappings(): Result<IDriveMapping[], string> {

    const homeRes = Result.requireTruthy("HOME environment variable does not exist.", process.env.HOME);
    if (homeRes.failed) {
        return homeRes;
    }

    const mappings: IDriveMapping[] = [
        {
            driveLetter: "D",
            dir:         new Directory(homeRes.value, "OneDrive - Rockwell Automation, Inc", "Desktop")
        },
        {
            driveLetter: "O",
            dir:         new Directory(homeRes.value, "OneDrive - Rockwell Automation, Inc", "home", "rok_data")
        },
        {
            driveLetter: "S",
            dir:         new Directory(homeRes.value, "SynologyDrive", "Drive", "home", "data")
        },
    ];

    return new SucceededResult(mappings);
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

    // Print the mapping information.
    const rows = mappingsRes.value.map((mapping) => [`${mapping.driveLetter}:`, mapping.dir]);
    console.log(table(rows, {hsep: " ==> "}));
    console.log("");

    // Create the mappings.
    const results = await createMappings(mappingsRes.value);
    const [successes, failures] = _.partition(results, (curRes) => curRes.succeeded);

    // Print info about the successful mappings.
    successes.forEach((curSuccess) => {
        console.log(`Successfully mapped ${curSuccess.value!.driveLetter} to "${curSuccess.value!.dir}".`);
    });

    // Print info about failed mappings.
    failures.forEach((curFailure) => {
        console.error(curFailure.error);
    });

    return failures.length > 0 ? -1 : 0;
}


async function createMappings(mappings: IDriveMapping[]): Promise<Array<Result<IDriveMapping, string>>> {
    return Promise.all(mappings.map(createMapping));
}


async function createMapping(mapping: IDriveMapping): Promise<Result<IDriveMapping, string>> {

    const driveStr = `${mapping.driveLetter}:`;

    const driveDir = new Directory(driveStr);
    if (driveDir.existsSync()) {
        return new FailedResult(`Drive letter ${driveStr} is already in use.`);
    }

    if (!mapping.dir.existsSync()) {
        return new FailedResult(`The directory "${mapping.dir.toString()}" does not exist.`);
    }

    const res = await spawn("subst", [driveStr, mapping.dir.absPath()]).closePromise;
    return res.succeeded ?
        new SucceededResult(mapping) :
        new FailedResult(spawnErrorToString(res.error));
}
