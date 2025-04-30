
import { register, waitUserAuth } from "./firebase";
import route from '../routes.json'

window.addEventListener("DOMContentLoaded", async () => {
    const emailInput = document.querySelector("#email-input")! as HTMLInputElement;
    const passwordInput = document.querySelector("#password-input")! as HTMLInputElement;
    const passwordConfirm = document.querySelector("#password-confirm")! as HTMLInputElement;
    const errorElement = document.querySelector("#error-message")! as HTMLParagraphElement;
    const registerButton = document.querySelector("#submit-login")! as HTMLButtonElement;
    const keepConnectedCheckbox = document.querySelector("#keep-connected")! as HTMLInputElement;
    const showPasswordCheckbox = document.querySelector("#show-password")! as HTMLInputElement;

    showPasswordCheckbox.addEventListener("change", () => {
        const inputType = showPasswordCheckbox.checked ? "text" : "password";
        passwordInput.type = inputType;
        passwordConfirm.type = inputType;
    })

    registerButton.addEventListener("click", async () => {
        registerButton.disabled = true;
        try {
            const user = await register(emailInput.value, passwordInput.value, keepConnectedCheckbox.checked, (errorMessage) => {
                throw new Error(errorMessage);
            });
            if (user) {
                window.location.href = route.dashboard;
            }
        } catch (err) {
            const error = err as Error;
            errorElement.innerHTML = error.message;
        }
        registerButton.disabled = false;
    })
    
    const passwordChecker = document.querySelector("#password-check")! as HTMLDivElement;
    const lengthIndicator = passwordChecker.querySelector("#length")! as HTMLElement;
    const uppercaseIndicator = passwordChecker.querySelector("#uppercase")! as HTMLElement;
    const lowercaseIndicator = passwordChecker.querySelector("#lowercase")! as HTMLElement;
    const numberIndicator = passwordChecker.querySelector("#number")! as HTMLElement;
    const symbolIndicator = passwordChecker.querySelector("#symbol")! as HTMLElement;
    const confirmIndicator = passwordChecker.querySelector("#confirm")! as HTMLElement;

    function updatePasswordChecker() {
        const password = passwordInput.value;

        const validLength = password.length >= 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const validConfirm = (passwordInput.value === passwordConfirm.value);
        

        lengthIndicator.style.display = validLength ? "none" : "block";
        uppercaseIndicator.style.display = hasUppercase ? "none" : "block";
        lowercaseIndicator.style.display = hasLowercase ? "none" : "block";
        numberIndicator.style.display = hasNumber ? "none" : "block";
        symbolIndicator.style.display = hasSymbol ? "none" : "block";
        confirmIndicator.style.display = validConfirm ? "none" : "block";
        

        if (validLength && hasUppercase && hasLowercase && hasNumber && hasSymbol && validConfirm) {
            passwordChecker.style.display = "none";
            registerButton.disabled = false;
        }
        else {
            passwordChecker.style.display = "block";
            registerButton.disabled = true;
        }
    }

    passwordInput.addEventListener("input", () => {
        updatePasswordChecker()
    })
    passwordConfirm.addEventListener("input", () => {
        updatePasswordChecker()
    })

    if (await waitUserAuth()) {
        window.location.href = route.dashboard;
    }
})
