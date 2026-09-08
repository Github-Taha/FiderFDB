const { createFile, readFile, writeFile, createFolder, deleteFolder } = require("./fsHelper");
const { Tokenizer, Parser, AST, evalulateCondition } = require("./filterParser");
const nativeEngine = require("../build/Release/main.node");

const PAGE_SIZE = 8 * 1024;

let flushPagesInterval;

function readStringFromBuffer(buffer, startOffset, maxSize) {
    const endOffset = startOffset + maxSize;
    
    let nullByteIndex = buffer.indexOf(0, startOffset);
    
    if (nullByteIndex === -1 || nullByteIndex > endOffset) {
        nullByteIndex = endOffset;
    }
    
    return buffer.toString('utf-8', startOffset, nullByteIndex);
}

class DataBase {
    constructor (dbname, tableNames) {
        this.dbname = dbname;
        this.tableNames = tableNames;
        this.tables = [];
    }

    static verifyName (dbname) {
        if (dbname.trim() === "")
            return false;
        if (!(/^[a-zA-Z]\w*$/.test(dbname)))
            return false;

        return true;
    }
    
    static async create (dbname, tableNames) {
        const db = new DataBase(dbname, tableNames);

        await createFolder(`dashDB/${dbname}/`);
        await createFile(`dashDB/${dbname}/${dbname}.db`);
        await createFile(`dashDB/${dbname}/${dbname}.json`);

        return db;
    }

    findEmptyPage () {
        let pagesUsed = [];
        for (let i = 0; i < this.tables.length; i++) {
            const table = this.tables[i];

            pagesUsed.push(...table.pages);
        }

        if (pagesUsed.length == 0)
            return 0;

        let count = 0;
        while (true) {
            let usedPage = pagesUsed.findIndex((n) => n == count);
            
            if (usedPage == -1)
                break;
            
            count ++;
        }

        return count;
    }

    async setMetaData () {
        let metadata = {
            name: this.dbname,
            tables: {}
        };
        
        for (const tableIndex in this.tableNames) {
            metadata.tables[this.tableNames[tableIndex]] = this.tables[tableIndex].getMetadata();
        }

        await writeFile(`dashDB/${this.dbname}/${this.dbname}.json`, JSON.stringify(metadata));
    }
}

class Table {
    constructor () {}

    static verifySchema (schema) {
        for (const name in schema) {
            const type = schema[name];

            if (name.trim() === "")
                return false;
            if (!(/^[a-zA-Z]\w*$/.test(name)))
                return false;

            if (!Table.validType(type))
                return false;
        }

        return true;
    }

    static validType (type) {
        if (type === "int")
            return true;
        if (type === "float")
            return true;
        if (type === "long")
            return true;
        if (type.startsWith("str")) {
            const len = parseInt(type.substr(3, type.length));
            if (!len)
                return false;
            return true;
        }
        return false;
    }

    static writeValuesToBuffer (pageBuffer, values, data, byteOffset) {
        let writeOffset = byteOffset;
        let valIndex = 0;
        
        for (const name in values) {
            const type = values[name];
            const dataToCore = data[name];
            
            if (type === "int") {
                pageBuffer.writeUInt32LE(dataToCore, writeOffset);
                writeOffset += 4;
            }
            else if (type === "float") {
                pageBuffer.writeFloatLE(dataToCore, writeOffset);
                writeOffset += 4;
            }
            else if (type === "long") {
                pageBuffer.writeBigUInt64LE(BigInt(dataToCore), writeOffset);
                writeOffset += 8;
            }
            else if (type.startsWith("str")) {
                const len = parseInt(type.substr(3, type.length));
                pageBuffer.fill(0, writeOffset, writeOffset + len);
                pageBuffer.write(dataToCore, writeOffset, len, 'utf-8');
                writeOffset += len;
            }
            valIndex++;
        }
    }

    static readValuesFromBuffer (pageBuffer, values, byteOffset) {
        let returnData = {};
        let readOffset = byteOffset;

        for (const name in values) {
            const type = values[name];

            if (type === "int") {
                const num = pageBuffer.readUInt32LE(readOffset);
                readOffset += 4;

                returnData[name] = num;
            }
            else if (type === "float") {
                const num = pageBuffer.readFloatLE(readOffset);
                readOffset += 4;

                returnData[name] = num;
            }
            else if (type === "long") {
                const num = pageBuffer.readBigUInt64LE(readOffset);
                readOffset += 8;

                returnData[name] = num.toString();
            }
            else if (type.startsWith("str")) {
                const len = parseInt(type.substr(3, type.length));
                const string = readStringFromBuffer(pageBuffer, readOffset, len);
                readOffset += len;

                returnData[name] = string;
            }
        }

        return returnData;
    }

    static clearValuesFromBuffer (pageBuffer, values, byteOffset) {
        let writeOffset = byteOffset;
        let valIndex = 0;
        
        for (const name in values) {
            const type = values[name];
            
            if (type === "int") {
                pageBuffer.writeUInt32LE(0, writeOffset);
                writeOffset += 4;
            }
            else if (type === "float") {
                pageBuffer.writeFloatLE(0, writeOffset);
                writeOffset += 4;
            }
            else if (type === "long") {
                pageBuffer.writeBigUInt64LE(0n, writeOffset);
                writeOffset += 8;
            }
            else if (type.startsWith("str")) {
                const len = parseInt(type.substr(3, type.length));
                pageBuffer.fill(0, writeOffset, writeOffset + len);
                writeOffset += len;
            }

            valIndex++;
        }
    }

