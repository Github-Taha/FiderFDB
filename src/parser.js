const { error } = require("console");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion (query) {
    return new Promise((resolve) => rl.question(query, resolve));
}

const SIGNS = [">", "<", "=", ">=", "<=", "!=", ":"];
const STRING_SIGNS = ["=", "!=", ":"];
const INT_SIGNS = [">", "<", "=", ">=", "<=", "!="];
const KEYWORDS = ["and", "or"];

class Tokenizer {
    constructor (text) {
        this.text = text;
        this.idx = 0;
        this.tokens = [];
        this.parsing = false;
    }

    static Types = {
        NAME: "NAME",
        STRING: "STRING",
        NUM: "NUM",
        SIGN: "SIGN",
        PARAN: "PARAN",
        KEYW: "KEYW",
    };

    parseWord () {
        let word = this.getLetter();
        let letter = this.nextLetter();

        while ((/\w/).test(letter) && !this.endString()) {
            word += letter;
            letter = this.nextLetter();
        }

        return word;
    }

    parseString () {
        let start = this.getLetter();
        let str = "";
        let letter = this.nextLetter();
        let special = false;

        while (!this.endString()) {
            if (special) {
                console.log(letter);

                switch (letter) {
                    case "\\":
                        str += "\\";
                        break;

                    case start:
                        str += start;
                        break;

                    default:
                        throw new Error("Invalid special char: " + this.idx);
                }

                special = false;
                letter = this.nextLetter();
            }

            if (letter == "\\") {
                special = true;
                letter = this.nextLetter();
                continue;
            }

            if (letter == start)
                break;

            str += letter;
            letter = this.nextLetter();
        }

        if (this.endString())
            throw new Error("String not Ended");

        return str;
    }

    parseNumber () {
        let num = this.getLetter();
        let letter = this.nextLetter();
        let numDots = 0;

        while ((/[\d.]/).test(letter) && !this.endString()) {
            if (letter == ".")
                numDots ++;

            if (numDots > 1) {
                throw new Error("Invalid number: " + this.idx);
                break;
            }

            num += letter;
            letter = this.nextLetter();
        }

        if (num.endsWith(".")) 
            throw new Error("Invalid number: " + this.idx);

        return num;
    }

    parseSign () {
        let sign = this.getLetter();
        let letter = this.nextLetter();

        while ((/[^\w()\s]/).test(letter) && !this.endString()) {
            sign += letter;
            letter = this.nextLetter();
        }

        if (!SIGNS.includes(sign))
            throw new Error("Invalid Sign: " + this.idx);

        return sign;
    }

    parseLetter () {
        const letter = this.getLetter();

        if (/[a-zA-Z]/.test(letter)) {
            const word = this.parseWord();

            if (this.error != "")
                return;

            this.tokens.push({
                type: Tokenizer.Types.NAME,
                value: word
            });
            return;
        }

        else if (/[\(\)]/.test(letter)) {
            this.tokens.push({
                type: Tokenizer.Types.PARAN,
                value: letter
            });
        }

        else if (/[><=!:]/.test(letter)) {
            const sign = this.parseSign();

            if (this.error != "")
                return;

            this.tokens.push({
                type: Tokenizer.Types.SIGN,
                value: sign
            });
            return;
        }

        else if (/\s/.test(letter)) {

        }

        else if (letter == "\"" || letter == "'") {
            const str = this.parseString(letter);

            if (this.error != "")
                return;

            this.tokens.push({
                type: Tokenizer.Types.STRING,
                value: str
            });
        }

        else if (/\d/.test(letter)) {
            const num = this.parseNumber();

            if (this.error != "")
                return;

            this.tokens.push({
                type: Tokenizer.Types.NUM,
                value: num
            });
            return;
        }

        else {
            throw new Error("Invalid token: " + this.idx);

            return;
        }

        this.nextLetter();
    }

    parse () {
        this.error = "";
        this.parsing = true;

        while (this.parsing && !this.endString()) {
            this.parseLetter();

            if (this.error != "")
                return this.error;
        }
    }

    getLetter (idx = null) {
        return this.text[idx || this.idx];
    }

    nextLetter () {
        this.idx ++;
        return this.text[this.idx];
    }

    endString () {
        return this.idx > this.text.length - 1;
    }
}

class Parser {

    static Types = {
        IDENTIFIER: "IDENTIFIER",
        LITERAL_N: "LITERAL_N",
        LITERAL_S: "LITERAL_S",
        BINARY_OP: "BINARY_OP",
        LOGICAL: "LOGICAL",
    };

    constructor (tokens, values) {
        this.tokens = tokens;
        this.values = values;
        this.index = 0;
    }

    parse () {
        return this.parseLogical();
    }

