import { evaluate } from "./depot/expression";
import { succeeded } from "./depot/result";

const expression = process.argv[2];
const result = evaluate(expression);

if (succeeded(result)) {

    const reduceResult = result.value.reduce();
    let answer = `${expression} = ${result.value}`;
    if (reduceResult.wasReduced) {
        answer += ` = ${reduceResult.reducedFraction}`;
    }

    console.log(answer);
}
else {
    console.error(result.error);
}
