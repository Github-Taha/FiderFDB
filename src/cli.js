const readline = require("readline");
const { Tokenizer, Parser } = require("./filterParser");
const { getDefaultResultOrder } = require("dns");

const dashServerURL = "http://localhost:8080";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion (query) {
    return new Promise((resolve) => rl.question(query, resolve));
}

async function askInteger (query, error) {
    let input;

    do {
        input = (await askQuestion(query)).trim();
        input = parseInt(input);

        if (!isNaN(input) && input >= 0 && input < 2**32) {
            return input;
        }
        else {
            console.log(error);
        }

    } while (true);
}

async function askLong (query, error) {
    let input;

    do {
        input = (await askQuestion(query)).trim();

        try {
            input = BigInt(input);
        }
        catch (err) {
            console.log(error);
        }

        if (input < 2 ** 64 && input >= 0) {
            return input;
        }
        else {
            console.log(error);
        }

    } while (true);
}

async function askFloat (query, error) {
    let input;

    do {
        input = (await askQuestion(query)).trim();
        input = parseFloat(input);

        if (!isNaN(input)) {
            return input;
        }
        else {
            console.log(error);
        }

    } while (true);
}

async function askString (query, error = "") {
    let input;

    do {
        input = (await askQuestion(query)).trim();

        if (input != "") {
            return input;
        }
        else {
            console.log(error);
        }
    } while (true);
}

const wait = (ms) => new Promise( (resolve) => (setTimeout(resolve, ms)) );

function printDBSTartMessage () {
    console.clear();
    console.log(`\x1b[36m=====================================================`);
    console.log(        `          ----- Welcome to DashDB CLI -----`);
    console.log(`=====================================================\x1b[0m\n`);
    console.log("Type 'help' for commands to run.\n")
}

function printDBHelp () {
    console.log(`\n\x1b[33mAvailable Commands:\x1b[0m`);
    console.log(`  help                    - Print this help message`);
    console.log(`  list                    - List all the available databases`);
    console.log(`  create                  - Create a database`);
    console.log(`  delete                  - Delete a database`);
    console.log(`  enter                   - Enter a database`);
    console.log(`  exit                    - Exit this program`);
    console.log("");
}

function printTableStartMessage () {
    console.clear();
    console.log(`\x1b[36m=====================================================`);
    console.log(        `----- Database ${currentDB}`);
    console.log(`=====================================================\x1b[0m\n`);
    console.log("Type 'help' for commands to run.\n")
}

function printTableHelp () {
    console.log(`\n\x1b[33mAvailable Commands:\x1b[0m`);
    console.log(`  help                    - Print this help message`);
    console.log(`  list                    - List all the available tables`);
    console.log(`  createT                 - Create a table`);
    console.log(`  deleteT                 - Delete a table`);
    console.log(`  schema                  - Delete a table`);
    console.log(`  read                    - Read entries`);
    console.log(`  write                   - Write entries`);
    console.log(`  delete                  - Delete entries`);
    console.log(`  add                     - Add an entry`);
    console.log(`  exit                    - Exit this database`);
    console.log("");
}

async function getDatabaseName () {
    while (true) {
        const query = (await askQuestion("  Database Name: ")).trim();

        if (query === "") {
            console.log(`\n\x1b[31m  Enter Valid Name.\x1b[0m\n`);
            continue;
        }
        if (!(/^[a-zA-Z]\w*$/.test(query))) {
            console.log(`\n\x1b[31m  Enter Valid Name.\x1b[0m\n`);
            continue;
        }

        return query;
    }
}

async function getTableName () {
    while (true) {
        const query = (await askQuestion("  Table Name: ")).trim();

        if (query === "") {
            console.log(`\n\x1b[31m  Enter Valid Name.\x1b[0m\n`);
            continue;
        }
        if (!(/^[a-zA-Z]\w*$/.test(query))) {
            console.log(`\n\x1b[31m  Enter Valid Name.\x1b[0m\n`);
            continue;
        }

        return query;
    }
}

function validType (type) {
    if (type === "int" || type === "float" || type === "long")
        return true;
    if (type.startsWith("str")) {
        const len = parseInt(type.substr(3, type.length));
        if (!len || len < 0)
            return false;
        return true;
    }

    return false;
}