    // Handles 'and' and 'or'
    parseLogical () {
        let left = this.parseComparison();

        while (
            this.peek() && 
            this.peek().type === Tokenizer.Types.NAME && 
            KEYWORDS.includes(this.peek().value.toLowerCase())
        ) {
            const operator = this.consume().value.toLowerCase();
            const right = this.parseComparison();
            left = {
                type: Parser.Types.LOGICAL,
                operator,
                left, right
            };
        }

        return left;
    }

    // Handles Comaprisons
    parseComparison () {
        let left = this.parsePrimary();

        while (this.peek() && this.peek().type === Tokenizer.Types.SIGN) {
            const operator = this.consume().value;
            const right = this.parsePrimary();

            // Check Validity of operation
            {
                const leftType = Parser.getPrimaryType(this.values, left);
                const rightType = Parser.getPrimaryType(this.values, right);

                if (leftType != rightType)
                    throw new Error("Operand types don't match.");

                if (leftType === "str" && !STRING_SIGNS.includes(operator))
                    throw new Error("Invalid Operator for string type.");

                if (leftType === "int" && !INT_SIGNS.includes(operator))
                    throw new Error("Invalid Operator for string type.");
            }

            left = {
                type: Parser.Types.BINARY_OP,
                operator,
                left, right
            }
        }

        return left;
    }

    // Handles Variables, Numbers, and Paranthesis
    parsePrimary () {
        const token = this.peek();

        if (!token) {
            throw new Error("Unexpected end of input.");
        }

        // Handle Paranthesis
        if (token.type === Tokenizer.Types.PARAN && token.value === "(") {
            this.consume();
            const node = this.parseLogical();

            const closing = this.consume();
            if (!closing || closing.value !== ")") {
                throw new Error("Expected closing paranthesis.");
            }

            return node;
        }

        // Handle Leaf Nodes (Variables, Numbers)
        if (token.type === Tokenizer.Types.NAME) {
            this.consume();

            // Check Validity of Token
            if (!(token.value in this.values)) {
                throw new Error(`No value named ${token.value} in table.`);
            }

            return {
                type: Parser.Types.IDENTIFIER,
                value: token.value
            };
        }

        if (token.type === Tokenizer.Types.NUM) {
            this.consume();
            return {
                type: Parser.Types.LITERAL_N,
                value: Number(token.value)
            };
        }

        if (token.type === Tokenizer.Types.STRING) {
            this.consume();
            return {
                type: Parser.Types.LITERAL_S,
                value: token.value
            };
        }

        throw new Error("Unexpected token value.");
    }

    static getPrimaryType (values, prim) {
        if (prim.type === Parser.Types.LITERAL_N) {
            return "num";
        }
        if (prim.type === Parser.Types.LITERAL_S) {
            return "str";
        }

        if (prim.type === Parser.Types.IDENTIFIER) {
            if (values[prim.value] === "int" || values[prim.value] === "float")
                return "num";
            else
                return "str";
        }
    }

    peek () {
        return this.tokens[this.index];
    }

    consume () {
        return this.tokens[this.index ++];
    }
}

class AST {
    constructor (ast) {}

    evaluate (node, data) {
        switch (node.type) {
            // Literals
            case Parser.Types.LITERAL_N:
            case Parser.Types.LITERAL_S:
                return node.value;
            case Parser.Types.IDENTIFIER:
                return data[node.value];

            case Parser.Types.BINARY_OP:
                return this.evalulateBinaryOp(
                    this.evaluate(node.left, data),
                    node.operator,
                    this.evaluate(node.right, data)
                );
            case Parser.Types.LOGICAL:
                return this.evaluateLogical(
                    this.evaluate(node.left, data),
                    node.operator,
                    this.evaluate(node.right, data)
                );
        }
    }

    evalulateBinaryOp (left, oper, right) {
        switch (oper) {
            case "=":
                return left === right;
            case "!=":
                return left !== right;
            case ">":
                return left > right;
            case "<":
                return left < right;
            case ">=":
                return left >= right;
            case "<=":
                return left <= right;
            case ":":
                return left.includes(right);
            default:
                return false;
        }
    }

    evaluateLogical (left, oper, right) {
        switch (oper) {
            case "and":
                return left && right;
            case "or":
                return left || right;
        }
    }
}

function evalulateCondition (prompt, values, item) {
        let parser = new Tokenizer(prompt);
        parser.parse();

        let tokenParser = new Parser(parser.tokens, values);
        let ast = tokenParser.parse();

        let evaulator = new AST();
        let passed = evaulator.evaluate(ast, item);

        return passed;
}

const values = {
    "id": "int",
    "salary": "float",
    "name": "str30"
};

const item = {
    "id": 4,
    "salary": 15312.0,
    "name": "masterryped"
};

(async () => {
    while (true) {
        const prompt = (await askQuestion("cond: ")).trim();
        
        if (prompt == "q")
            break;

        let passed;
        try {
            passed = evalulateCondition(prompt, values, item);
        }
        catch (err) {
            console.log(`\x1b[31mError: ${err.message}\x1b[0m`);
            continue;
        }

        console.log(passed);
    }

    rl.close();
})();
