-- AlterTable
ALTER TABLE `guildconfig` ADD COLUMN `boostChannelId` VARCHAR(191) NULL,
    ADD COLUMN `ticketCategoryId` VARCHAR(191) NULL,
    ADD COLUMN `verifyRoleId` VARCHAR(191) NULL,
    ADD COLUMN `welcomeChannelId` VARCHAR(191) NULL;