function printSchema (schema) {
    let nameLine = "  |";
    let edgeLine = "  +";
    let typeLine = "  |";

    for (const name in schema) {
        const type = schema[name];

        let nameBuffer = "";
        let typeBuffer = "";
        let edgeBuffer = "";

        let maxLen = Math.max(name.length, schema[name].length);

        for (let i = 0; i < maxLen; i++) {
            nameBuffer += " ";
            typeBuffer += " ";
            edgeBuffer += "-";
        }

        nameBuffer = nameBuffer.split("");
        typeBuffer = typeBuffer.split("");

        for (let i = 0; i < name.length; i++)
            nameBuffer[Math.floor(nameBuffer.length / 2 - name.length / 2) + i] = name[i];
        for (let i = 0; i < type.length; i++)
            typeBuffer[Math.floor(typeBuffer.length / 2 - type.length / 2) + i] = type[i];

        nameLine += ` \x1b[35m${nameBuffer.join("")}\x1b[0m |`;
        typeLine += ` \x1b[35m${typeBuffer.join("")}\x1b[0m |`;
        edgeLine += `-${edgeBuffer}-+`;
    }

    console.log(edgeLine);
    console.log(nameLine);
    console.log(edgeLine);
    console.log(typeLine);
    console.log(edgeLine);
}

function printTableTitle (schema) {
    let nameLine = "  |";
    let edgeLine = "  +";
    
    for (const name in schema) {
        const type = schema[name];

        let nameBuffer = "";
        let edgeBuffer = "";

        let len = getPrintValueLength(type);

        for (let i = 0; i < len; i++) {
            nameBuffer += " ";
            edgeBuffer += "-";
        }

        nameBuffer = nameBuffer.split("");

        for (let i = 0; i < name.length; i++) {
            nameBuffer[Math.floor(nameBuffer.length / 2 - name.length / 2) + i] = name[i];
        }

        nameLine += ` \x1b[35m${nameBuffer.join("")}\x1b[0m |`;
        edgeLine += `-${edgeBuffer}-+`;
    }

    console.log(edgeLine);
    console.log(nameLine);
    console.log(edgeLine);
}

async function getTableSchema() {
    const validTypes = ["int", "float", "long", "str"];
    let schema = {};

    while (true) {
        const query = (await askQuestion("  Column: ")).trim();

        if (query === "") {
            console.log(`\n\x1b[31m  Enter valid column statement.\x1b[0m\n`);
            continue;
        }

        if (query === "q") {
            break;
        }

        const querySplit = query.split(/\s+/);

        if (querySplit.length != 2) {
            console.log(`\n\x1b[31m  Enter valid column statement.\x1b[0m\n`);
            continue;
        }

        if (!(/^[a-zA-Z]\w*$/.test(querySplit[0]))) {
            console.log(`\n\x1b[31m  Enter valid name.\x1b[0m\n`);
            continue;
        }

        if (!validType(querySplit[1])) {
            console.log(`\n\x1b[31m  Enter valid type.\x1b[0m\n`);
            continue;
        }

        schema[querySplit[0]] = querySplit[1];
    }

    return schema;
}

async function getSchema (tableName) {
    const url = `${dashServerURL}/api/table/schema`;

    const queryPayload = {
        dbname: currentDB,
        tableName: tableName
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        return data.schema;
    }
    catch (networkError) {
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }

    return;
}

async function getTableData (schema) {
    let input = {};

    for (const name in schema) {
        const type = schema[name];

        if (type === "int") {
            let num = await askInteger(`  ${name} - Enter Integer: `, "\x1b[33mEnter valid integer.\x1b[0m\n");
            input[name] = num;
        }
        else if (type === "float") {
            let num = await askFloat(`  ${name} - Enter Float: `, "\x1b[33mEnter valid float.\x1b[0m\n");
            input[name] = num;
        }
        else if (type === "long") {
            let num = await askLong(`  ${name} - Enter Long: `, "\x1b[33mEnter valid long.\x1b[0m\n");
            input[name] = num.toString();
        }
        else if (type.startsWith("str")) {
            let string = await askString(`  ${name} - Enter String (Len=` + type.substr(3, type.length) + "): ", "\x1b[33mEnter valid string.\x1b[0m\n");
            input[name] = string;
        }
    }

    return input;
}

