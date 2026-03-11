import { promises as fs } from 'fs';
import { NextResponse } from 'next/server';

type FsStat = {
  bsize: number;
  blocks: number;
  bavail: number;
  bfree: number;
};

let lastWarnAt = 0;

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export async function GET() {
  try {
    const thresholdPercent = Math.max(1, Math.min(99, Number(process.env.DISK_ALERT_THRESHOLD_PERCENT ?? 80)));
    const targetPath = process.env.DISK_MONITOR_PATH || process.cwd();
    const stat = (await fs.statfs(targetPath)) as unknown as FsStat;

    const blockSize = toNumber(stat.bsize);
    const totalBlocks = toNumber(stat.blocks);
    const freeBlocks = toNumber(stat.bavail || stat.bfree);

    const totalBytes = Math.max(0, blockSize * totalBlocks);
    const freeBytes = Math.max(0, blockSize * freeBlocks);
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
    const warning = usedPercent >= thresholdPercent;

    if (warning) {
      const now = Date.now();
      if (now - lastWarnAt > 30 * 60 * 1000) {
        lastWarnAt = now;
        console.warn(
          `[storage-alert] Disk usage is ${usedPercent}% (threshold ${thresholdPercent}%) on path "${targetPath}"`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      path: targetPath,
      threshold_percent: thresholdPercent,
      used_percent: usedPercent,
      used_bytes: usedBytes,
      free_bytes: freeBytes,
      total_bytes: totalBytes,
      warning,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check storage usage';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
