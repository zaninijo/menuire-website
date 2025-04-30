
import { login, waitUserAuth } from "./firebase";
import route from '../routes.json'

window.addEventListener("DOMContentLoaded", async () => {
    const emailInput = document.querySelector("#email-input")! as HTMLInputElement;
    const passwordInput = document.querySelector("#password-input")! as HTMLInputElement;
    const errorElement = document.querySelector("#error-message")! as HTMLParagraphElement;
    const loginButton = document.querySelector("#submit-login")! as HTMLButtonElement;
    const keepConnectedCheckbox = document.querySelector("#keep-connected")! as HTMLInputElement;

    const showPasswordCheckbox = document.querySelector("#show-password")! as HTMLInputElement;

    showPasswordCheckbox.addEventListener("change", () => {
        const inputType = showPasswordCheckbox.checked ? "text" : "password";
        passwordInput.type = inputType;
    })
    
    loginButton.addEventListener("click", async () => {
        loginButton.disabled = true;
        try {
            const user = await login(emailInput.value, passwordInput.value, keepConnectedCheckbox.checked, (errorMessage) => {
                throw new Error(errorMessage);
            })
            if (user) {
                window.location.href = route.dashboard
            }
        } catch (err) {
            const error = err as Error;
            errorElement.innerHTML = error.message ;
        }
        loginButton.disabled = false;
    })

    if (await waitUserAuth()) {
        window.location.href = route.dashboard;
    }
})
