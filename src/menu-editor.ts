/*
    Esse código é meio estranho de se ler mas o ponto principal a se entender é que quando um elemento do Menu visual é
    alterado, precisamos alterar seu dado correspondente no MenuData.
    Essa alteração mútua é (provavelmente) melhor do que regenerar o menu toda vez que uma alteração no dado seja feita.
    Dito isso, seria interessante refatorar a estrutura do menu depois. Ter os dados correspondentes salvos posteriormente
    seria melhor do que ficar procurando como no código atual.
    Só é bem ruim ficar cruzando os dados entre o Menu visual e o MenuData. Seria bom refatorar a estrutura.
*/

import { buildMenu, createItemCard, createSeparator, parseTheme } from "./menu-builder";
import { apiConfig } from "../package.json"
import { requestHandler, convertWebpB64, closeModal, getThemes, showOverlay } from "./utils";
import { getAuthHeader, queryMenuImage, waitUserAuth } from "./firebase";
import QRCode from "qrcode"
import route from "../routes.json"

const { baseUrl: apiBaseUrl } = apiConfig;

type MenuElementTypes = "item-card"|"separator"|"sub-separator"|"title"|undefined;
type MenuDataTypes = MenuItemData|SeparatorData|string;
type MenuDataKeys = "id"|"owner"|"route"|"title"|"theme"|"items"|"separators"|undefined;
type MenuDataArrayKeys = "items"|"separators"|undefined;

const movableMenuElements = ["item-card", "separator", "sub-separator"]

class MenuEditorElement extends HTMLElement {
    parentElementType: MenuElementTypes;
    constructor() {
        super();
        this.parentElementType;
    }
}

class EditableMenu {
    menuData: MenuData;
    menuId: string;
    menuTheme: ParsedTheme;
    doc: Document;
    content: HTMLElement;
    styles: NodeListOf<Element>;
    itemContainer: HTMLElement;
    separatorEditButtons: HTMLElement;
    menuCardEditButtons: HTMLElement;
    titleEditButtons: HTMLElement;
    constructor(menuData: MenuData, menuId: string, menuTheme: ParsedTheme, menuHtml: string) {
        this.menuData = menuData;
        this.menuId = menuId,
        this.menuTheme = menuTheme
        const parser = new DOMParser();
        this.doc = parser.parseFromString(menuHtml, "text/html");
        this.itemContainer = this.doc.getElementsByClassName("item-list")[0] as HTMLElement;

        this.separatorEditButtons = document.querySelector(".edit-buttons.edit-separator")!;
        this.menuCardEditButtons = document.querySelector(".edit-buttons.edit-item")!;
        this.titleEditButtons = document.querySelector(".edit-buttons.edit-title")!;
        
        // Cria os botões dos item-card
        this.doc.querySelectorAll(".item-card").forEach((ic) => {
            const itemCard = ic as HTMLElement;
            addEditButtons(this.menuCardEditButtons, itemCard, "item-card")
        })

        // Cria os botões dos separators e sub-separators
        this.doc.querySelectorAll(".separator, .sub-separator").forEach((separator) => {
            const menuSeparator = separator as HTMLElement;
            addEditButtons(this.separatorEditButtons, menuSeparator, "separator")
        })

        // Cria o botão do title
        const titleElement = this.doc.querySelector(".title") as HTMLElement;
        addEditButtons(this.titleEditButtons, titleElement, "title");


        this.doc.querySelectorAll(".edit-buttons").forEach(eb => {
            const editButtons = eb as HTMLElement
            addEditButtonEvents(this, editButtons)
        })

        document.querySelectorAll(".edit-buttons").forEach(eb => {
            const editButtons = eb as HTMLElement;
            editButtons.style.display = "none";
        })

        // Define o conteúdo principal
        this.content = this.doc.body;
        this.styles = this.doc.querySelectorAll("link[rel='stylesheet'], style");
    }

