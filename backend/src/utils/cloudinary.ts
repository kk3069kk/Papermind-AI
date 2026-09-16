import { v2 as cloudinary } from "cloudinary";
import fs from "node:fs/promises";
import path from "node:path";
import { settings } from "../config.js";
import { getLogger } from "../logger.js";

const logger = getLogger("cloudinary");

function configure() {
  cloudinary.config({
    cloud_name: settings.cloudinaryCloudName,
    api_key: settings.cloudinaryApiKey,
    api_secret: settings.cloudinaryApiSecret,
    secure: true,
  });
}

export async function uploadPdf(
  fileBytes: Buffer,
  filename: string,
  userId: number,
): Promise<{ url: string; public_id: string }> {
  if (!settings.cloudinaryEnabled) {
    const dir = path.resolve(`uploads/${userId}`);
    await fs.mkdir(dir, { recursive: true });
    const dest = path.join(dir, filename);
    await fs.writeFile(dest, fileBytes);
    logger.info("local_upload", { dest });
    return { url: dest, public_id: "" };
  }

  configure();
  const result = await new Promise<Record<string, string>>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: `papermind/${userId}`,
        public_id: path.parse(filename).name,
        format: "pdf",
        overwrite: false,
        use_filename: true,
      },
      (error, uploaded) => {
        if (error || !uploaded) reject(error || new Error("Cloudinary upload failed"));
        else resolve(uploaded as unknown as Record<string, string>);
      },
    );
    stream.end(fileBytes);
  });

  logger.info("cloudinary_upload", { public_id: result.public_id, url: result.secure_url });
  return { url: result.secure_url, public_id: result.public_id };
}

export async function deletePdf(publicId: string, localPath?: string) {
  if (localPath && !publicId) {
    await fs.unlink(localPath).catch(() => undefined);
    return;
  }
  if (!publicId || !settings.cloudinaryEnabled) return;
  configure();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
    logger.info("cloudinary_deleted", { public_id: publicId });
  } catch (e) {
    logger.warn("cloudinary_delete_failed", { public_id: publicId, error: String(e) });
  }
}
