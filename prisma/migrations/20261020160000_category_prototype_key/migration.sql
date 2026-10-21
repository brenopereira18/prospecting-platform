ALTER TABLE "categories" ADD COLUMN "prototypeCategoryKey" TEXT;

-- Bootstrap existing categories once. Runtime compatibility uses this stable key,
-- never a display-name comparison; renaming the category preserves compatibility.
UPDATE "categories"
SET "prototypeCategoryKey" = 'hamburgueria'
WHERE lower(trim("name")) IN ('hamburgueria', 'hamburguerias');
