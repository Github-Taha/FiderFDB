const getFileBttn = document.querySelector("#get-file");

const mend = new Mend(MEND_URL);

getFileBttn.addEventListener("mousedown", () => {
    if (!getFileBttn.hasAttribute("down"))
        getFileBttn.setAttribute("down", "");
});

async function createFolder (ott, parent, name) {
    console.log("FiderFDB: " + await mend.get("fiderfdb"));
    for (let i = 0; i < 2; i++) {
        try {
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
                return false;
            }

            return data.folderData;
        }
        catch (err) {
            if (i === 0) {
                console.log("Cannot connect to FiderFDB. Retrying with updated data...");
                console.log(err);
                await mend.get("fiderfdb", { reget: true });
            }
            else {
                throw new Error("Couldn't connect to FiderFDB.");
                return null;
            }
        }
    }
}

async function getDataWrapper () {
    let ott = await Fider.getOTT(mend);
    if (!ott) return;
    let folderData = await Fider.createFolder(mend, ott, "/root/", "Documents");
    if (folderData) console.log(folderData);
}

getFileBttn.addEventListener("click", async () => {
    await getDataWrapper();
});

window.addEventListener("mouseup", () => {
    if (getFileBttn.hasAttribute("down"))
        getFileBttn.removeAttribute("down");
});

window.onload = async () => {
    await mend.get("mainserver");
    await mend.get("fiderfdb");
};