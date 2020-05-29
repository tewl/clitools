
if (require.main === module)
{
    main();
}

function main(): void
{
    // The value containing the flags or'ed together.
    const valueToExplain = 36832802;

    // A description of the flags. Array index 0 corresponds to the description
    // of bit 0 (the flag with value 1).
    const flags = [
        "LgxExport_NoXMLHeader",            // = 1
        "LgxExport_NoChildren",             // = 2
        "LgxExport_References",             // = 4
        "LgxExport_ExtendedProperties",     // = 8,
        "LgxExport_Status",                 // = 16
        "LgxExport_NoRawData",              // = 32
        "LgxExport_L5KData",                // = 64
        "LgxExport_DecoratedData",          // = 128
        "LgxExport_Context",                // = 256
        "LgxExport_NoComments",             // = 512
        "LgxExport_NoOperandComments",      // = 1024
        "LgxExport_ReferencesByUId",        // = 2048
        "LgxExport_ProductDefinedTypes",    // = 4096
        "LgxExport_RoutineLabels",          // = 8192,
        "LgxExport_UIds",                   // = 16384,
        "LgxExport_AliasExtras",            // = 32768,
        "LgxExport_IOTags",                 // = 65536,
        "LgxExport_NoStringData",           // = 131072,
        "LgxExport_EmptyValues",            // = 262144,
        "LgxExport_Dependencies",           // = 524288,
        "LgxExport_ForceProtectedEncoding", // = 1048576,
        "LgxExport_NoCRLF",                 // = 2097152,
        "LgxExport_AllProjDocTrans",        // = 4194304,
        "LgxExport_Reserved1",              // = 8388608,
        "LgxExport_LogicalHierarchy",       // = 16777216,
        "LgxExport_NoCustomProperties"      // = 33554432
    ];

    const setBitsExpression = GetSetBitsExpression(valueToExplain, flags);
    console.log(setBitsExpression);
}


function GetSetBitsExpression(value: number, flags: Array<string>): string
{
    const setFlags: Array<string> = [];
    for (let curBitNum = 0; curBitNum <= 63; curBitNum++)
    {
        const curFlagValue = Math.pow(2, curBitNum);
        const curFlagName = flags[curBitNum];

        if (value & curFlagValue) {
            setFlags.push(curFlagName);
        }
    }

    return setFlags.join(" |\n");
}
