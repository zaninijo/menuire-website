import imageCompression from "browser-image-compression";
import route from '../routes.json'
import themeList from "../menu_layout/theme_list.json"

// essa função faz a apuração dos erros nas requisições
async function requestHandler(url: string|URL, params: RequestInit, errorCallback: (errorMessage: string) => void) {
    url = url.toString();
    const response = await fetch(url, params);
    
    if (response.ok) return response;

    const errorMessage = await response.text();
    const status = response.status;
    console.log(`${status}: ${errorMessage}`);

    if (status >= 500) {
        errorCallback("Houve um erro interno do servidor. Tente novamente mais tarde.");
        return response;
    }

    switch(status) {
        case 401: {
            console.log("Inautorizado");
            break;
        }
        default: {
            errorCallback(errorMessage)
        }
    }
    return response
}

function formatBRL(value: number): string {
    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
    });
};

async function convertWebpB64(file: File): Promise<string | null> {
    if (!file) {
        console.error("Nenhuma imagem foi fornecida.");
        return null;
    }

    const options = {
        maxSizeMB: 0.08,
        useWebWorker: true,
        fileType: "image/webp",
    };

    try {
        const compressedFile = await imageCompression(file, options);
        console.log("Imagem comprimida com sucesso:", compressedFile);
        return toBase64(compressedFile);
    } catch (error) {
        console.error("Erro ao comprimir a imagem:", error);
        return null;
    }
}

function showOverlay(zIndex: number|string = "1") {
    // adiciona um overlay que sobrepõe o fundo
    const overlayElement = document.querySelector(".overlay") as HTMLElement|null;
    if (!overlayElement) {
        const overlayElement = document.createElement("div");
        overlayElement.className = "overlay";
        overlayElement.style = `                 
            position: fixed;
            background-color: #ffffff66;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: ${zIndex.toString()};
            height: 100vh;
            width: 100vw;
        `
        document.body.appendChild(overlayElement);
        overlayElement.style.display = "none";
        showOverlay(zIndex);
        return;
    }
    overlayElement.style.zIndex = zIndex.toString();
    overlayElement.style.display = "initial";
    return;
}

function closeModal(modal: HTMLElement) {
    // Remove todos os event listeners dos botões internos (usando clone)
    const clonedModal = modal.cloneNode(true) as HTMLElement;
    modal.replaceWith(clonedModal);

    // Limpa todos os inputs dentro do modal
    const inputs = clonedModal.querySelectorAll('input, textarea, select');
    inputs.forEach((input) => {
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
            input.value = '';
        }
    });

    // Torna o modal invisível
    clonedModal.style.display = "none";

    // Esconde o overlay
    const overlayElement = document.querySelector(".overlay") as HTMLElement;
    if (overlayElement) overlayElement.style.display = "none";
}

function getThemes() {
    return themeList;
}

export { toBase64, formatBRL, convertWebpB64, requestHandler, closeModal, getThemes, showOverlay };
