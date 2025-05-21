import { closeModal, getThemes, requestHandler } from "./utils";
import { apiConfig } from '../package.json'
import route from '../routes.json'
import { auth, getAuthHeader, logout, waitUserAuth } from "./firebase";
import { User } from "firebase/auth";

const { baseUrl: apiBaseUrl, timeout: apiTimeout } = apiConfig;

function openConfirmationBox(): Promise<boolean> {
    const modal = document.querySelector('.modal.confirm') as HTMLElement;
    const confirmButton = modal.querySelector('button.confirm') as HTMLButtonElement;
    const cancelButton = modal.querySelector('button.cancel') as HTMLButtonElement;

    return new Promise((resolve) => {

        // Torna visível
        modal.style.display = "block";

        // Adiciona listeners novos
        confirmButton.addEventListener('click', () => {
            modal.style.display = "none";
            closeModal(modal);
            resolve(true);
        });

        cancelButton.addEventListener('click', () => {
            modal.style.display = "none";
            closeModal(modal);
            resolve(false);
        });
    });
}

type MenuInfo = {
    id: string,
    title: string
}

async function buildMenuList() {
    const user = auth.currentUser!;
    const userId = user.uid;

    const menuListElement = document.querySelector(".menu-list")!;
    const menuCard = menuListElement.querySelector(".menu-card")! as HTMLDivElement;
    const emptyMessage = menuListElement.querySelector("#empty-message")! as HTMLElement;

    const response = await requestHandler(
        `${apiBaseUrl}/user-menus/${userId}`,
        {
            method: "GET",
            headers: {
                "authorization": await getAuthHeader()
            }
        },
        (errorMessage) => {
            console.log(errorMessage);
        }
    );
    if (!response.ok) return;
    const menuList: MenuInfo[] = await response.json();

    if (menuList.length === 0) {
        emptyMessage.style.display = "block";
        return
    }

    menuList.forEach(menuListItem => {
        const newCard = menuCard.cloneNode(true) as HTMLElement;

        newCard.style.display = "block";

        const title = newCard.querySelector(".menu-title")  !;
        const editButton = newCard.querySelector(".edit-menu")!;
        const deleteButton = newCard.querySelector(".delete-menu")!;

        title.innerHTML = menuListItem.title;

        editButton.addEventListener("click", () => {
            window.location.href = `${route.menuEditor}?menuId=${menuListItem.id}`;
        })
        deleteButton.addEventListener("click", async () => {
            if(!(await openConfirmationBox())) {
                return;
            }

            await requestHandler(
                `${apiBaseUrl}/menu/${menuListItem.id}`,
                {
                    method: "DELETE",
                    headers: {
                        authorization: await getAuthHeader()
                    }
                },
                (errorMessage) => {
                    console.log(errorMessage);
                    return;
                }
            );
            window.location.reload();
        })
        menuListElement.appendChild(newCard);
    })
    menuCard.remove();
}

async function createMenu(user: User, menuTitle: string, menuTheme: string, errorCallback: (errorMessage: string) => void) {
    const newMenuData: MenuData = {
        id: "",
        owner: user.uid,
        title: menuTitle,
        route: menuTitle,
        theme: menuTheme,
        items: [
            {
                name: "Adicione um nome ao item",
                description: "Adicione uma descrição ao item",
                price: 0,
                imageId: "placeholder"
            }
        ],
        separators: [
            {
                categoryName: "Adicione um nome ao separador",
                sub: false,
                position: 0
            }
        ]
    }

    
    const response = await requestHandler(
        `${apiBaseUrl}/menu`,
        {
            method: "POST",
            headers: {
                authorization: await getAuthHeader(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(newMenuData)
        },
        (errorMessage) => {
            errorCallback(errorMessage);
        }
    );
    return response.ok;
}

// Código de inicialização da página:
const themeList = getThemes();

window.addEventListener("DOMContentLoaded", async () => {
    const user = (await waitUserAuth())!;

    buildMenuList();
    
    const menuCreationBox = document.querySelector(".menu-creation-box")! as HTMLDivElement;
    const logoffButton = document.querySelector("#log-off") as HTMLButtonElement;
    const themeSelector = menuCreationBox.querySelector("#theme-selector")! as HTMLSelectElement;
    const newMenuTitleInput = menuCreationBox.querySelector("#new-menu-title")! as HTMLInputElement;
    const newMenuCreateButton = menuCreationBox.querySelector("#create-new-menu")! as HTMLButtonElement;
    const createErrorOutput = menuCreationBox.querySelector("#creation-error-output")! as HTMLElement;

    themeList.forEach(theme => {
        const option = document.createElement("option");
        option.value = theme.toLowerCase();
        option.innerHTML = theme;
        themeSelector.appendChild(option);
    })

    newMenuCreateButton.addEventListener("click", async () => {
        const title = newMenuTitleInput.value
        const theme = themeSelector.value;

        if (!title) {
            createErrorOutput.style.display = "block";
            createErrorOutput.innerHTML = "Dê um título ao seu menu.";
        }

        if (await createMenu(user, title, theme, (errorMessage) => {
            createErrorOutput.style.display = "block";
            createErrorOutput.innerHTML = errorMessage;
        })) {
            window.location.reload();
        }
    })
    
    logoffButton.addEventListener("click", async () => {
        await logout();
        window.location.href = "/";
    })
})