async function getColumns (schema) {
    let columns = [];
    let colSchema = {};

    getColumnsLoop: while (true) {
        const query = (await askQuestion("  Columns: ")).trim();

        if (query === "") {
            console.log(`\n\x1b[31m  Enter valid column statement.\x1b[0m\n`);
            continue;
        }

        if (query === "*") {
            columns = Object.keys(schema);
            colSchema = schema;
            return { columns, colSchema };
        }
        
        const querySplit = query.split(/\s+/);

        for (let i = 0; i < querySplit.length; i++) {
            const name = querySplit[i];
            if (name in schema) {
                columns.push(name);
                colSchema[name] = schema[name];
            }
            else {
                console.log(`\n\x1b[31m  Item ${name} not in table.\x1b[0m\n`);
                continue getColumnsLoop;
            }
        }

        break;
    }

    return { columns, colSchema };
}

async function getFilter (schema) {
    let tokens = [];

    while (true) {
        const cond = (await askQuestion("  Filter: ")).trim();
        
        if (cond === " ") {
            console.log(`\x1b[33m  Enter valid filter.\x1b[0m\n`);
        }

        if (cond === "-") {
            break;
        }

        try {
            let parser = new Tokenizer(cond);
            parser.parse();
    
            let tokenParser = new Parser(parser.tokens, schema);
            tokenParser.parse();

            tokens = parser.tokens;
        }
        catch (err) {
            console.log(`\x1b[31m  Error: ${err.message}\x1b[0m\n`);
            continue;
        }

        break;
    }

    return tokens;
}

async function getOrder (schema) {
    while (true) {
        const query = (await askQuestion("  Order: ")).trim();

        if (query === "") {
            console.log("\n\x1b[31m  Enter valid order statement.\x1b[0m\n");
            continue;
        }

        if (query === "-") {
            return [];
        }

        const querySplit = query.split(/\s+/);

        if (querySplit.length != 2) {
            console.log("\n\x1b[31m  Enter valid order statement.\x1b[0m\n");
            continue;
        }

        if (!(querySplit[0] in schema)) {
            console.log(`\n\x1b[31m  Unknown item name: ${querySplit[0]}.\x1b[0m\n`);
            continue;
        }

        if (!(["asc", "desc"]).includes(querySplit[1].toLowerCase())) {
            console.log(`\n\x1b[31m  Unknown order: ${querySplit[1]}.\x1b[0m\n`);
            continue;
        }

        return querySplit;
    }
}

function getPrintValueLength (type) {
    if (type === "int")
        return 10;
    else if (type === "float")
        return 10;
    else if (type === "long")
        return 20;
    else if (type.startsWith("str"))
        return parseInt(type.substr(3, type.length));
}

function printTableItem (schema, data) {
    let dataLine = "  |";
    let edgeLine = "  +";

    for (const name in schema) {
        const type = schema[name];
        const itemData = data[name].toString();

        let dataBuffer = "";
        let edgeBuffer = "";

        let len = getPrintValueLength(type);

        for (let i = 0; i < len; i++) {
            dataBuffer += " ";
            edgeBuffer += "-";
        }

        dataBuffer = dataBuffer.split("");

        for (let i = 0; i < itemData.length; i++) {
            if (type === "int" || type === "float" || type === "long")
                dataBuffer[Math.floor(dataBuffer.length / 2 - itemData.length / 2) + i] = itemData[i];
            else
                dataBuffer[i] = itemData[i];
        }

        dataLine += ` ${dataBuffer.join("")} |`;
        edgeLine += `-${edgeBuffer}-+`;
    }

    console.log(dataLine);
    console.log(edgeLine);
}

async function DB_list () {
    const url = `${dashServerURL}/api/databases`;

    try {
        const response = await fetch(url, {
            method: "GET",
        });

        const data = await response.json();
    
        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        if (data.databases.length === 0) {
            console.log("\nYou don't have any databases!\nCreate one using the 'create' command\n");
        }
        else {
            console.log(`\n\x1b[33mAvailable Databases:\x1b[0m`);
            for (let i = 0; i < data.databases.length; i++) {
                console.log(`  ${i + 1}. ${data.databases[i]}`);
            }
            console.log("");
        }
    }
    catch (networkError) {
        console.log(networkError);
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }
}

