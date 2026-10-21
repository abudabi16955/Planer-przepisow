CREATE TABLE product (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(btrim(name)) > 0),
    units text[] NOT NULL CHECK (
        cardinality(units) > 0 AND units <@ ARRAY[
            'g', 'kg', 'ml', 'l', 'szt.', 'łyżeczka', 'łyżka', 'szklanka',
            'szczypta', 'ząbek', 'puszka'
        ]::text[] AND array_position(units, NULL) IS NULL
    ),
    nutrition_basis text CHECK (nutrition_basis IN ('g', 'ml', 'szt.')),
    kcal numeric CHECK (kcal >= 0),
    protein numeric CHECK (protein >= 0),
    carbs numeric CHECK (carbs >= 0),
    fat numeric CHECK (fat >= 0),
    unit_conversions jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(unit_conversions) = 'object'),
    is_custom boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_name_lower_key ON product (lower(name));

CREATE TABLE recipe (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL CHECK (length(btrim(title)) > 0),
    category text NOT NULL CHECK (category IN ('sniadanie', 'obiad', 'kolacja')),
    time_min integer CHECK (time_min > 0),
    servings integer NOT NULL CHECK (servings BETWEEN 1 AND 50),
    source_type text NOT NULL CHECK (source_type IN ('link', 'pdf', 'manual')),
    source_platform text CHECK (source_platform IN ('instagram', 'facebook')),
    source_url text,
    source_description text,
    video jsonb,
    pdf jsonb,
    photo jsonb,
    kcal numeric CHECK (kcal >= 0),
    protein numeric CHECK (protein >= 0),
    carbs numeric CHECK (carbs >= 0),
    fat numeric CHECK (fat >= 0),
    steps text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recipe_ingredient (
    recipe_id uuid NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
    position integer NOT NULL CHECK (position >= 0),
    product_id uuid NOT NULL REFERENCES product(id),
    quantity numeric CHECK (quantity > 0),
    unit text NOT NULL,
    PRIMARY KEY (recipe_id, position),
    CHECK ((quantity IS NULL AND unit = '') OR (quantity IS NOT NULL AND unit <> ''))
);
CREATE INDEX recipe_ingredient_product_idx ON recipe_ingredient(product_id);

CREATE TABLE plan_entry (
    date date NOT NULL,
    slot integer NOT NULL CHECK (slot BETWEEN 0 AND 2),
    recipe_id uuid NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
    PRIMARY KEY (date, slot)
);
CREATE INDEX plan_entry_recipe_idx ON plan_entry(recipe_id);

CREATE TABLE daily_goal (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    kcal numeric NOT NULL CHECK (kcal >= 0),
    protein numeric NOT NULL CHECK (protein >= 0),
    carbs numeric NOT NULL CHECK (carbs >= 0),
    fat numeric NOT NULL CHECK (fat >= 0)
);
INSERT INTO daily_goal (kcal, protein, carbs, fat) VALUES (2000, 100, 250, 65);

CREATE TABLE shopping_check (
    week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
    item_key text NOT NULL,
    checked boolean NOT NULL DEFAULT false,
    PRIMARY KEY (week_start, item_key)
);

CREATE TABLE import_job (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url text NOT NULL,
    platform text NOT NULL CHECK (platform IN ('instagram', 'facebook')),
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
    error_code text,
    video jsonb,
    thumbnail jsonb,
    description text,
    title text,
    size_bytes bigint CHECK (size_bytes >= 0),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE upload (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    path text NOT NULL UNIQUE,
    original_name text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
    recipe_id uuid REFERENCES recipe(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);
