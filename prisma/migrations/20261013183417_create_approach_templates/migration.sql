-- CreateTable
CREATE TABLE "approach_templates" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approach_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approach_templates_categoryId_idx" ON "approach_templates"("categoryId");

-- AddForeignKey
ALTER TABLE "approach_templates" ADD CONSTRAINT "approach_templates_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
