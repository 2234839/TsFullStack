-- 空间操作员：授权某账号管理某引流空间（账号×空间，渠道无关）
CREATE TABLE `GroupSpaceOperator` (
    `id` INTEGER NOT NULL,
    `userId` TEXT NOT NULL,
    `spaceId` INTEGER NOT NULL,
    `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated` DATETIME NOT NULL,
    CONSTRAINT `GroupSpaceOperator_pkey` PRIMARY KEY (`id`),
    CONSTRAINT `GroupSpaceOperator_userId_spaceId_key` UNIQUE (`userId`, `spaceId`),
    CONSTRAINT `GroupSpaceOperator_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `GroupSpaceOperator_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `GroupSpace` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX `GroupSpaceOperator_userId_spaceId_idx` ON `GroupSpaceOperator`(`userId`, `spaceId`);

-- 渠道消息存档：公众号等消息渠道收发全量留痕（管理员看全部，用户只看自己的）
CREATE TABLE `ChannelMessage` (
    `id` INTEGER NOT NULL,
    `channel` TEXT NOT NULL,
    `direction` TEXT NOT NULL,
    `msgType` TEXT NOT NULL,
    `peerId` TEXT NOT NULL,
    `content` TEXT NULL,
    `mediaId` TEXT NULL,
    `userId` TEXT NULL,
    `created` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated` DATETIME NOT NULL,
    CONSTRAINT `ChannelMessage_pkey` PRIMARY KEY (`id`)
);

CREATE INDEX `ChannelMessage_channel_peerId_created_idx` ON `ChannelMessage`(`channel`, `peerId`, `created`);
CREATE INDEX `ChannelMessage_channel_created_idx` ON `ChannelMessage`(`channel`, `created`);
