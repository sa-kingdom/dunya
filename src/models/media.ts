import {useSequelize} from "../init/sequelize.ts";
import {DataTypes, Model} from "sequelize";
import type {Attachment, Sticker} from "discord.js";
import {StickerFormatType} from "discord.js";
import got from "got";

const sequelize = useSequelize();

/**
 * Media Model
 */
export default class Media extends Model {
    declare id: string;
    declare name: string;
    declare description: string | null;
    declare contentType: string | null;
    declare size: number;
    declare url: string | null;
    declare proxyUrl: string | null;
    declare height: number | null;
    declare width: number | null;
    declare ephemeral: boolean | null;
    declare duration: number | null;
    declare waveform: string | null;
}

Media.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            len: [0, 1024],
        },
    },
    contentType: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    size: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    url: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    proxyUrl: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    height: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    width: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    ephemeral: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    },
    duration: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    waveform: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    sequelize,
    timestamps: false,
    modelName: "media",
});

async function downloadMedia(
    id: string,
    url: string,
    isForceRefresh: boolean = false,
): Promise<void> {
    const targetDir = "assets";
    const targetPath = `${targetDir}/media-${id}`;

    if (!isForceRefresh && await Bun.file(targetPath).exists()) {
        return;
    }

    try {
        const {mkdir} = await import("node:fs/promises");
        await mkdir(targetDir, {recursive: true});

        const buffer = await got(url).buffer();
        await Bun.write(targetPath, buffer);
    } catch (e) {
        console.error(`Failed to download media ${id}:`, e);
    }
}

export async function attachmentToMedia(
    attachment: Attachment,
    isForceRefresh: boolean = false,
): Promise<{
    id: string;
    name: string;
    description: string | null;
    contentType: string | null;
    size: number;
    url: string;
    proxyUrl: string;
    height: number | null;
    width: number | null;
    ephemeral: boolean | null;
    duration: number | null;
    waveform: string | null;
}> {
    const {
        id,
        name, description,
        contentType, size,
        url, proxyURL: proxyUrl,
        height, width,
        ephemeral, duration, waveform,
    } = attachment;

    await downloadMedia(id, url, isForceRefresh);

    return {
        id,
        name, description,
        contentType, size,
        url, proxyUrl,
        height, width,
        ephemeral, duration, waveform,
    };
}

export async function stickerToMedia(
    sticker: Sticker,
    isForceRefresh: boolean = false,
): Promise<{
    id: string;
    name: string;
    description: string | null;
    contentType: string | null;
    size: number;
    url: string;
    proxyUrl: string;
    height: number | null;
    width: number | null;
    ephemeral: boolean | null;
    duration: number | null;
    waveform: string | null;
}> {
    const {
        id,
        name, description,
        format, url,
    } = sticker;

    let contentType: string | null = null;
    switch (format) {
    case StickerFormatType.PNG:
        contentType = "image/png";
        break;
    case StickerFormatType.APNG:
        contentType = "image/apng";
        break;
    case StickerFormatType.Lottie:
        contentType = "application/x-lottie+json";
        break;
    case StickerFormatType.GIF:
        contentType = "image/gif";
        break;
    }

    await downloadMedia(id, url, isForceRefresh);

    // Get size if possible (since Sticker doesn't have it)
    const targetPath = `assets/media-${id}`;
    const file = Bun.file(targetPath);
    const size = (await file.exists()) ? file.size : 0;

    return {
        id,
        name, description,
        contentType, size,
        url, proxyUrl: url,
        height: null, width: null,
        ephemeral: false, duration: null, waveform: null,
    };
}
