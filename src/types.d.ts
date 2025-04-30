type MenuData = {
    id: string; // identificador único do cardápio 
    owner: string; // identificador do usuário
    route: string; // rota que vai ser utilizada para acesso externo
    title: string; // título do menu 
    theme: string; // indica o nome do tema usado
    items: MenuItemData[];
    separators: SeparatorData[];
}

type MenuItemData = {
    name: string; // nome do item
    description: string; // descrição "
    price: number; // preço "
    imageId: string; // url da imagem "
}

type SeparatorData = {
    categoryName: string; // nome da categoria
    sub: bool;  // se é categoria ou subcategoria
    position: number; // define em qual item está 
}

type ParsedTheme = {
    mainHtml: string;
    itemCard: string;
    separator: string;
    subSeparator: string;
}