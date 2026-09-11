const getFileBttn = document.querySelector("#get-file");

const mend = new Mend(MEND_URL);

getFileBttn.addEventListener("mousedown", () => {
    if (!getFileBttn.hasAttribute("down"))
        getFileBttn.setAttribute("down", "");
});

async function getDataWrapper () {
    let ott = await Fider.getOTT(mend);
    if (!ott) return;
    let children = await Fider.getChildren(mend, ott, "/root/");
    if (children) console.log(children);
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
