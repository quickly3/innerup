-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lastPracticedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Focus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "why" TEXT,
    "intensity" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Focus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "focusId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'curious',
    "triedWhat" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InputItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interestId" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" TEXT,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "takeaway" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InputItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Knowledge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceInputId" TEXT,
    "statement" TEXT NOT NULL,
    "topic" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 3,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_KnowledgeToSkill" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_KnowledgeToSkill_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Focus_userId_idx" ON "Focus"("userId");

-- CreateIndex
CREATE INDEX "Interest_userId_idx" ON "Interest"("userId");

-- CreateIndex
CREATE INDEX "Interest_focusId_idx" ON "Interest"("focusId");

-- CreateIndex
CREATE INDEX "InputItem_userId_idx" ON "InputItem"("userId");

-- CreateIndex
CREATE INDEX "InputItem_interestId_idx" ON "InputItem"("interestId");

-- CreateIndex
CREATE INDEX "Knowledge_userId_idx" ON "Knowledge"("userId");

-- CreateIndex
CREATE INDEX "Knowledge_sourceInputId_idx" ON "Knowledge"("sourceInputId");

-- CreateIndex
CREATE INDEX "_KnowledgeToSkill_B_index" ON "_KnowledgeToSkill"("B");

-- AddForeignKey
ALTER TABLE "Focus" ADD CONSTRAINT "Focus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_focusId_fkey" FOREIGN KEY ("focusId") REFERENCES "Focus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputItem" ADD CONSTRAINT "InputItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputItem" ADD CONSTRAINT "InputItem_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knowledge" ADD CONSTRAINT "Knowledge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knowledge" ADD CONSTRAINT "Knowledge_sourceInputId_fkey" FOREIGN KEY ("sourceInputId") REFERENCES "InputItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KnowledgeToSkill" ADD CONSTRAINT "_KnowledgeToSkill_A_fkey" FOREIGN KEY ("A") REFERENCES "Knowledge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KnowledgeToSkill" ADD CONSTRAINT "_KnowledgeToSkill_B_fkey" FOREIGN KEY ("B") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
