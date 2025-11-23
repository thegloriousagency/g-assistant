-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "lastEmailToAdminAt" TIMESTAMP(3),
ADD COLUMN     "lastEmailToClientAt" TIMESTAMP(3);