async function DB_create () {
    const url = `${dashServerURL}/api/database/create`;

    console.log();
    const queryPayload = {
        dbname: await getDatabaseName()
    };
    console.log();

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        if (data.created) {
            console.log(`\n\x1b[32mDatabase created successfully.\x1b[0m`);
        }
        else {
            console.log(`\n\x1b[31mAn error occured while creating database.\x1b[0m`);
        }
        console.log("");
    }
    catch (networkError) {
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }
}

async function DB_delete () {
    const url = `${dashServerURL}/api/database/delete`;

    console.log();
    const queryPayload = {
        dbname: await getDatabaseName()
    };
    console.log();

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        if (data.deleted) {
            console.log(`\n\x1b[32mDatabase deleted successfully.\x1b[0m`);
        }
        else {
            console.log(`\n\x1b[31mAn error occured while deleted database.\x1b[0m`);
        }
        console.log("");
    }
    catch (networkError) {
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }
}

async function DB_enter () {
    const url = `${dashServerURL}/api/database/verify`;

    console.log();
    const queryPayload = {
        dbname: await getDatabaseName()
    };
    console.log();

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        if (data.exists) {
            console.log(`\n\x1b[32mEntering Database.\x1b[0m`);
            currentDB = queryPayload.dbname;
            await wait(500);
        }
        else {
            console.log(`\n\x1b[31mDatabase doesn't exist.\x1b[0m`);
        }
        console.log("");
    }
    catch (networkError) {
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }
}

async function Table_list () {
    const url = `${dashServerURL}/api/database/tables`;

    const queryPayload = {
        dbname: currentDB
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        if (data.tables.length === 0) {
            console.log("\nYou don't have any tables!\nCreate one using the 'create' command\n");
        }
        else {
            console.log(`\n\x1b[33mAvailable Tables:\x1b[0m`);
            for (let i = 0; i < data.tables.length; i++) {
                console.log(`  ${i + 1}. ${data.tables[i]}`);
            }
            console.log("");
        }
    }
    catch (networkError) {
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }
}

async function Table_createT () {
    const url = `${dashServerURL}/api/table/create`;

    console.log();
    const queryPayload = {
        dbname: currentDB,
        tableName: await getTableName(),
        schema: await getTableSchema()
    };
    console.log();

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        console.log(`\n\x1b[32mCreated Table: ${queryPayload.tableName}.\x1b[0m\n`);
    }
    catch (networkError) {
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }
}

async function Table_deleteT () {
    const url = `${dashServerURL}/api/table/delete`;

    console.log();
    const queryPayload = {
        dbname: currentDB,
        tableName: await getTableName()
    };
    console.log();

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        console.log(`\n\x1b[32mDeleted Table: ${queryPayload.tableName}.\x1b[0m\n`);
    }
    catch (networkError) {
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }
}

async function Table_schema () {
    const url = `${dashServerURL}/api/table/schema`;

    console.log();
    const queryPayload = {
        dbname: currentDB,
        tableName: await getTableName()
    };
    console.log();

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        console.log(`\n\x1b[33mTable '${queryPayload.tableName}':\x1b[0m`);
        printSchema(data.schema);
        console.log();
    }
    catch (networkError) {
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }
}

async function Table_add () {
    const url = `${dashServerURL}/api/data/add`;

    console.log();
    const tableName = await getTableName();

    const schema = await getSchema(tableName);
    if (!schema) {
        console.log("\x1b[31mError getting Schema.\x1b[0m\n");
        return;
    }

    console.log();
    const data = await getTableData(schema);
    
    const queryPayload = {
        dbname: currentDB,
        tableName,
        data,
    };
    console.log();

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        console.log(`\n\x1b[32mEntry added successfully.\x1b[0m\n`);
    }
    catch (networkError) {
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }
}