    async generateQrCode() {
        // FIXME trocar pelo url do site dinâmico serviço 3
        const qrCodeUrl = `HTTPS://URLDOSITE.COM/${encodeURIComponent(this.menuData.title)}`;
        const container = document.querySelector(".share-container")!;
        const qrCodeContainer = container.querySelector(".qr-code")! as HTMLCanvasElement;
        const downloadButton = container.querySelector(".download-qr")!;
        const linkBox = container.querySelector(".link-box")! as HTMLInputElement;
        QRCode.toCanvas(qrCodeContainer, qrCodeUrl, {
            // TODO estilizar nosso QR-Code (caso queiramos)
        })
        linkBox.value = qrCodeUrl;
        downloadButton.addEventListener("click", async (event) => {
            qrCodeContainer.toBlob(blob => {
                const url = URL.createObjectURL(blob!);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${this.menuData.title}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 'image/png');
        })
    }

    // A diferença entra esse método e o seguinte é que esse não procura nenhum dado que corresponde o elemento, só o seu
    // index. Util quando o menuData desse elemento ainda não existe.
    element2MenuDataIndex(element: Element) {
        const parent = element.parentElement!;
        const elementType = element.classList[0] as MenuElementTypes;

        if (!parent.classList.contains("item-list")) return null;
        let elementTypeQuery: string = ""

        switch(elementType) {
            case "item-card": elementTypeQuery = ".item-card"; break;
            case "separator":
            case "sub-separator": elementTypeQuery = ".separator, .sub-separator"; break;
            case "title": break;
            default: break;
        }

        const itemArray = Array.from(parent.querySelectorAll(elementTypeQuery));
        return itemArray.indexOf(element);
    }

    // importante notar que o elementIndex não corresponde ao index da chave no MenuData.
    // Então esse método existe para converter esse valor e mais alguns extras pra facilitar o processo
    // Essa função está quebrada para separadores.
    element2MenuData(element: Element) {
        const parent = element.parentElement!;
        const elementType = element.classList[0] as MenuElementTypes
        
        if (!elementType || (!parent.classList.contains("item-list") && elementType !== "title")) return null;

        let elementTypeQuery: string = "";
        let keyName: MenuDataKeys;
        
        switch(elementType) {
            case "item-card": keyName = "items"; elementTypeQuery = ".item-card"; break;
            case "separator":
            case "sub-separator": keyName = "separators"; elementTypeQuery = ".separator, .sub-separator"; break;
            case "title": return {type: elementType, index: 0, itemArray: [], keyName: "title"};
            default: break;
        }

        const itemArray = Array.from(parent.querySelectorAll(elementTypeQuery));
        console.log(itemArray.indexOf(element));
        return {type: elementType, index: itemArray.indexOf(element), itemArray: itemArray, keyName: keyName};
    }

    async addElement(elementType: MenuElementTypes, elementIndex: number, elementData: MenuDataTypes) {
        let dataArrayKey: MenuDataArrayKeys;
        let fragment: DocumentFragment;
        switch(elementType) {
            case "item-card": {
                const itemLayout = this.menuTheme.itemCard;
                dataArrayKey = "items";

                const itemData = elementData as MenuItemData;
                
                const imageB64 = (await queryMenuImage(this.menuData.id, [itemData.imageId]))[0];
                // @ts-expect-error é ignorável porque ja sabemos que se é title retorna 
                fragment = createItemCard(this.doc, elementData, imageB64, itemLayout);
                break;
            }
            case "separator":
            case "sub-separator": {
                // @ts-expect-error
                const itemLayout = elementData.sub ? this.menuTheme.subSeparator : this.menuTheme.separator;
                dataArrayKey = "separators"
                // @ts-expect-error
                fragment = createSeparator(this.doc, elementData, itemLayout);
                break;
            };
            default: return;
        }
        
        // Adiciona o elemento e o move
        this.itemContainer.appendChild(fragment);
        const element = this.itemContainer.lastElementChild! as HTMLElement;
        
        // @ts-expect-error Adiciona os dados ao menuData
        this.menuData[dataArrayKey].push(elementData);
        
        const childrenLength = this.itemContainer.children.length;
        const moveAmount = -(childrenLength - 2 - elementIndex)
        this.moveElement(element, moveAmount);

        switch (elementType) {
            case "item-card": {
                const itemButtons = this.menuCardEditButtons;
                addEditButtons(itemButtons, element, elementType);
                break;
            }
            case "separator":
            case "sub-separator": {
                const separatorButtons = this.separatorEditButtons;
                addEditButtons(separatorButtons, element, elementType);
                break;
            }
        }

        element.addEventListener("click", (event) => {
            clickEventEditables(event, document);
        })

        element.querySelectorAll(".edit-buttons").forEach(eb => {
            const editButtons = eb as MenuEditorElement;
            addEditButtonEvents(this, editButtons);
        })
    }

    async editElement(element: Element, data: MenuDataTypes) {
        const { type: elementType } = this.element2MenuData(element)!;

        if (elementType == "title") {
            const titleName = data as string; 

            if (titleName === this.menuData.title) return true;

            const titleOverlap = await requestHandler(
                `${apiBaseUrl}/match-route/${encodeURIComponent(titleName)}`,
                { method: "GET" },
                () => {},
                [404]
            );

            if (titleOverlap.status == 200) {
                openErrorBox("Já existe um menu com o mesmo título!");
                return false
            }
            this.menuData.title = titleName;
            await this.saveChanges();
            window.location.reload();
            return true
        }

        try {
            const parent = element.parentElement!;
    
            const children = Array.from(parent.children);
            const elementIndex = children.indexOf(element);
    
            await this.addElement(elementType, elementIndex, data);
            await this.deleteElement(element);

        } catch (error) {
            console.log(error)
            return false
        }

        return true
    }

    moveElement(element: Element, amount: number) {
        const parent = element.parentElement!;

        const allElements = Array.from(parent.children);
        const elementIndex = allElements.indexOf(element);
        const elementType = this.element2MenuData(element)!.type;
        
        if (!movableMenuElements.includes(elementType) ||
            elementIndex + amount < 0 ||
            elementIndex + amount >= allElements.length) {
            return false
        }
            
        const movedElement = allElements.splice(elementIndex, 1)[0];
        allElements.splice(elementIndex + amount, 0, movedElement);

        // Define esses dois arrays antes de modificar a lista de elementos
        const allItemCards = Array.from(parent.querySelectorAll(".item-card"));
        const allSeparators = Array.from(parent.querySelectorAll(".separator, .sub-separator"));
        
        const movedItemCardsData: MenuItemData[] = [];
        const movedSeparatorsData: SeparatorData[] = [];

        allElements.forEach((element, elementIndex) => {

            if (allItemCards.includes(element)) {
                movedItemCardsData.push(this.menuData.items[allItemCards.indexOf(element)]);
            }

            else if (allSeparators.includes(element)) {
                const separatorIndex = allSeparators.indexOf(element);
                // Altera o valor de position conforme a organização dos elementos
                this.menuData.separators[separatorIndex].position = elementIndex;

                movedSeparatorsData.push(this.menuData.separators[separatorIndex]);
            }

            parent.appendChild(element);
        })

        this.menuData.separators = movedSeparatorsData;
        this.menuData.items = movedItemCardsData;

        return true;
    }

    async deleteElement(element: Element) {
        const {index: menuDataIndex, keyName: menuDataKey} = this.element2MenuData(element)!;

        if (!(menuDataKey === "items" || menuDataKey === "separators")) return;

        const menuDataArrayKey = menuDataKey as MenuDataArrayKeys;
        this.menuData[menuDataArrayKey!].splice(menuDataIndex, 1)[0];

        element.remove();

        // Recarregar os positions dos separadores
        const elementList = this.itemContainer;
        const listElements = Array.from(elementList.children)
        const separators = elementList.querySelectorAll(".separator, .sub-separator");

        separators.forEach((separator, separatorIndex) => {
            const elementIndex = listElements.indexOf(separator);
            this.menuData.separators[separatorIndex].position = elementIndex;
        })
    }

    async saveChanges() {
        await requestHandler(
            `${apiBaseUrl}/menu/${this.menuId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization" : await getAuthHeader()
                },
                body: JSON.stringify(this.menuData)
            },
            openErrorBox
        )
    }
}

// -- FUNÇÕES EXTERNAS --

function openErrorBox(errorMessage: string) {
    const errorModal = document.querySelector('.errorbox') as HTMLElement;
    const errorText = errorModal.querySelector('.error-message') as HTMLElement;
    const okButton = errorModal.querySelector('.confirm') as HTMLButtonElement;

    // Esconde todos os outros modais.
    document.querySelectorAll(".modal").forEach(modal => {
        const modalElement = modal as HTMLElement;
        modalElement.style.display = "none";
    })

    showOverlay(Number.parseInt(errorModal.style.zIndex) - 1);

    // Torna visível
    errorModal.style.display = "block";

    // Adiciona a mensagem de erro
    errorText.textContent = errorMessage;

    okButton.addEventListener('click', () => {
        closeModal(errorModal);
    });
}

async function openTypeSelectBox(): Promise<"item-card"|"separator"> {
    const selectModal = document.querySelector(".type-select")! as HTMLDivElement;
    const addSeparator = selectModal.querySelector(".add-separator") as HTMLButtonElement;
    const addItem = selectModal.querySelector(".add-item") as HTMLButtonElement;

    showOverlay(Number.parseInt(selectModal.style.zIndex) - 1);

    return new Promise((resolve) => {
        selectModal.style.display = "block";

        addSeparator.addEventListener("click", () => {
            closeModal(selectModal);
            resolve("separator")
        })
        addItem.addEventListener("click", () => {
            closeModal(selectModal);
            resolve("item-card")
        })
    })
}

function openConfirmationBox(): Promise<boolean> {
    const modal = document.querySelector('.modal.confirmbox') as HTMLElement;
    const confirmButton = modal.querySelector('button.confirm') as HTMLButtonElement;
    const cancelButton = modal.querySelector('button.cancel') as HTMLButtonElement;

    showOverlay(Number.parseInt(modal.style.zIndex) - 1);

    return new Promise((resolve) => {

        // Torna visível
        modal.style.display = "block";

        // Adiciona listeners novos
        confirmButton.addEventListener('click', () => {
            closeModal(modal);
            resolve(true);
        });

        cancelButton.addEventListener('click', () => {
            closeModal(modal);
            resolve(false);
        });
    });
}

function openItemEditBox(menu: EditableMenu, element: HTMLElement) {
    const modal = document.querySelector('.modal.editbox.item-editbox') as HTMLElement;
    const nameInput = modal.querySelector('.name') as HTMLInputElement;
    const descInput = modal.querySelector('.description') as HTMLInputElement;
    const priceInput = modal.querySelector('.price') as HTMLInputElement;
    const imageInput = modal.querySelector('.image') as HTMLInputElement;
    const confirmButton = modal.querySelector('.confirm') as HTMLButtonElement;
    const cancelButton = modal.querySelector('.cancel') as HTMLButtonElement;
    const deleteButton = modal.querySelector('.delete') as HTMLButtonElement;

    modal.style.display = 'block';
    showOverlay(Number.parseInt(modal.style.zIndex) - 1);

    const menuItemIndex = menu.element2MenuDataIndex(element)!

    const itemData = menu.menuData.items[menuItemIndex]
    
    // Preenche os campos com os dados atuais (caso existam no elemento)
    nameInput.value = itemData.name;
    descInput.value = itemData.description;
    priceInput.value = itemData.price.toString();

    priceInput.addEventListener("input", () => {
        let valor = priceInput.value.replace(/[^\d,.]/g, "");

        valor = valor.replace(".", ",");

        const partes = valor.split(",");
        if (partes.length > 1) {
            partes[1] = partes[1].slice(0, 2); // Máximo 2 dígitos depois do ponto
            valor = partes[0] + "," + partes[1];
        }

        priceInput.value = valor;
    })


    deleteButton.addEventListener("click", async () => {

        // Espera confirmação do usuário
        closeModal(modal);
        if (!(await openConfirmationBox())) {
            return;
        }

        menu.deleteElement(element);
    })

    // Listener do botão Confirmar (OK)
    confirmButton.addEventListener('click', async () => {

        // Confere se o item que será modificado contém uma imagem. Se sim, deletar a imagem antiga.
        const oldImageId = menu.menuData.items[menu.element2MenuDataIndex(element)!].imageId
        const imageCount = imageInput.files?.length
        if (oldImageId && imageCount && oldImageId !== "placeholder") {
            deleteMenuItemImage(menu.menuId, oldImageId)
        }

        let save = false;
        const newImageId = await (async () => {
            if (imageCount) {
                const image = await createMenuItemImage(menu.menuId, imageInput.files![0]);
                save = true;
                return image;
            }
            return oldImageId;
        })()

        const updatedData = {
            name: nameInput.value.trim(),
            description: descInput.value.trim(),
            price: parseFloat(priceInput.value.replace(",", ".")),
            imageId: newImageId
        };

        // Sobrescreve o elemento com os dados novos.
        await menu.editElement(element, updatedData);

        // Salva o menu. Preciso fazer isso para salvar a imagem nova, sendo que a antiga ja foi apagada.
        save ? menu.saveChanges() : {};
        // Fecha e limpa o modal
        closeModal(modal);
    });

    // Listener do botão Cancelar
    cancelButton.addEventListener('click', () => {
        closeModal(modal);
    });
}


function openSeparatorEditBox(menu: EditableMenu, element: HTMLElement) {
    const modal = document.querySelector('.modal.editbox.separator-editbox') as HTMLElement;
    const nameInput = modal.querySelector('.name') as HTMLInputElement;
    const subInput = modal.querySelector('.sub-check') as HTMLInputElement;
    const deleteButton = modal.querySelector('.delete') as HTMLButtonElement;
    const confirmButton = modal.querySelector('.confirm') as HTMLButtonElement;
    const cancelButton = modal.querySelector('.cancel') as HTMLButtonElement;

    modal.style.display = 'block';
    showOverlay(Number.parseInt(modal.style.zIndex) - 1);

    const separatorIndex = menu.element2MenuDataIndex(element)!;
    const separatorData = menu.menuData.separators[separatorIndex];
    
    // Preenche os campos com os dados atuais (caso existam no elemento)
    nameInput.value = separatorData.categoryName;
    subInput.checked = separatorData.sub;

    deleteButton.addEventListener("click", async () => {
        
        // Espera confirmação do usuário
        if (!(await openConfirmationBox())) {
            closeModal(modal);
            return;
        }

        menu.deleteElement(element);
        closeModal(modal);
    })

    // Listener do botão Confirmar (OK)
    confirmButton.addEventListener('click', async () => {

        const updatedData = {
            categoryName: nameInput.value.trim(),
            position: separatorData.position,
            sub: subInput.checked
        };

        // Sobrescreve o elemento com os dados novos.
        await menu.editElement(element, updatedData);

        // Fecha e limpa o modal
        closeModal(modal);
    });

    // Listener do botão Cancelar
    cancelButton.addEventListener('click', () => {
        closeModal(modal);
    });
}

// FIXME reescrever o nome do menu não funciona.
function openTitleEditBox(menu: EditableMenu, element: HTMLElement) {
    const modal = document.querySelector('.modal.editbox.title-editbox') as HTMLElement;
    const titleInput = modal.querySelector('.title') as HTMLInputElement;
    const confirmButton = modal.querySelector('.confirm') as HTMLButtonElement;
    const cancelButton = modal.querySelector('.cancel') as HTMLButtonElement;

    modal.style.display = "block";
    showOverlay(Number.parseInt(modal.style.zIndex) - 1);

    titleInput.value = menu.menuData.title;

    // Listener do botão Confirmar (OK)
    confirmButton.addEventListener('click', async () => {

        // Sobrescreve o elemento com os dados novos.
        await menu.editElement(element, titleInput.value.trim());

        // Fecha e limpa o modal
        closeModal(modal);
    });

    // Listener do botão Cancelar
    cancelButton.addEventListener('click', () => {
        closeModal(modal);
    });

}

async function openShareModal(menu: EditableMenu) {
    const modal = document.querySelector(".modal.share-container") as HTMLElement;
    const okButton = modal.querySelector(".confirm") as HTMLButtonElement;

    await menu.generateQrCode();
    // por algum motivo eu escrevi a função dentro da classe. tanto faz.
    
    modal.style.display = "block";
    showOverlay(Number.parseInt(modal.style.zIndex) - 1);

    okButton.addEventListener("click", () => {
        closeModal(modal);
    })

}

async function createMenuItemImage(menuId: string, image: File): Promise<string> {
    try {
        const base64Image = await convertWebpB64(image);

        if (!base64Image) {
            throw new Error("Falha ao converter a imagem.");
        }

        const response = await fetch(`${apiBaseUrl}/item-image/${menuId}`, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain",
                "Authorization": await getAuthHeader()
            },
            body: base64Image
        });

        if (!response.ok) {
            throw new Error(`Erro ao enviar imagem: ${response.status}`);
        }

        const newImageId = response.text(); // A API retorna o ID como string pura
        return newImageId;
    } catch (err) {
        console.error("Erro ao criar imagem do item:", err);
        openErrorBox("Erro ao criar a imagem");
        return ""
    }
}

async function deleteMenuItemImage(menuId: string, imageId: string): Promise<void> {
    if (!menuId || !imageId) return;
    requestHandler(`${apiBaseUrl}/item-image/${menuId}/${imageId}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": await getAuthHeader()
            }
        },
        openErrorBox
    )
}

