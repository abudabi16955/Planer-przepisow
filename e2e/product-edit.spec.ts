import { expect, test } from "../frontend/node_modules/@playwright/test";

test("edycja produktu zmienia nazwę i makro istniejącego przepisu", async ({
  page,
  request,
}) => {
  const name = `Produkt ${crypto.randomUUID()}`;
  const editedName = `${name} poprawiony`;
  const productResponse = await request.post("/api/products", {
    data: {
      name,
      units: ["g"],
      nutrition_basis: "g",
      kcal: 100,
      protein: 1,
      carbs: 2,
      fat: 3,
    },
  });
  expect(productResponse.status()).toBe(201);
  const product = await productResponse.json();
  const response = await request.post("/api/recipes", {
    data: {
      title: `Makro ${crypto.randomUUID()}`,
      category: "obiad",
      servings: 1,
      ingredients: [{ product_id: product.id, quantity: 100, unit: "g" }],
    },
  });
  expect(response.status()).toBe(201);
  const recipe = await response.json();
  try {
    await page.goto(`/przepis/${recipe.id}`);
    await expect(page.locator(".kcal")).toHaveText("100");
    await page.goto("/dodaj");
    await page.getByRole("tab", { name: "Ręcznie", exact: true }).click();
    await page.getByRole("combobox").fill(name);
    await page.getByRole("option").filter({ hasText: name }).click();
    const editBtn = page.getByRole("button", {
      name: `Edytuj produkt: ${name}`,
      exact: true,
    });
    await expect(editBtn).toBeVisible();
    const editBox = await editBtn.boundingBox();
    expect(editBox?.height).toBeGreaterThanOrEqual(44);
    await editBtn.click();
    const dialog = page.getByRole("dialog", {
      name: "Edytuj produkt",
      exact: true,
    });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(
      dialog.getByLabel("Nazwa produktu", { exact: true }),
    ).toBeFocused();
    await expect(
      dialog.getByLabel("Nazwa produktu", { exact: true }),
    ).toHaveValue(name);

    const cancelBtn = dialog.getByRole("button", {
      name: "Anuluj",
      exact: true,
    });
    await expect(cancelBtn).toBeVisible();
    const cancelBox = await cancelBtn.boundingBox();
    expect(cancelBox?.height).toBeGreaterThanOrEqual(44);

    const closeBtn = dialog.getByRole("button", {
      name: "Zamknij",
      exact: true,
    });
    await expect(closeBtn).toBeVisible();

    await dialog.getByLabel("Nazwa produktu", { exact: true }).fill(editedName);
    await dialog.getByLabel("kcal", { exact: true }).fill("200");
    const updated = page.waitForResponse(
      (result) =>
        result.url().endsWith(`/api/products/${product.id}`) &&
        result.request().method() === "PUT",
    );
    await dialog
      .getByRole("button", { name: "Zapisz zmiany", exact: true })
      .click();
    expect((await updated).status()).toBe(200);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("combobox")).toHaveValue(editedName);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: `Zapisano produkt: ${editedName}` }),
    ).toBeVisible();
    await page.goto(`/przepis/${recipe.id}`);
    await expect(page.locator(".kcal")).toHaveText("200");
    await expect(page.getByText(editedName, { exact: true })).toBeVisible();
    const persisted = await (
      await request.get(`/api/recipes/${recipe.id}`)
    ).json();
    expect(persisted.kcal).toBeNull(); // Computed from current products, never copied on save.
  } finally {
    await request.delete(`/api/recipes/${recipe.id}`);
  }
});