async function Table_write () {
    const url = `${dashServerURL}/api/data/write`;

    console.log();
    const tableName = await getTableName();

    const schema = await getSchema(tableName);
    if (!schema) {
        console.log("\x1b[31mError getting Schema.\x1b[0m\n");
        return;
    }

    const filterTokens = await getFilter(schema);

    const {columns, colSchema} = await getColumns(schema);

    console.log();
    const data = await getTableData(colSchema);
    
    const queryPayload = {
        dbname: currentDB,
        tableName,
        filter: filterTokens,
        cols: columns,
        data,
    };
    console.log();

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload)
        });

        const raw = await response.text();
        console.log(raw);
        const data = JSON.parse(raw);

        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        console.log(`\n\x1b[32mEntries written successfully.\x1b[0m\n`);
    }
    catch (networkError) {
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }
}

async function Table_read () {
    const url = `${dashServerURL}/api/data/read`;

    console.log();
    const tableName = await getTableName();

    const schema = await getSchema(tableName);
    if (!schema) {
        console.log("\x1b[31mError getting Schema.\x1b[0m\n");
        return;
    }

    const filterTokens = await getFilter(schema);
    const {columns, colSchema} = await getColumns(schema);
    const order = await getOrder(schema);
    
    const queryPayload = {
        dbname: currentDB,
        tableName,
        filter: filterTokens,
        cols: columns,
        order
    };
    console.log();

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        console.log(`\nTable \x1b[33m${tableName}\x1b[0m:`);
        printTableTitle(colSchema);
        for (let i = 0; i < data.data.length; i++)
            printTableItem(colSchema, data.data[i]);
        console.log();
    }
    catch (networkError) {
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }
}

async function Table_delete () {
    const url = `${dashServerURL}/api/data/delete`;

    console.log();
    const tableName = await getTableName();

    const schema = await getSchema(tableName);
    if (!schema) {
        console.log("\x1b[31mError getting Schema.\x1b[0m\n");
        return;
    }

    const filterTokens = await getFilter(schema);
    
    const queryPayload = {
        dbname: currentDB,
        tableName,
        filter: filterTokens,
    };
    console.log();

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(`\n\x1b[31m[${response.status} Error]: ${data.error}\x1b[0m\n`);
            return null;
        }

        console.log(`\n\x1b[32mEntries Deleted successfully.\x1b[0m\n`);
    }
    catch (networkError) {
        console.error(`\n\x1b[31mNetwork Error: ${networkError.message}\x1b[0m`);
        console.log("");
    }
}

let currentDB;

(async () => {

    printDBSTartMessage();
    currentDB = "";

    commandLoop: while (true) {
        if (currentDB === "") {
            // Database
            const command = (await askQuestion("\x1b[36m>\x1b[0m ")).trim();
            
            if (command === "")
                continue;
    
            switch (command) {
                case "help":
                    printDBHelp();
                    break;

                case "list":
                    await DB_list();
                    break;

                case "enter":
                    await DB_enter();
                    if (currentDB != "")
                        printTableStartMessage();
                    break;

                case "create":
                    await DB_create();
                    break;
                
                case "delete":
                    await DB_delete();
                    break;
    
                case "clear":
                    printDBSTartMessage();
                    break;

                case "exit":
                    rl.close();
                    break commandLoop;
    
                default:
                    console.log("\n\x1b[31mInvalid Command\x1b[0m\n");
                    break;
            }
        }
        else {
            // Table
            const command = (await askQuestion(`\x1b[36m${currentDB}>\x1b[0m `)).trim();
            
            if (command === "")
                continue;
    
            switch (command) {
                case "help":
                    printTableHelp();
                    break;

                case "list":
                    await Table_list();
                    break;

                case "createT":
                    await Table_createT();
                    break;

                case "deleteT":
                    await Table_deleteT();
                    break;

                case "schema":
                    await Table_schema();
                    break;

                case "read":
                    await Table_read();
                    break;

                case "write":
                    await Table_write();
                    break;

                case "delete":
                    await Table_delete();
                    break;

                case "add":
                    await Table_add();
                    break;
    
                case "clear":
                    printTableStartMessage();
                    break;
                    
                case "exit":
                    printDBSTartMessage();
                    currentDB = "";
                    break;
    
                default:
                    console.log("\n\x1b[31mInvalid Command\x1b[0m\n");
                    break;
            }
        }
    }

    console.log("\n\x1b[32mBye!\x1b[0m\n");

})();