function clickEventEditables(event: Event, doc: Document) {
    doc.querySelectorAll(".edit-buttons").forEach(el => {
        const eb = el as HTMLElement;
        eb.style.display = "none";
    })
    
    const target = event.currentTarget as HTMLElement;
    const eb = target.querySelector(".edit-buttons") as HTMLElement;

    if (eb.style.display !== "none") {
        eb.style.display = "none";
    }

    eb.style.display = "block";
}

function addEditButtons(editButtonsLayout: HTMLElement, menuElement: HTMLElement, menuElementType: MenuElementTypes) {
    const clonedButtons = editButtonsLayout.cloneNode(true) as MenuEditorElement;
    clonedButtons.parentElementType = menuElementType;
    menuElement.prepend(clonedButtons);
    clonedButtons.style.display = "none";

    menuElement.addEventListener("click", (event) => {
        clickEventEditables(event, document)
    })
}

function addEditButtonEvents(editableMenu: EditableMenu, eb: HTMLElement) {
    const editButtons = eb as MenuEditorElement;
    const parent = editButtons.parentElement!;
    const childrenArray = Array.from(editableMenu.itemContainer.children)
    
    if (editButtons.parentElementType !== "title") {
        
        editButtons.querySelector(".up")!.addEventListener("click", event => {
            editableMenu.moveElement(parent, -1);
        })
        editButtons.querySelector(".down")!.addEventListener("click", event => {
            editableMenu.moveElement(parent, 1);
        })

    }

    editButtons.querySelector(".add")!.addEventListener("click", async () => {
        let elementData: MenuDataTypes
        const elementType = await openTypeSelectBox();

        switch(elementType) {
            case "item-card": {
                elementData = {
                    name: "Adicione um nome ao item",
                    imageId: "placeholder",
                    description: "Adicione uma descrição ao item",
                    price: 0
                };
                break;  
            }
            case "separator": {
                elementData = {
                    categoryName: "Adicione um nome ao separador",
                    sub: false,
                    position: 0
                }
                break;
            }
            default: return;
        }
        editableMenu.addElement(elementType, childrenArray.indexOf(parent), elementData);
    })

    editButtons.querySelector(".edit")!.addEventListener("click", event => {
        switch(editButtons.parentElementType) {
            case "item-card": openItemEditBox(editableMenu, parent); return;
            case "title": openTitleEditBox(editableMenu, parent); return;
            case "separator":
            case "sub-separator": openSeparatorEditBox(editableMenu, parent); return;
            default: break;
        }
    })
}

