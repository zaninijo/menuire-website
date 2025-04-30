import { formatBRL } from "./utils";
import { queryMenuImage } from "./firebase";

async function parseTheme(themeName: string) {
    try {
        const response = await fetch(`./menu_layout/${themeName}.html`); // TODO precisa passar os temas pro back-end
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        function throwElementNotFound(elementName: string) {
            throw new Error(
                `${elementName} não foi encontrado. O menu não tem a formatação correta.`
            );
        }

        function getElement(elementName: string) {
            return (
                doc.getElementsByClassName(elementName)[0].outerHTML ??
                throwElementNotFound(elementName)
            );
        }

        let emptyBody = doc.cloneNode(true) as Document;
        const innerElements = emptyBody.body.querySelectorAll(
            ".separator, .sub-separator, .item-card, .item-list"
        );
        innerElements.forEach((element) => element.remove());

        return {
            mainHtml: emptyBody.documentElement.outerHTML,
            itemCard: getElement("item-card"),
            separator: getElement("separator"),
            subSeparator: getElement("sub-separator"),
        };
    } catch (error) {
        console.error("Erro ao carregar o layout: ", error);
        return null;
    }
}

function replaceContent(
    docString: string,
    object: any,
    propertiesName: string[]
) {
    propertiesName.forEach((propertyName) => {
        const regex = new RegExp(`%${propertyName}%`, "g");
        docString = docString.replace(regex, object[propertyName].toString());
    });
    return docString;
}

async function buildMenu(menuData: MenuData, theme: ParsedTheme) {
    const parser = new DOMParser();
    let {
        mainHtml: mainHtml,
        itemCard: itemCardLayout,
        separator: separatorLayout,
        subSeparator: subSeparatorLayout,
    } = theme;

    mainHtml = replaceContent(mainHtml, menuData, ["title"]);

    const doc = parser.parseFromString(mainHtml, "text/html");

    /* Monta a lista de itens */

    const fragmentArray: DocumentFragment[] = []

    const itemList = doc.createElement("div");
    itemList.className = "item-list";
    doc.body.appendChild(itemList);

    const allItems = doc.createDocumentFragment();

    // Pega na database todas as imagens de um menu
    const menuImages = await queryMenuImage(menuData.id, menuData.items.map(item => {return item.imageId}))

    menuData.items.forEach(async (item, i) => {       
        const fragment = createItemCard(doc, item, menuImages[i], itemCardLayout)
        fragmentArray.push(fragment)
    });

    /* Insere os separadores de categoria */
    menuData.separators.sort((a, b) => a.position - b.position).forEach((separatorData) => {
        const separatorType = separatorData.sub
            ? subSeparatorLayout
            : separatorLayout;
            
        const fragment = createSeparator(doc, separatorData, separatorType);

        if (separatorData.position < 0) {
            console.warn(
                `Posição ${separatorData.position} do separador é inválida. Adicionando no começo.`
            );
            separatorData.position = 0;
        }

        fragmentArray.splice(separatorData.position, 0, fragment);
    });

    fragmentArray.forEach(fragment => {
        itemList.appendChild(fragment);
    })

    itemList.appendChild(allItems);

    return doc.documentElement.outerHTML; // acho que eu vou fazer ele retornar o document pra facilitar
}

function createItemCard(doc: Document, data: MenuItemData, imageB64: string|null, layout: string) {
    const formatedItem = { ...data, price: formatBRL(data.price), image: imageB64 };
    const itemCard = replaceContent(layout, formatedItem, [
        "name",
        "description",
        "price",
        "image",
    ]);

    const range = doc.createRange();
    return range.createContextualFragment(itemCard);
}

function createSeparator(doc: Document, data: SeparatorData, layout: string) {
    const separator = replaceContent(layout, data, [
        "categoryName",
    ]);

    const range = doc.createRange();
    return range.createContextualFragment(separator);
}

export { parseTheme, buildMenu, createItemCard, createSeparator };