    static getValueBlockLength (values) {
        let blockSize = 0;

        for (const name in values) {
            const type = values[name];
            
            if (type === "int") {
                blockSize += 4;
            }
            else if (type === "float") {
                blockSize += 4;
            }
            if (type === "long") {
                blockSize += 8;
            }
            else if (type.startsWith("str")) {
                const len = parseInt(type.substr(3, type.length));
                blockSize += len;
            }
        }

        return blockSize;
    }

    async create (tableName, values, entries, pages, emptyBlocks, dbname) {
        // values -> int, float, str{len}(i.e. str50)

        this.tableName = tableName;
        this.emptyBlocks = emptyBlocks;
        this.values = values;
        this.entries = entries;
        this.pages = pages;
        this.dbFileName = `dashDB/${dbname}/${dbname}.db`;

        // get length of block
        this.blockLen = Table.getValueBlockLength(this.values);

        this.blocksPerPage = Math.floor(PAGE_SIZE / this.blockLen);
        this.endTrim = PAGE_SIZE - this.blocksPerPage * this.blockLen;

        return {
            values: this.values,
            entries: this.entries,
            pages: this.pages,
            emptyBlocks: this.emptyBlocks,
        };
    }

    setItem (index, data) {
        if (index >= this.entries)
            return null;

        // Calculate PageID
        const pageIDRef = Math.floor(index / this.blocksPerPage);
        const pageID = this.pages[pageIDRef];

        // Calculate Byte Offset
        const pageIndexOffset = index - pageIDRef * this.blocksPerPage;
        const byteOffset = pageIndexOffset * this.blockLen;

        // Get C++ to load page
        const pageBuffer = nativeEngine.getPageBuffer(this.dbFileName, pageID);

        Table.writeValuesToBuffer(pageBuffer, this.values, data, byteOffset);

        nativeEngine.setPageDirty(this.dbFileName, pageID);
    }

    addItem (data, freePage) {
        // Check if any empty blocks
        if (this.emptyBlocks.length > 0) {
            const emptyIndex = this.emptyBlocks.pop();
            this.setItem(emptyIndex, data);

            return;
        }

        // Calculate Max PageID
        const index = this.entries;
        const pageIDRef = Math.floor(index / this.blocksPerPage);

        let pageIndexOffset;
        let byteOffset;

        if (pageIDRef > this.pages.length - 1) {
            byteOffset = 0;
            nativeEngine.addPage(this.dbFileName, freePage);
            this.pages.push(freePage);
        }
        else {
            pageIndexOffset = index - pageIDRef * this.blocksPerPage;
            byteOffset = pageIndexOffset * this.blockLen;
        }

        const pageID = this.pages[pageIDRef];

        const pageBuffer = nativeEngine.getPageBuffer(this.dbFileName, pageID);

        Table.writeValuesToBuffer(pageBuffer, this.values, data, byteOffset);

        this.entries ++;

        nativeEngine.setPageDirty(this.dbFileName, pageID);
    }

    getItem (index) {
        if (index >= this.entries)
            return null;

        // Calculate PageID
        const pageIDRef = Math.floor(index / this.blocksPerPage);
        const pageID = this.pages[pageIDRef];

        // Calculate Byte Offset
        const pageIndexOffset = index - pageIDRef * this.blocksPerPage;
        const byteOffset = pageIndexOffset * this.blockLen;

        // Get C++ to load page
        const pageBuffer = nativeEngine.getPageBuffer(this.dbFileName, pageID);

        // Get data from page
        let returnData = Table.readValuesFromBuffer(pageBuffer, this.values, byteOffset);

        return returnData;
    }

    deleteItem (index) {
        if (index >= this.entries)
            return null;

        // Calculate PageID
        const pageIDRef = Math.floor(index / this.blocksPerPage);
        const pageID = this.pages[pageIDRef];

        // Calculate Byte Offset
        const pageIndexOffset = index - pageIDRef * this.blocksPerPage;
        const byteOffset = pageIndexOffset * this.blockLen;

        // Get C++ to load page
        const pageBuffer = nativeEngine.getPageBuffer(this.dbFileName, pageID);

        Table.clearValuesFromBuffer(pageBuffer, this.values, byteOffset);

        nativeEngine.setPageDirty(this.dbFileName, pageID);

        this.emptyBlocks.push(index);
    }

    getAllData (indexName) {
        let data = [];

        for (let i = 0; i < this.entries; i++) {
            let item = this.getItem(i);

            if (!item || i in this.emptyBlocks)
                continue;

            let newData = {};
            newData[indexName] = i;
            newData = {
                ...newData,
                ...item
            };

            data.push(newData);
        }

        return data;
    }

    verifyData (data) {
        for (const name in data) {
            const item = data[name];
            const type = this.values[name];

            if (!type)
                return false;

            if (!Table.verifyItemType(item, type))
                return false;

        }

        return true;
    }

    static verifyItemType (item, type) {
        if (type === "int") {
            if (parseInt(item) != undefined)
                return true;
        }
        else if (type === "float") {
            if (parseFloat(item) !== undefined)
                return false;
        }
        else if (type === "long") {
            item = BigInt(item);
            if (typeof item !== 'bigint')
                return false;
        }
        else if (type.startsWith("str")) {
            if (typeof item != "string")
                return false;

            const len = parseInt(type.substr(3, type.length));

            if (item.length > len)
                return false;
        }

        return true;
    }

    async close() {

    }

    getMetadata() {
        return {
            values: this.values,
            entries: this.entries,
            pages: this.pages,
            emptyBlocks: this.emptyBlocks,
        };
    }
}

module.exports = { DataBase, Table };

