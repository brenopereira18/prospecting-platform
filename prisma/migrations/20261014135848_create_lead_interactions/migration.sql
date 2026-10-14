-- CreateEnum
CREATE TYPE "InteractionChannel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'EMAIL', 'PHONE', 'OTHER');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('FIRST_CONTACT', 'FOLLOW_UP', 'RESPONSE_RECEIVED', 'MEETING', 'OTHER');

-- CreateTable
CREATE TABLE "lead_interactions" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" "InteractionChannel" NOT NULL,
    "type" "InteractionType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_interactions_leadId_createdAt_idx" ON "lead_interactions"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
