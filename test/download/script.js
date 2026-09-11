const getFileBttn = document.querySelector("#get-file");

const mend = new Mend(MEND_URL);

getFileBttn.addEventListener("mousedown", () => {
    if (!getFileBttn.hasAttribute("down"))
        getFileBttn.setAttribute("down", "");
});

async function getDataWrapper () {
    let ott = await Fider.getOTT(mend);
    if (!ott) return;
    let downloadURL = await Fider.getDownloadURL(mend, ott, "/root/Projects/test.txt");
    if (!downloadURL) return;
    let filename = await Fider.downloadFile(mend, downloadURL);
    if (filename) alert(`File '${filename}' has been downloaded.`);
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