import * as yargs from "yargs";
import { evaluate } from "./depot/expression";
import { succeeded } from "./depot/result";


const argv = yargs
.usage("Evalutates an expression.")
.help()
.wrap(80)
.demandCommand(
    1,
    1,
    "Too few arguments.  Specify the expression (may need quotes).",
    "Too many arguments.  Specify the expression as one argument (may need quotes)."
)
.argv;

const expression = argv._[0];
const result = evaluate(expression);

if (succeeded(result)) {
    const answer = `${expression} = ${result.value.stringRepresentations().join(" = ")}`;
    console.log(answer);
}
else {
    console.error(result.error);
}
