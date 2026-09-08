const nativeEngine = require("../build/Release/main.node");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const app = express();
const { Tokenizer, Parser, AST } = require("./filterParser");
const { readFile, createFolder, deleteFolder } = require("./fsHelper");
const { DataBase, Table } = require("./db");
const { Mend } = require("./mend");
const { startNgrok } = require("./tunneling");
const { download } = require("express/lib/response");

app.use(cors({
    origin: "*",
    allowedHeaders: [
        "Content-Type",
        "Bypass-Tunnel-Reminder",
        "Ngrok-Skip-Browser-Warning",
        "X-Auth-Passcode",
    ],
    exposedHeaders: [
        "Content-Disposition"
    ]
}));
app.use(express.json());
app.set('trust proxy', true);

const PORT = 8080;

let databases = [];

const downloadMap = new Map();

/*
Table:
    readf
    writef
    deletef
    add
    getValues
    createTable
    deleteTable
    
Database:
    createDatabase
    deleteDatabase
    getDatabases
    getTables
*/

const mend = new Mend("https://b0e4-2607-fea8-605b-db00-00-b26.ngrok-free.app", "password");

async function loadDatabases () {
    const databaseNames = await fs.promises.readdir("dashDB", { withFileTypes: true });
    for (let i = 0; i < databaseNames.length; i++) {
        const dbname = databaseNames[i].name;
        if (!dbname)
            continue

        const MDFN = `dashDB/${dbname}/${dbname}.json`;
        const metadata = JSON.parse(await readFile(MDFN));

        const db = new DataBase(dbname, []);

        const tableKeys = Object.keys(metadata.tables);

        for (let j = 0; j < tableKeys.length; j++) {
            const tableName = tableKeys[j];
            const data = metadata.tables[tableName];

            const table = new Table();
            db.tableNames.push(tableName);
            await table.create(tableName, data.values, data.entries, data.pages, data.emptyBlocks, dbname);
            db.tables.push(table);
        }

        // await db.create();
        databases.push(db);
    }
}

async function flushData () {
    nativeEngine.flushDirtyPages();
}

function getItemsFromTable (table, cond) {
    let tokenizer = new Tokenizer(cond);
    tokenizer.parse();
    const tokenizedFilter = tokenizer.tokens;

    const parser = new Parser(tokenizedFilter, table.values);
    let evaulator;
    let ast;

    if (tokenizedFilter.length != 0) {
        try {
            ast = parser.parse();
            evaulator = new AST(ast);
        }
        catch (err) {
            throw new Error("Invalid Filter Statement");
        }
    }

    let data = [];

    for (let i = 0; i < table.entries; i++) {
        let item = table.getItem(i);

        if (!item || table.emptyBlocks.includes(i))
            continue;

        let passed = evaulator.evaluate(ast, item);
        if (!passed)
            continue;

        data.push(item);
    }

    return data;
}

function getChildren (user_id, path) {
    // Parse Path
    let items = path.split("/");
    items.shift();
    if (items.includes("")) {
        for (let i = items.length - 1; i >= 0; i --)
            if (items[i] == "")
                items.splice(i, 1);
    }
    console.log(path);
    console.log(items);

    // Get all the files and folders 
    // Table folders
    //   Filter: user_id = user_id and parent_id = 0
    let currentParentID = 0;
    let currentParentIndex = -1;

    const fiderdb = databases.find((db) => db.dbname === "Fider");
    const folderTable = fiderdb.tables.find((tbl) => tbl.tableName === "folders");
    const fileTable = fiderdb.tables.find((tbl) => tbl.tableName === "files");
    let condFolder = `user_id = ${user_id} and parent_id = ${currentParentID}`;
    let condFile = `user_id = ${user_id} and folder_id = ${currentParentID}`;

    let folderList = [], fileList = [];
    
    while (true) {
        console.log("CurrentParentID: " + currentParentID);
        condFolder = `user_id = ${user_id} and parent_id = ${currentParentID}`;

        folderList = getItemsFromTable(folderTable, condFolder);

        if (currentParentIndex === items.length - 1)
            break;

        currentParentIndex ++;
        if (!items[currentParentID])
            break;

        if (folderList.find((fdr) => fdr.name === items[currentParentIndex])) {
            currentParentID = folderList[currentParentIndex].id;
            console.log("Found: " + folderList[currentParentIndex].name);
        }
        else {
            return {
                error: `Folder '${items[currentParentIndex]}' not found.`,
                children: null
            }
        }
    }

    // Get files as well
    condFile = `user_id = ${user_id} and folder_id = ${currentParentID}`;
    fileList = getItemsFromTable(fileTable, condFile);

    return {
        error: null,
        children: [...folderList, ...fileList]
    };
}