const currentMenuId = new URLSearchParams(window.location.search).get("menuId");

async function init() {
    try {
        if (!currentMenuId) {
            throw new Error("Id do query não corresponde a nenhum no banco de dados")
        }
        const menuRequest = await requestHandler(
            `${apiBaseUrl}/menu/${currentMenuId}`,
            { method: "GET" },
            (errorMessage) => { throw new Error(errorMessage) }
        )
        const menuData: MenuData = await menuRequest.json();
        const parsedTheme = await parseTheme(menuData.theme);
        const menuTheme = parsedTheme ? parsedTheme : (await parseTheme("barebone"))!;
        if (!menuTheme) throw new Error("Não foi possível encontrar o tema especificado nos dados do menu. Contate um administrador.");
        const menuHtml = await buildMenu(menuData, menuTheme);
        const editableMenu = new EditableMenu(menuData, currentMenuId, menuTheme, menuHtml);

        const editableMenuContainer = document.querySelector(".menu-container")!
        editableMenuContainer.appendChild(document.adoptNode(editableMenu.doc.body));
    
        editableMenu.styles.forEach(style => document.head.appendChild(document.adoptNode(style)));

        // Inicializa o seletor de temas
        const themeSelector = document.querySelector("#theme-selector") as HTMLSelectElement;
        
        getThemes().forEach(themeName => {
            const themeId = themeName.toLowerCase();
            const option = new Option(themeName, themeId, menuData.theme === themeId);

            themeSelector.appendChild(option);
        })

        themeSelector.addEventListener("change", async () => {
            editableMenu.menuData.title = themeSelector.value;
            await editableMenu.saveChanges();
            window.location.reload();
        })

        const saveChangesButton = document.querySelector("#save-changes")! as HTMLButtonElement;

        saveChangesButton.addEventListener("click", async (event) => {
            const target = event.target as HTMLButtonElement
            target.disabled = true;
            await editableMenu.saveChanges();
            target.disabled = false;
        })

        const shareButton = document.querySelector("#share-menu")! as HTMLButtonElement;
        shareButton.addEventListener("click", async () => {
            await openShareModal(editableMenu);
        })

        const goBackButton = document.querySelector("#go-back")! as HTMLButtonElement;

        goBackButton.addEventListener("click", () => {
            window.location.href = route.dashboard;
        })

        const loadingOverlay = document.querySelector("#loading-screen") as HTMLElement;
        
        loadingOverlay.style.display = "none";

    } catch (error) {
        console.log(error);
        // window.location.href = routes.dashboard; TODO adicionar quando estiver em produção. Por enquanto, tenho que saber oq tá dando problema.
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    await waitUserAuth();
    init()
    
})
