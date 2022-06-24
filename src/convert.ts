import yargs from "yargs";
import { BufBuilder } from "./depot/bufBuilder";
import { BufReader } from "./depot/bufReader";
import { Directory } from "./depot/directory";
import { sInt8Min, uInt8Max } from "./depot/numericRange";
import { getOs, OperatingSystem } from "./depot/os";


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


interface IConfig {
    val: number;
}


function getConfiguration(): IConfig {
    const argv = yargs
    .usage("Converts a value to other representations.")
    .help()
    .wrap(80)
    .argv;

    return {
        // eslint-disable-next-line radix
        val: parseInt(argv._[0])
    };
}

async function main(): Promise<number> {
    const config = getConfiguration();
    const val = config.val;

    const builder = new BufBuilder();

    if (val > sInt8Min && val < 0) {
        builder.appendInt8(val);
    }
    else if (val < uInt8Max) {
        builder.appendUInt8(val);
    }
    else {
        return Promise.resolve(-1);
    }

    const buf = builder.toBuffer();
    console.log(`UInt8:    ${numberString(new BufReader(buf).readUInt8())}`);
    console.log(`SInt8:    ${numberString(new BufReader(buf).readInt8())}`);


    return Promise.resolve(0);
}


function numberString(x: number): string {
    const negStr = x < 0 ? "-" : "";
    const absVal = Math.abs(x);

    const decStr = x.toString(10);
    const hexStr = negStr + "0x" + absVal.toString(16);
    const binStr = negStr + "0b" + absVal.toString(2);

    return `${decStr} (${hexStr}, ${binStr})`;
}
