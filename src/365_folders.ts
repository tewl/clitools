////////////////////////////////////////////////////////////////////////////////
//
// A script that outputs the text for 31 days in my implementation of 43 folders
//
////////////////////////////////////////////////////////////////////////////////

import * as os from "os";
import * as yargs from "yargs";
import { FailedResult, Result, SucceededResult } from "./depot/result";

const NUM_DATES = 365;

if (require.main === module) {
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

    for (let dayOffset = 0; dayOffset < NUM_DATES; dayOffset++) {
        const curDate = new Date(
            configRes.value.year,
            configRes.value.month - 1,
            configRes.value.day + dayOffset
        );

        console.log(getDayHeader(curDate));
    }

    await 0;
    return new SucceededResult(undefined);
}


/**
 * Configuration options for this script.
 */
interface IConfig {
     year: number;
     month: number;
     day: number;
}


/**
 * Parses the command line and gathers the options into an easily consumable
 * form.
 * @return The configuration parameters for this script
 */
function getConfiguration(): Result<IConfig, string> {
    const argv = yargs
    .usage(
        [
            "Outputs 31 days worth of 43 folders text.",
            `31_folders <mm/dd/yyyy>`
        ].join(os.EOL)
    )
    .option(
        "year",
        {
            demandOption: true,
            type:         "number",
            describe:     "start day year"
        }
    )
    .option(
        "month",
        {
            demandOption: true,
            type:         "number",
            describe:     "start day month"
        }
    )
    .option(
        "day",
        {
            demandOption: true,
            type:         "number",
            describe:     "start day date"
        }
    )
    .help()
    .wrap(80)
    .argv;

    const year = argv.year;
    if (year < 1900 || year > 3000) {
        return new FailedResult(`Invalid year "${year}".`);
    }

    const month = argv.month;
    if (month < 1 || month > 12) {
        return new FailedResult(`Invalid month "${month}".`);
    }

    const day = argv.day;
    if (day < 1 || day > 31) {
        return new FailedResult(`Invalid date "${day}".`);
    }

    return new SucceededResult({
        year,
        month,
        day
    });
}


function getDayHeader(date: Date): string {
    const header = `* ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${dayOfWeek(date)}`;
    return header;
}


function dayOfWeek(date: Date): string {
    let dayName: string;
    switch (date.getDay()) {
        case 0:
            dayName = "Sunday";
            break;

        case 1:
            dayName = "Monday";
            break;

        case 2:
            dayName = "Tuesday";
            break;

        case 3:
            dayName = "Wednesday";
            break;

        case 4:
            dayName = "Thursday";
            break;

        case 5:
            dayName = "Friday";
            break;

        case 6:
            dayName = "Saturday";
            break;

        default:
            dayName = "Unknown day";
            break;
    }

    return dayName;
}
