import { initializeApp } from "firebase/app";
import {
    browserLocalPersistence,
    browserSessionPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    setPersistence,
    signInWithEmailAndPassword,
    signOut,
    User
} from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import route from '../routes.json';
import placeholderImage from "../assets/placeholderImage";

const firebaseConfig = {
    apiKey: "AIzaSyAv0feNbEpfUUj8JNwYBnSB_F5EiLxtTjM",
    authDomain: "menuireuni9.firebaseapp.com",
    projectId: "menuireuni9",
    storageBucket: "menuireuni9.firebasestorage.app",
    messagingSenderId: "727543495567",
    appId: "1:727543495567:web:6a2017e739fabb351d69fa",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function queryMenuImage(menuId: string, imageIdArray: string[]) {
    if (menuId == "") return [""];
    return await Promise.all(
        imageIdArray.map(async (imageId) => {
            try {

                if (imageId === "placeholder") {
                    return placeholderImage;
                }

                const imageDocRef = doc(db, "menuImage", menuId, "imageCollection", imageId);
                const imageDocSnap = await getDoc(imageDocRef);

                return imageDocSnap.exists()
                    ? "data:image/webp;base64," + imageDocSnap.data().imageB64
                    : "";
            } catch (error) {
                console.error(`Erro ao buscar a imagem ${imageId}:`, error);
                return "";
            }
        })
    );
}

export function handleAuthError(error: unknown): string {
    console.log(error);
  
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as any).code as string;
  
      switch (code) {
        // Cadastro
        case "auth/email-already-in-use":
          return "Este e-mail já está em uso. Tente fazer login ou use outro e-mail.";
        case "auth/invalid-email":
          return "O endereço de e-mail é inválido. Verifique o formato.";
        case "auth/weak-password":
          return "A senha é muito fraca. Utilize pelo menos 6 caracteres.";
  
        // Login
        case "auth/missing-password":
          return "A senha não foi fornecida.";
        case "auth/invalid-credential":
          return "E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.";
        case "auth/user-disabled":
          return "Esta conta foi desativada. Entre em contato com o suporte.";
        case "auth/too-many-requests":
          return "Muitas tentativas. Tente novamente mais tarde.";
        case "auth/network-request-failed":
          return "Erro de conexão. Verifique sua internet.";
  
        // Outros
        case "auth/popup-closed-by-user":
          return "O login foi cancelado antes de ser concluído.";
        case "auth/cancelled-popup-request":
          return "Outro popup de login já está aberto.";
        case "auth/popup-blocked":
          return "O navegador bloqueou a janela de login. Habilite pop-ups.";
  
        default:
          return "Erro desconhecido: " + code;
      }
    }
    return "Ocorreu um erro inesperado. Tente novamente.";
  }

  

async function register(email: string, password: string, keepConnected: boolean, errorCallback: (errorMessage: string) => void) {
    try {
        await setPersistence(auth, keepConnected ? browserLocalPersistence : browserSessionPersistence)
        return await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
        errorCallback(handleAuthError(error));
        return null
    }
}

async function login(email: string, password: string, keepConnected: boolean, errorCallback: (errorMessage: string) => void) {
    try {
        await setPersistence(auth, keepConnected ? browserLocalPersistence : browserSessionPersistence)
        return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        errorCallback(handleAuthError(error));
        return null
    }

}

async function logout() {
    return await signOut(auth);
}

async function getAuthHeader() {
    return `Bearer ${await auth.currentUser!.getIdToken()}`;
}

onAuthStateChanged(auth, (user) => {
    if (!user && window.location.pathname !== route.login && window.location.pathname !== route.register) {
        window.location.href = route.login
    }
})

async function waitUserAuth(): Promise<User | null> {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user);
        });
    });
}


export { app, auth, db, queryMenuImage, login, logout, register, getAuthHeader, waitUserAuth };