function getItemData (user_id, path) {
    // Parse Path
    let items = path.split("/");
    items.shift();
    if (items.includes("")) {
        for (let i = items.length - 1; i >= 0; i --)
            if (items[i] == "")
                items.splice(i, 1);
    }
    console.log(path);
    console.log(items);

    if (items.length === 0) {
        return {
            error: "Invalid path",
            itemData: null
        };
    }

    const fiderdb = databases.find((db) => db.dbname === "Fider");
    const folderTable = fiderdb.tables.find((tbl) => tbl.tableName === "folders");
    const fileTable = fiderdb.tables.find((tbl) => tbl.tableName === "files");
    
    // Set {Current Item Index} to 0
    let currentItemIndex = 0;

    // Set {Current Item ID} to 0
    let currentItemID = 0;

    // While Loop:
    while (true) {
        // Set {Children Folders} to {Item Children(Folders)({Current Item ID})}
        let childrenFolders = getItemsFromTable(folderTable, 
            `user_id = ${user_id} and parent_id = ${currentItemID}`
        );
        console.log("Current Item ID: " + currentItemID);
        console.log("Current Item Index: " + currentItemIndex);
        console.log(childrenFolders);

        // If (Item[{Current Item Index}] in {Children Folders})
        let childrenFolderIndex = childrenFolders.findIndex((cf) => cf.name === items[currentItemIndex]);
        if (childrenFolderIndex >= 0) {
            // Set {Current Item ID} to Item in {Children Folders}
            currentItemID = childrenFolders[childrenFolderIndex].id;
        }
        //   Else If (Is Last Item)
        else if (currentItemIndex === items.length - 1) {
            // Set {Children Files} to {Item Children(Files)({Current Item ID})}
            let childrenFiles = getItemsFromTable(fileTable,
                `user_id = ${user_id} and folder_id = ${currentItemID}`
            );

            // If (Item[{Current Item Index}] in {Children Files})
            let childrenFileIndex = childrenFiles.findIndex((cf) => cf.name === items[currentItemIndex]);
            if (childrenFileIndex >= 0) {
                // Return Item in {Children Files}
                return {
                    error: null,
                    itemData: childrenFiles[childrenFileIndex]
                };
            }
            // Else
            else {
                console.log("Files");
                // Return Error "Item Doesn't Exist"
                return {
                    error: "Item Doesn't Exist",
                    itemData: null
                };
            }
        }
        //   Else
        else {
            console.log("Folders");
            // Return Error "Item Doesn't Exist"
            return {
                error: "Item Doesn't Exist",
                itemData: null
            };
        }

        // If (Is Last Item)
        if (currentItemIndex === items.length - 1) {
            // Return Item in {Children Folders}
            return {
                error: null,
                itemData: childrenFolders[childrenFolderIndex]
            };
        }

        currentItemIndex ++;
    }
}

function getFilePath(user_id, path) {
    return `${process.cwd()}/storage/user${user_id}/${path}`;
}

app.get("/", (req, res) => {
    res.type("text/plain");
    res.send("FiderFDB\n");
});

app.get("/api/databases", (req, res) => {
    res.json({
        databases: databases.map((db) => db.dbname)
    });
});

app.post("/api/database/verify", (req, res) => {
    const { dbname } = req.body;

    let exists = databases.some((db) => db.dbname === dbname);
    if (databases.length === 0)
        exists = false;
    res.json({
        exists
    });
});

app.post("/api/database/tables", (req, res) => {
    const { dbname } = req.body;

    const db = databases.find((db) => db.dbname === dbname);
    if (!db)
        return res.status(404).json({
            error: "Database not found."
        });

    res.json({
        tables: db.tableNames
    });
});

app.post("/api/database/create", async (req, res) => {
    const { dbname } = req.body;

    if (databases.find((db) => db.dbname === dbname))
        return res.status(404).json({
            error: "Database already exists"
        });

    if (!DataBase.verifyName(dbname))
        return res.status(404).json({
            error: "Database already exists."
        });

    // Create Database
    const db = await DataBase.create(dbname, []);

    databases.push(db);
    await db.setMetaData(dbname);

    res.json({
        created: true
    });
});

