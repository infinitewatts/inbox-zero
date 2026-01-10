-- AlterTable
ALTER TABLE "EmailAccount" ADD COLUMN "defaultPersona" TEXT;

-- CreateTable
CREATE TABLE "ComposeTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "to" TEXT,
    "cc" TEXT,
    "bcc" TEXT,
    "persona" TEXT,
    "emailAccountId" TEXT NOT NULL,

    CONSTRAINT "ComposeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComposeTemplate_emailAccountId_idx" ON "ComposeTemplate"("emailAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ComposeTemplate_emailAccountId_name_key" ON "ComposeTemplate"("emailAccountId", "name");

-- AddForeignKey
ALTER TABLE "ComposeTemplate" ADD CONSTRAINT "ComposeTemplate_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
