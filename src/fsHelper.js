const fs = require("fs").promises;

async function createFile (filename) {
    try {
        await fs.appendFile(filename, "", { flag: "wx" });
        console.log(`File \x1b[34m${filename}\x1b[0m created successfully!`);
    } catch (err) {
        if (err.code == "EEXIST") {
            // console.log(`File "${filename}" already exists.`);
        }
        else {
            console.error("Error creating file: " + err.message);
        }
    }
}

async function readFile (filePath) {
    try {
        const data = await fs.readFile(filePath);
    
        return data.toString("utf-8");
    }
    catch (err) {
        console.error("Error Reading file: " + err.message);
    }
}

async function writeFile (filePath, data) {
    try {
        await fs.writeFile(filePath, data);
    }
    catch (err) {
        console.error("Error writing to file: " + err.message);
    }
}

async function createFolder (folderPath) {
    try {
        await fs.mkdir(folderPath, { recursive: true });
        console.log(`Folder \x1b[34m${folderPath}\x1b[0m created successfully!`);
    }
    catch (err) {
        console.error("Error creating folder: " + err.message);
    }
}

async function deleteFolder (folderPath) {
    try {
        await fs.rm(folderPath, { recursive: true, force: true });
        console.log(`Folder \x1b[34m${folderPath}\x1b[0m deleted successfully.`);
    }
    catch (err) {
        console.error("Error deleting folder: " + err.message);
    }
}

module.exports = { createFile, readFile, writeFile, createFolder, deleteFolder };