app.post("/api/database/delete", async (req, res) => {
    const { dbname } = req.body;

    const dbIdx = databases.findIndex((db) => db.dbname === dbname);
    if (dbIdx < 0)
        return app.status(404).json({
            error: "Database not found."
        });

    // Delete Database
    databases.splice(dbIdx, 1);
    await deleteFolder(`dashDB/${dbname}`);

    res.json({
        deleted: true
    });
});

app.post("/api/table/verify", (req, res) => {
    const { dbname, tableName } = req.body;

    const db = databases.find((db) => db.dbname === dbname);
    if (!db)
        return app.status(404).json({
            error: "Database not found."
        });

    const exists = db.tableName.some((name) => name === tableName);
    res.json({
        exists
    });
});

app.post("/api/table/schema", (req, res) => {
    const { dbname, tableName } = req.body;

    const db = databases.find((db) => db.dbname === dbname);
    if (!db)
        return res.status(404).json({
            error: "Database not found."
        });

    const tableIdx = db.tableNames.findIndex((name) => name === tableName);
    if (tableIdx < 0)
        return res.status(404).json({
            error: "Table not found."
        });

    res.json({
        schema: db.tables[tableIdx].values
    });
});

app.post("/api/table/create", async (req, res) => {
    const { dbname, tableName, schema } = req.body;

    const db = databases.find((db) => db.dbname === dbname);
    if (!db)
        return res.status(404).json({
            error: "Database not found."
        });

    const exists = db.tableNames.some((name) => name === tableName);
    if (exists)
        return res.status(404).json({
            error: "Table already exists."
        });

    if (typeof schema !== "object")
        return res.status(404).json({
            error: "Invalid schema type."
        });

    const validSchema = Table.verifySchema(schema);
    if (!validSchema)
        return res.status(404).json({
            error: "Invalid schema."
        });

    // Create Table
    const table = new Table();

    let entries = 0;
    let pages = [db.findEmptyPage()];
    let emptyBlocks = [];

    await table.create(tableName, schema, entries, pages, emptyBlocks, dbname);

    db.tables.push(table);
    db.tableNames.push(tableName);
    await db.setMetaData(dbname);

    res.json({
        created: true
    });
});

app.post("/api/table/delete", async (req, res) => {
    const { dbname, tableName } = req.body;

    const db = databases.find((db) => db.dbname === dbname);
    if (!db)
        return res.status(404).json({
            error: "Database not found."
        });

    const tableIdx = db.tableNames.findIndex((tblName) => tblName === tableName);
    if (tableIdx < 0)
        return res.status(404).json({
            error: "Table not found."
        });

    // Delete Table
    db.tableNames.splice(tableIdx, 1);
    db.tables.splice(tableIdx, 1);
    await db.setMetaData(dbname);

    res.json({
        deleted: true
    });
});

app.post("/api/data/read", (req, res) => {
    const { dbname, tableName, filter, cols, order } = req.body;

    const db = databases.find((db) => db.dbname === dbname);
    if (!db)
        return res.status(404).json({
            error: "Database not found."
        });

    const table = db.tables.find((tbl) => tbl.tableName === tableName);
    if (!table)
        return res.status(404).json({
            error: "Table not found."
        });

    // Verify Columns
    for (const name of cols) {
        if (!(name in table.values))
            return res.status(404).json({
                error: `Invalid column: ${name}`
            });
    }

    // Verify Order
    if (order.length != 0) {
        const validTypes = ["int", "float", "long"];

        if (!(order[0] in table.values))
            return res.status(404).json({
                error: `Invalid order column: ${order[0]}`
            });

        if (!validTypes.includes(table.values[order[0]]))
            return res.status(404).json({
                error: `Invalid order statement.`
            });

        if (!(["asc", "desc"]).includes(order[1].toLowerCase()))
            return res.status(404).json({
                error: `Invalid order statement: ${order[1]}`
            });
    }

    // Verify Filter
    const parser = new Parser(filter, table.values);
    let evaulator;
    let ast;

    if (filter.length != 0) {
        try {
            ast = parser.parse();
            evaulator = new AST(ast);
        }
        catch (err) {
            return res.status(404).json({
                error: "Invalid filter statement"
            });
        }
    }

    const data = [];

    for (let i = 0; i < table.entries; i++) {
        let item = table.getItem(i);

        if (!item || table.emptyBlocks.includes(i))
            continue;

        if (ast) {
            let passed = evaulator.evaluate(ast, item);
            if (!passed)
                continue;
        }
        
        let newData = {};

        for (const name in item) {
            if (cols.includes(name))
                newData[name] = item[name];
        }

        data.push(newData);
    }

    if (order.length != 0) {
        if (order[1] == "asc") {
            data.sort( (a, b) => a[order[0]] - b[order[0]] )
        }
        else if (order[1] == "desc") {
            data.sort( (a, b) => b[order[0]] - a[order[0]] )
        }
    }

    res.json({
        data
    });
});

