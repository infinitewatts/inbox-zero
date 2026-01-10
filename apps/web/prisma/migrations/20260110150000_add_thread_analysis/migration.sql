-- CreateEnum
CREATE TYPE "ThreadSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED');

-- CreateEnum
CREATE TYPE "ThreadNextAction" AS ENUM ('TO_REPLY', 'AWAITING', 'FYI', 'DONE');

-- CreateTable
CREATE TABLE "ThreadAnalysis" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "keyTopics" TEXT[],
    "sentiment" "ThreadSentiment" NOT NULL,
    "sentimentScore" DOUBLE PRECISION,
    "nextAction" "ThreadNextAction" NOT NULL,
    "nextActionNote" TEXT,
    "participantCount" INTEGER NOT NULL,
    "emailAccountId" TEXT NOT NULL,

    CONSTRAINT "ThreadAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThreadAnalysis_emailAccountId_idx" ON "ThreadAnalysis"("emailAccountId");

-- CreateIndex
CREATE INDEX "ThreadAnalysis_threadId_idx" ON "ThreadAnalysis"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadAnalysis_emailAccountId_threadId_key" ON "ThreadAnalysis"("emailAccountId", "threadId");

-- AddForeignKey
ALTER TABLE "ThreadAnalysis" ADD CONSTRAINT "ThreadAnalysis_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
