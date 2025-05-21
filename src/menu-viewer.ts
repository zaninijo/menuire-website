import { buildMenu, parseTheme } from "./menu-builder";
import { requestHandler } from "./utils";
import { apiConfig } from "../package.json"

const { baseUrl: apiBaseUrl } = apiConfig;

function routeNotFound() {
    document.body.innerHTML = "404";
}

window.addEventListener("DOMContentLoaded", async () => {
    const splitedPath = window.location.pathname.split("/");
    const slug = splitedPath[splitedPath.length-1];

    const response = await requestHandler(`${apiBaseUrl}/match-route/${slug}`,
        { method: "GET" },
        routeNotFound
    )
    if (!response.ok) {
        return;
    }
    
    const menuData: MenuData = await response.json();
    const parsedTheme = await parseTheme(menuData.theme);
    const menuTheme = parsedTheme ? parsedTheme : (await parseTheme("barebone"))!;
    const menuHtml = await buildMenu(menuData, menuTheme);

    const parser = new DOMParser();
    const parsedMenu = parser.parseFromString(menuHtml, "text/html");

    parsedMenu.querySelectorAll("link[rel='stylesheet'], style")
    .forEach(style => document.head.appendChild(document.adoptNode(style)));

    document.title = menuData.title;
    document.body.innerHTML = parsedMenu.body.innerHTML;
    document.body.appendChild(document.adoptNode(parsedMenu.body));
})