class Fider {
    static async getOTT (mend) {
        for (let i = 0; i < 2; i++) {
            try {
                return await Fider.#getOTTContent(mend);
            }
            catch (err) {
                if (i === 0) {
                    console.log("Cannot connect to main server. Retrying with updated data...");

                    await mend.get("mainserver", { reget: true });
                }
                else {
                    console.error("Couldn't connect to main server.");
                    return null;
                }
            }
        }
    }

    static async #getOTTContent (mend) {
        const MAINSERVER_URL = await mend.get("mainserver");

        console.log("Mainserver: " + MAINSERVER_URL);
        const response = await fetch(`${MAINSERVER_URL}/file/fileOTT`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
                "bypass-tunnel-reminder": "true",
            },
            body: JSON.stringify({ token: "MyToken" })
        });

        const data = await response.json();

        if (response.status !== 200 || data.error) {
            throw new Error("Invalid");
        }

        return data.token;
    }

    static async getChildren (mend, ott, parent) {
        for (let i = 0; i < 2; i++) {
            try {
                return this.#getChildrenContent(mend, ott, parent);
            }
            catch (err) {
                if (i === 0) {
                    console.log("Cannot connect to FiderFDB. Retrying with updated data...");
                    await mend.get("fiderfdb", { reget: true });
                }
                else {
                    console.error("Couldn't connect to FiderFDB.");
                    return null;
                }
            }
        }
    }

    static async #getChildrenContent (mend, ott, parent) {
        const FIDERFDB_URL = await mend.get("fiderfdb");

        console.log("FiderFDB: " + FIDERFDB_URL);
        const response = await fetch(`${FIDERFDB_URL}/file/children`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
                "bypass-tunnel-reminder": "true",
            },
            body: JSON.stringify({ token: ott, parent: parent })
        });

        if (response.status === 404) {
            throw new Error("Getting Children Failed");
        }

        const data = await response.json();

        if (response.status === 400) {
            console.error(data.error);
            return null;
        }

        return data.children;
    }

    static async getDownloadURL (mend, ott, path) {
        for (let i = 0; i < 2; i++) {
            try {
                return await Fider.#getDownloadURLContent(mend, ott, path);
            }
            catch (err) {
                if (i === 0) {
                    console.log("Cannot connect to FiderFDB. Retrying with updated data...");
                    await mend.get("fiderfdb", { reget: true });
                }
                else {
                    console.error("Couldn't connect to FiderFDB.");
                    return null;
                }
            }
        }
    }

    static async #getDownloadURLContent (mend, ott, path) {
        const FIDERFDB_URL = await mend.get("fiderfdb");

        console.log("FiderFDB: " + FIDERFDB_URL);
        const response = await fetch(`${FIDERFDB_URL}/file/download`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
                "bypass-tunnel-reminder": "true",
            },
            body: JSON.stringify({ token: ott, path: path })
        });

        if (response.status == 404) {
            throw new Error("Getting Download URL Failed");
        }

        const data = await response.json();
        
        if (response.status == 400) {
            console.error(data.error);
            return null;
        }

        return data.downloadURL;
    }

    static async downloadFile (mend, downloadURL) {
        for (let i = 0; i < 2; i++) {
            try {
                return await Fider.#downloadFileContent(mend, downloadURL);
            }
            catch (err) {
                if (i === 0) {
                    console.log("Cannot connect to FiderFDB. Retrying with updated data...");
                    await mend.get("fiderfdb", { reget: true });
                }
                else {
                    console.error("Couldn't connect to FiderFDB.");
                    return null;
                }
            }
        }
    }

    static async #downloadFileContent (mend, downloadURL) {
        const FIDERFDB_URL = await mend.get("fiderfdb");

        console.log("FiderFDB: " + FIDERFDB_URL);
        const response = await fetch(`${FIDERFDB_URL}/file/download/${downloadURL}`, {
            method: "GET",
            headers: {
                "ngrok-skip-browser-warning": "true",
                "bypass-tunnel-reminder": "true",
            },
        });

        if (response.status === 404)
            throw new Error("Upload Failed");

        if (response.status === 400) {
            const data = await response.json();
            console.error(data.error);
            return null;
        }

        try {
            const contentDisposition = response.headers.get("Content-Disposition");
            const filename = contentDisposition?.match(/filename="([^"]+)"/)?.[1];
            console.log("Saved as:", filename);
    
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
    
            const a = document.createElement("a");
            a.href = url;
            a.download = filename ? filename : "file.txt";
            a.click();
    
            URL.revokeObjectURL(url);
        }
        catch (err) {
            console.error("Error downloading file");
            return null;
        }

        return filename;
    }

    static async getUploadURL (mend, ott, parent, name, mime) {
        for (let i = 0; i < 2; i++) {
            try {
                return await Fider.#getUploadURLContent(mend, ott, parent, name, mime);
            }
            catch (err) {
                if (i === 0) {
                    console.log("Cannot connect to FiderFDB. Retrying with updated data...");
                    await mend.get("fiderfdb", { reget: true });
                }
                else {
                    console.error("Couldn't connect to FiderFDB.");
                    return null;
                }
            }
        }
    }

    static async #getUploadURLContent (mend, ott, parent, name, mime) {
        const FIDERFDB_URL = await mend.get("fiderfdb");

        console.log("FiderFDB: " + FIDERFDB_URL);
        const response = await fetch(`${FIDERFDB_URL}/file/upload`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
                "bypass-tunnel-reminder": "true",
            },
            body: JSON.stringify({
                token: ott, 
                parent: parent,
                name: name,
                mime: mime
            })
        });

        if (response.status === 404) {
            throw new Error("Getting Upload URL Failed");
        }

        const data = await response.json();
        
        if (response.status === 400) {
            console.error(data.error);
            return null;
        }

        return data.uploadURL;
    }

    static async uploadFile (mend, uploadURL, text) {
        for (let i = 0; i < 2; i++) {
            try {
                return Fider.#uploadFileContent(mend, uploadURL, text);
            }
            catch (err) {
                if (i === 0) {
                    console.log("Cannot connect to FiderFDB. Retrying with updated data...");
                    await mend.get("fiderfdb", { reget: true });
                }
                else {
                    console.error("Couldn't connect to FiderFDB.");
                    return null;
                }
            }
        }
    }

    static async #uploadFileContent (mend, uploadURL, text) {
        const FIDERFDB_URL = await mend.get("fiderfdb");

        console.log("FiderFDB: " + FIDERFDB_URL);
        const response = await fetch(`${FIDERFDB_URL}/file/upload/${uploadURL}`, {
            method: "POST",
            headers: {
                "ngrok-skip-browser-warning": "true",
                "bypass-tunnel-reminder": "true",
            },
            body: text
        });

        if (response.status === 404)
            throw new Error("Upload Failed");

        if (response.status === 400) {
            const data = await response.json();
            console.error(data.error);
            return null;
        }

        return true;
    }

    static async deleteItem (mend, ott, path) {
        for (let i = 0; i < 2; i++) {
            try {
                return await Fider.#deleteItemContent(mend, ott, path);
            }
            catch (err) {
                if (i === 0) {
                    console.log("Cannot connect to FiderFDB. Retrying with updated data...");
                    await mend.get("fiderfdb", { reget: true });
                }
                else {
                    console.error("Couldn't connect to FiderFDB.");
                    return null;
                }
            }
        }
    }

    static async #deleteItemContent (mend, ott, path) {
        const FIDERFDB_URL = await mend.get("fiderfdb");
        
        console.log("FiderFDB: " + FIDERFDB_URL);
        const response = await fetch(`${FIDERFDB_URL}/file/delete`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
                "bypass-tunnel-reminder": "true",
            },
            body: JSON.stringify({ token: ott, path: path })
        });

        if (response.status === 404) {
            throw new Error("Getting Children Failed");
        }

        const data = await response.json();

        if (response.status === 400) {
            console.error(data.error);
            return false;
        }

        return data.deleted;
    }

    static async createFolder (mend, ott, parent, name) {
        console.log("FiderFDB: " + await mend.get("fiderfdb"));
        for (let i = 0; i < 2; i++) {
            try {
                return await Fider.#createFolderContent(mend, ott, parent, name);
            }
            catch (err) {
                if (i === 0) {
                    console.log("Cannot connect to FiderFDB. Retrying with updated data...");
                    console.log(err);
                    await mend.get("fiderfdb", { reget: true });
                }
                else {
                    console.error("Couldn't connect to FiderFDB.");
                    return null;
                }
            }
        }
    }

    static async #createFolderContent (mend, ott, parent, name) {
        const response = await fetch(await mend.get("fiderfdb") + "/file/createFolder", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
                "bypass-tunnel-reminder": "true",
            },
            body: JSON.stringify({ token: ott, parent: parent, name: name })
        });

        if (response.status === 404) {
            throw new Error("Creating Folder Failed");
        }

        const data = await response.json();

        if (response.status === 400) {
            console.error(data.error);
            return null;
        }

        return data.folderData;
    }
}