app.post("/api/data/write", (req, res) => {
    const { dbname, tableName, filter, cols, data } = req.body;

    const db = databases.find((db) => db.dbname === dbname);
    if (!db)
        return res.status(404).json({
            error: "Database not found."
        });

    const table = db.tables.find((tbl) => tbl.tableName === tableName);
    if (!table)
        return res.status(404).json({
            error: "Table not found."
        });

    // Verify Columns
    for (const name of cols) {
        if (!(name in table.values))
            return res.status(404).json({
                error: `Invalid column: ${name}`
            });
    }

    // Verify Filter
    const parser = new Parser(filter, table.values);
    let evaulator;
    let ast;

    if (filter.length != 0) {
        try {
            ast = parser.parse();
            evaulator = new AST(ast);
        }
        catch (err) {
            return res.status(404).json({
                error: "Invalid filter statement"
            });
        }
    }

    // Write Data
    for (let i = 0; i < table.entries; i++) {
        let item = table.getItem(i);

        if (!item || table.emptyBlocks.includes(i))
            continue;

        if (ast) {
            let passed = evaulator.evaluate(ast, item);
            if (!passed)
                continue;
        }

        let newData = {};

        for (const name in data) {
            item[name] = data[name];
        }

        table.setItem(i, item);
    }

    res.json({
        writen: true
    });
});

app.post("/api/data/delete", (req, res) => {
    const { dbname, tableName, filter } = req.body;

    const db = databases.find((db) => db.dbname === dbname);
    if (!db)
        return res.status(404).json({
            error: "Database not found."
        });

    const table = db.tables.find((tbl) => tbl.tableName === tableName);
    if (!table)
        return res.status(404).json({
            error: "Table not found."
        });

    // Verify Filter
    const parser = new Parser(filter, table.values);
    let evaulator;
    let ast;

    if (filter.length != 0) {
        try {
            ast = parser.parse();
            evaulator = new AST(ast);
        }
        catch (err) {
            return res.status(404).json({
                error: "Invalid filter statement"
            });
        }
    }

    for (let i = 0; i < table.entries; i++) {
        let item = table.getItem(i);

        if (!item || table.emptyBlocks.includes(i))
            continue;

        if (ast) {
            let passed = evaulator.evaluate(ast, item);
            if (!passed)
                continue;
        }

        table.deleteItem(i);
    }

    res.json({
        deleted: true
    });
});

app.post("/api/data/add", async (req, res) => {
    const { dbname, tableName, data } = req.body;

    const db = databases.find((db) => db.dbname === dbname);
    if (!db)
        return res.status(404).json({
            error: "Database not found."
        });

    const table = db.tables.find((tbl) => tbl.tableName === tableName);
    if (!table)
        return res.status(404).json({
            error: "Table not found."
        });

    if (!table.verifyData(data))
        return res.status(404).json({
            error: "Invalid data format."
        });

    // Add Item
    table.addItem(data, db.findEmptyPage());
    await db.setMetaData(dbname);

    res.json({
        added: true,
    });
});

let OTTList = [];

app.post("/file/OTT", async (req, res) => {
    const { authtoken, token, user_id } = req.body;

    const GLOBAL_AUTHTOKEN = await mend.get("global-authtoken", { save: false });
    console.log(GLOBAL_AUTHTOKEN);
    console.log(authtoken);
    
    // Verify sender
    if (authtoken != GLOBAL_AUTHTOKEN) {
        console.log("Invalid Global Token");
        res.status(403).json({
            error: "Only Main Server can access this."
        });
        return;
    }

    // Store OTT
    OTTList.push({
        token: token,
        user_id: user_id
    });
    console.log("OTT: " + token);
    console.log("User ID: " + user_id);

    res.json({
        message: "Success"
    });
});