test("modal nowego produktu jest wyśrodkowanym pop-upem, ma czytelny przycisk Anuluj i zamyka się", async ({
  page,
}) => {
  await page.goto("/dodaj");
  await page.getByRole("tab", { name: "Ręcznie", exact: true }).click();

  const newName = `Nowy produkt ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByRole("combobox").fill(newName);

  const addNewBtn = page.getByRole("button", {
    name: `Nie ma na liście? Dodaj „${newName}” jako nowy produkt`,
    exact: true,
  });
  await expect(addNewBtn).toBeVisible();
  const addBox = await addNewBtn.boundingBox();
  expect(addBox?.height).toBeGreaterThanOrEqual(44);

  // Otwórz modal nowego produktu
  await addNewBtn.click();
  const newDialog = page.getByRole("dialog", {
    name: "Nowy produkt",
    exact: true,
  });
  await expect(newDialog).toBeVisible();
  await expect(newDialog).toHaveAttribute("aria-modal", "true");

  // Sprawdź fokus na pierwszym polu
  await expect(
    newDialog.getByLabel("Nazwa produktu", { exact: true }),
  ).toBeFocused();

  // Sprawdź przycisk Anuluj (widoczność i min. 44px)
  const cancelBtn = newDialog.getByRole("button", {
    name: "Anuluj",
    exact: true,
  });
  await expect(cancelBtn).toBeVisible();
  const cancelBox = await cancelBtn.boundingBox();
  expect(cancelBox?.height).toBeGreaterThanOrEqual(44);

  // Sprawdź przycisk ✕ z aria-label="Zamknij"
  const closeBtn = newDialog.getByRole("button", {
    name: "Zamknij",
    exact: true,
  });
  await expect(closeBtn).toBeVisible();

  // Zamknij przez Anuluj
  await cancelBtn.click();
  await expect(newDialog).toHaveCount(0);

  // Otwórz ponownie i zamknij przez ✕
  await page.getByRole("combobox").fill(newName);
  await addNewBtn.click();
  await expect(newDialog).toBeVisible();
  await closeBtn.click();
  await expect(newDialog).toHaveCount(0);

  // Otwórz ponownie i zamknij przez Escape
  await page.getByRole("combobox").fill(newName);
  await addNewBtn.click();
  await expect(newDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(newDialog).toHaveCount(0);

  // Otwórz ponownie i zamknij przez kliknięcie tła
  await page.getByRole("combobox").fill(newName);
  await addNewBtn.click();
  await expect(newDialog).toBeVisible();
  await page.locator(".backdrop").click({ position: { x: 10, y: 10 } });
  await expect(newDialog).toHaveCount(0);
});

test("scenariusz z papryką słodką: edycja jednostek, przelicznik łyżki i wyliczenie kalorii w przepisie", async ({
  page,
  request,
}) => {
  const productName = `Papryka słodka ${crypto.randomUUID().slice(0, 8)}`;
  const recipeTitle = `Gulasz z papryką ${crypto.randomUUID().slice(0, 8)}`;

  // 1. Tworzymy produkt: Papryka słodka na 100 g, 282 kcal, jednostka początkowa: g
  const productResponse = await request.post("/api/products", {
    data: {
      name: productName,
      units: ["g"],
      nutrition_basis: "g",
      kcal: 282,
      protein: 14.1,
      carbs: 54,
      fat: 12.9,
    },
  });
  expect(productResponse.status()).toBe(201);
  const product = await productResponse.json();

  let createdRecipeId: string | null = null;
  try {
    // 2. Wchodzimy do formularza dodawania przepisu
    await page.goto("/dodaj");
    await page.getByRole("tab", { name: "Ręcznie", exact: true }).click();

    await page.getByLabel("Nazwa", { exact: true }).fill(recipeTitle);
    await page.getByRole("button", { name: "Obiad", exact: true }).click();
    await page.getByLabel("Porcje", { exact: true }).fill("1");

    // Wybieramy paprykę słodką w wyszukiwarce składników
    await page.getByRole("combobox").fill(productName);
    await page.getByRole("option").filter({ hasText: productName }).click();

    // Klikamy Edytuj produkt
    const editBtn = page.getByRole("button", {
      name: `Edytuj produkt: ${productName}`,
      exact: true,
    });
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const dialog = page.getByRole("dialog", {
      name: "Edytuj produkt",
      exact: true,
    });
    await expect(dialog).toBeVisible();

    // Dodajemy jednostkę 'łyżka'
    await dialog.getByRole("button", { name: "łyżka", exact: true }).click();

    // Uzupełniamy przelicznik: 1 łyżka = 10 g
    const convInput = dialog.getByLabel("1 łyżka =", { exact: true });
    await expect(convInput).toBeVisible();
    await convInput.fill("10");

    // Zapisujemy zmiany w produkcie
    const updateResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith(`/api/products/${product.id}`) &&
        res.request().method() === "PUT",
    );
    await dialog
      .getByRole("button", { name: "Zapisz zmiany", exact: true })
      .click();
    expect((await updateResponse).status()).toBe(200);
    await expect(dialog).toHaveCount(0);

    // Wybieramy jednostkę łyżka w dodawanym składniku
    await page.getByRole("button", { name: "łyżka", exact: true }).click();
    await page.getByLabel("Ilość", { exact: true }).fill("2");
    await page
      .getByRole("button", { name: "Dodaj składnik", exact: true })
      .click();

    // Zapisujemy przepis
    const recipeCreate = page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/recipes") && res.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Zapisz przepis", exact: true })
      .click();
    const createdRes = await recipeCreate;
    expect(createdRes.status()).toBe(201);
    const recipe = await createdRes.json();
    createdRecipeId = recipe.id;

    // 3. Sprawdzamy szczegóły przepisu (/przepis/{id}): 2 łyżki to 20 g = 56.4 kcal -> 56 kcal
    await page.goto(`/przepis/${createdRecipeId}`);
    await expect(page.locator(".kcal")).toHaveText("56");

    // 4. Sprawdzamy na liście przepisów (/) w kafelku
    await page.goto("/");
    const card = page.getByRole("button", {
      name: new RegExp(`(Pokaż|Otwórz) przepis: ${recipeTitle}`),
    });
    await expect(card).toBeVisible();
    await expect(card).toContainText("56 kcal");
  } finally {
    if (createdRecipeId) {
      await request.delete(`/api/recipes/${createdRecipeId}`);
    }
  }
});

test("kryterium 9: import WWW ze szkicem papryki (2 płaskie łyżki), błąd jednostki, edycja produktu i przelicznika, 44px przyciski", async ({
  page,
  request,
}) => {
  const productName = `Papryka słodka mielona ${crypto.randomUUID().slice(0, 8)}`;
  const recipeTitle = `Gulasz z papryką ${crypto.randomUUID().slice(0, 8)}`;
  const source = "https://recipes.example/gulasz-z-papryka";

  // 1. Tworzymy produkt: „Papryka słodka mielona” ma tylko „łyżeczka”, nutrition_basis: 'g', 282 kcal / 100 g
  const productResponse = await request.post("/api/products", {
    data: {
      name: productName,
      units: ["łyżeczka"],
      nutrition_basis: "g",
      kcal: 282,
      protein: 14.1,
      carbs: 54,
      fat: 12.9,
      unit_conversions: {},
    },
  });
  expect(productResponse.status()).toBe(201);
  const paprika = await productResponse.json();

  let createdRecipeId: string | null = null;

  // Fake backend importu jak w e2e/web-import.spec.ts
  await page.route("**/api/web-import", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ url: source });
    await route.fulfill({
      json: {
        title: recipeTitle,
        category: "obiad",
        servings: 1,
        time_min: 30,
        steps: ["Ugotuj wszystko.", "Podaj na gorąco."],
        kcal: null,
        protein: null,
        carbs: null,
        fat: null,
        source_url: source,
        source_host: "recipes.example",
        photo_url: null,
        notes: [],
        ingredients: [
          {
            raw: "słodka papryka mielona 2 płaskie łyżki",
            name: productName,
            qty: 2,
            unit: "łyżka",
            product_id: paprika.id,
            match: "fuzzy",
            unit_ok: false,
            confirmed: false,
            quantity_variants: [
              { qty: 2, unit: "łyżka" },
              { qty: 20, unit: "g" },
            ],
          },
        ],
      },
    });
  });

  try {
    await page.goto("/dodaj");
    await page
      .getByLabel("Link do posta lub reela", { exact: true })
      .fill(source);
    await page
      .getByRole("button", { name: "Pobierz przepis ze strony" })
      .click();

    await expect(page.getByLabel("Nazwa", { exact: true })).toHaveValue(
      recipeTitle,
    );
    const saveBtn = page.getByRole("button", {
      name: "Zapisz przepis",
      exact: true,
    });
    await expect(saveBtn).toBeDisabled();

    const row = page.getByRole("group", { name: "Składnik 1", exact: true });
    // Wiersz pokazuje błąd jednostki
    await expect(row.getByText("Wybierz jednostkę produktu.")).toBeVisible();
    await expect(row.getByText("sprawdź", { exact: true })).toBeVisible();

    // Sprawdzenie wysokości przycisków w wierszu (>= 44 px)
    const editBtn = row.getByRole("button", {
      name: `Edytuj produkt: ${productName}`,
      exact: true,
    });
    await expect(editBtn).toBeVisible();
    const editBox = await editBtn.boundingBox();
    expect(editBox?.height).toBeGreaterThanOrEqual(44);

    const chooseBtn = row.getByRole("button", {
      name: `Wybierz produkt: ${productName}`,
      exact: true,
    });
    await expect(chooseBtn).toBeVisible();
    const chooseBox = await chooseBtn.boundingBox();
    expect(chooseBox?.height).toBeGreaterThanOrEqual(44);

    const removeBtn = row.getByRole("button", {
      name: `Usuń składnik: ${productName}`,
      exact: true,
    });
    await expect(removeBtn).toBeVisible();
    const removeBox = await removeBtn.boundingBox();
    expect(removeBox?.height).toBeGreaterThanOrEqual(44);

    // Przycisk "Zatwierdź składnik" jest nieaktywny ze względu na błąd jednostki
    const confirmBtn = row.getByRole("button", {
      name: `Zatwierdź składnik: ${productName}`,
      exact: true,
    });
    await expect(confirmBtn).toBeDisabled();

    // Klikamy „Edytuj produkt” w wierszu
    await editBtn.click();
    const dialog = page.getByRole("dialog", {
      name: "Edytuj produkt",
      exact: true,
    });
    await expect(dialog).toBeVisible();

    // Dodajemy „łyżka” z przelicznikiem 10 g
    await dialog.getByRole("button", { name: "łyżka", exact: true }).click();
    const convInput = dialog.getByLabel("1 łyżka =", { exact: true });
    await expect(convInput).toBeVisible();
    await convInput.fill("10");

    // Zapisujemy zmiany w produkcie
    const updateResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith(`/api/products/${paprika.id}`) &&
        res.request().method() === "PUT",
    );
    await dialog
      .getByRole("button", { name: "Zapisz zmiany", exact: true })
      .click();
    expect((await updateResponse).status()).toBe(200);
    await expect(dialog).toHaveCount(0);

    // Wiersz przyjmuje 2 łyżki bez błędu jednostki i nadal wymaga „Zatwierdź składnik”
    await expect(row.getByText("Wybierz jednostkę produktu.")).toHaveCount(0);
    await expect(row.getByLabel(`Ilość: ${productName}`)).toHaveValue("2");
    await expect(row.getByText("sprawdź", { exact: true })).toBeVisible();
    await expect(confirmBtn).toBeEnabled();
    await expect(saveBtn).toBeDisabled();

    // Zatwierdzamy składnik
    await confirmBtn.click();
    await expect(
      row.getByText("✓ zatwierdzony", { exact: true }),
    ).toBeVisible();

    // Sprawdzamy przycisk "Cofnij zatwierdzenie" (wysokość >= 44 px)
    const undoBtn = row.getByRole("button", {
      name: `Cofnij zatwierdzenie: ${productName}`,
      exact: true,
    });
    await expect(undoBtn).toBeVisible();
    const undoBox = await undoBtn.boundingBox();
    expect(undoBox?.height).toBeGreaterThanOrEqual(44);

    await expect(saveBtn).toBeEnabled();

    // Zapisujemy przepis
    const recipeCreate = page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/recipes") && res.request().method() === "POST",
    );
    await saveBtn.click();
    const createdRes = await recipeCreate;
    expect(createdRes.status()).toBe(201);
    const recipe = await createdRes.json();
    createdRecipeId = recipe.id;

    // Przepis ma 2 łyżki i poprawne kcal (2 * 10g = 20g -> 56 kcal)
    await expect(page).toHaveURL(`/przepis/${createdRecipeId}`);
    await expect(page.locator(".kcal")).toHaveText("56");

    // Na liście przepisów w kafelku
    await page.goto("/");
    const card = page.getByRole("button", {
      name: new RegExp(`(Pokaż|Otwórz) przepis: ${recipeTitle}`),
    });
    await expect(card).toBeVisible();
    await expect(card).toContainText("56 kcal");
  } finally {
    if (createdRecipeId) {
      await request.delete(`/api/recipes/${createdRecipeId}`);
    }
  }
});
