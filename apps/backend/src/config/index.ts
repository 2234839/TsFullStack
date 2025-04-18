import fs from 'fs/promises';

export const AppConfig = {
  uploadDir: './uploads',
};

/** 确保所有配置项可用 */
export async function seedConfig() {
  const dirExists = await fs.stat(AppConfig.uploadDir).catch(() => null);
  if (!dirExists) {
    await fs.mkdir(AppConfig.uploadDir, { recursive: true });
    console.log(`Upload directory ${AppConfig.uploadDir} is ready`);
  } else if (!dirExists.isDirectory()) {
    throw new Error(`Upload directory ${AppConfig.uploadDir} is not a directory`);
  }
}