app.post("/file/children", async (req, res) => {
    // Verify OTT
    const { token, parent } = req.body;
    const ottIndex = OTTList.findIndex((n) => n.token == token);

    console.log("[/file/children] OTT: " + token);
    console.log("[/file/children] Parent Path: " + parent);
    
    // Send error if invalid OTT
    if (ottIndex < 0) {
        res.status(400).json({
            error: "Invalid OTT"
        });
        return;
    }

    console.log("[/file/children] Validated!");

    // getChildren(UserID, path)
    let childrenOut = getChildren(OTTList[ottIndex].user_id, parent);
    OTTList.splice(ottIndex, 1); // Delete OTT

    // Send error if any
    if (childrenOut.error) {
        res.status(400).json({
            error: "[/file/children] " + childrenOut.error,
            children: []
        });
        return;
    }

    // Send children back
    res.json({
        error: null,
        children: childrenOut.children,
    });
});

app.post("/file/data", async (req, res) => {
    // Verify OTT
    const { token, path } = req.body;
    const ottIndex = OTTList.findIndex((n) => n.token == token);

    console.log("[/file/data] OTT: " + token);
    console.log("[/file/data] Path: " + path);
    
    // Send error if invalid OTT
    if (ottIndex < 0) {
        res.status(400).json({
            error: "[/file/data] Invalid OTT"
        });
        return;
    }

    console.log("[/file/data] Validated!");

    // getItemData(UserID, path)
    let dataOut = getItemData(OTTList[ottIndex].user_id, path);
    OTTList.splice(ottIndex, 1); // Delete OTT

    // Send error if any
    if (dataOut.error) {
        res.status(400).json({
            error: "[/file/data] " + dataOut.error,
            children: []
        });
        return;
    }

    // Send children back
    res.json({
        error: null,
        itemData: dataOut.itemData,
    });
});

app.post("/file/download", async (req, res) => {
    // Verify OTT
    const { token, path } = req.body;
    const ottIndex = OTTList.findIndex((n) => n.token == token);

    console.log("[/file/download] OTT: " + token);
    console.log("[/file/download] Path: " + path);
    
    // Send error if invalid OTT
    if (ottIndex < 0) {
        res.status(400).json({
            error: "[/file/download] Invalid OTT"
        });
        return;
    }

    console.log("[/file/download] Validated!");

    const userID = OTTList[ottIndex].user_id;
    OTTList.splice(ottIndex, 1); // Delete OTT

    // Get a download stream to the client
    let dataOut = getItemData(userID, path);

    if (dataOut.error) {
        res.status(400).json({
            error: "[/file/download] " + dataOut.error,
        });
        return;
    }

    if (!dataOut.itemData.mime) {
        res.status(400).json({
            error: "[/file/download] Not file error",
        });
        return;
    }

    console.log(dataOut.itemData);

    const filepath = getFilePath(userID, dataOut.itemData.path);
    console.log("[/file/download] File Path: " + filepath);

    const downloadURL = crypto.randomUUID();
    downloadMap.set(downloadURL, dataOut.itemData);
    
    res.json({
        downloadURL: downloadURL
    });
});

app.get("/file/download/:downloadURL", (req, res) => {
    const { downloadURL } = req.params;

    if (!downloadMap.has(downloadURL)) {
        res.status(401).json({
            error: "Invalid download URL: " + downloadURL
        });
        return;
    }

    const fileData = downloadMap.get(downloadURL);
    const filepath = getFilePath(fileData.user_id, fileData.path);
    downloadMap.delete(downloadURL);
    console.log(fileData)

    res.setHeader("Content-Disposition", `attachment; filename="${fileData.name}"`);

    const stream = fs.createReadStream(filepath);
    stream.pipe(res);
});

(async () => {
    await createFolder("dashDB");
    nativeEngine.init();
    await loadDatabases();

    flushPagesInterval = setInterval(flushData);

    app.listen(PORT, () => {
        console.log(`\x1b[32m[FiderFDB Engine] Listening on port ${PORT}\x1b[0m`);
    });

    const tunnelURL = await startNgrok(PORT, process.env.NGROK_AUTHTOKEN);
    console.log("Generated URL:", tunnelURL);
    mend.set("fiderfdb", tunnelURL);
})();
