import cron, { type ScheduledTask } from 'node-cron';
import { asc, eq } from 'drizzle-orm';
import { db } from '../../../database/index.ts';
import { channels, channelStreams, streamHealthLogs } from '../../../database/schema/index.ts';
import { appCache } from './cache.ts';

export interface HlsProbeResult {
  isPlayable: boolean;
  healthStatus: 'healthy' | 'degraded' | 'offline';
  responseTimeMs: number;
  httpStatus: number | null;
  details: string;
  playlistInfo: {
    type: 'master' | 'media' | 'invalid';
    variants: number;
    segments: number;
    variantVerified?: boolean;
    segmentVerified?: boolean;
  };
}

function resolveRelativeUrl(baseUrl: string, target: string): string {
  try {
    return new URL(target, baseUrl).toString();
  } catch {
    return target;
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 8000, method: 'GET' | 'HEAD' = 'GET') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'User-Agent': 'VeloStream-HLS-Prober/1.0',
        Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, text/plain, */*',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function probePlayableHlsStream(streamUrl: string): Promise<HlsProbeResult> {
  const startedAt = Date.now();
  try {
    const res = await fetchWithTimeout(streamUrl, 8000, 'GET');
    const responseTimeMs = Date.now() - startedAt;

    if (!res.ok) {
      return {
        isPlayable: false,
        healthStatus: 'offline',
        responseTimeMs,
        httpStatus: res.status,
        details: `Manifest returned HTTP ${res.status} ${res.statusText}`,
        playlistInfo: { type: 'invalid', variants: 0, segments: 0 },
      };
    }

    const body = (await res.text()).slice(0, 65536);
    const trimmed = body.trim();

    if (!trimmed.startsWith('#EXTM3U')) {
      return {
        isPlayable: false,
        healthStatus: 'offline',
        responseTimeMs,
        httpStatus: res.status,
        details: 'HTTP 200 received, but payload is not a valid #EXTM3U HLS manifest',
        playlistInfo: { type: 'invalid', variants: 0, segments: 0 },
      };
    }

    const lines = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const variantUris: string[] = [];
    const segmentUris: string[] = [];

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const nextUri = lines.slice(i + 1).find((candidate) => !candidate.startsWith('#'));
        if (nextUri) variantUris.push(resolveRelativeUrl(streamUrl, nextUri));
      } else if (line.startsWith('#EXTINF')) {
        const nextUri = lines.slice(i + 1).find((candidate) => !candidate.startsWith('#'));
        if (nextUri) segmentUris.push(resolveRelativeUrl(streamUrl, nextUri));
      }
    }

    if (variantUris.length > 0) {
      const firstVariant = variantUris[0];
      try {
        const variantRes = await fetchWithTimeout(firstVariant, 6000, 'GET');
        if (!variantRes.ok) {
          return {
            isPlayable: false,
            healthStatus: 'degraded',
            responseTimeMs: Date.now() - startedAt,
            httpStatus: variantRes.status,
            details: `Master playlist valid (${variantUris.length} variants), but variant returned HTTP ${variantRes.status}`,
            playlistInfo: { type: 'master', variants: variantUris.length, segments: 0, variantVerified: false },
          };
        }
        const variantBody = (await variantRes.text()).slice(0, 65536).trim();
        const variantLines = variantBody.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const variantSegments = variantLines.filter(
          (l, idx) => idx > 0 && !l.startsWith('#') && variantLines[idx - 1]?.startsWith('#EXTINF')
        );
        const hasExtInf = variantBody.includes('#EXTINF') || variantBody.includes('#EXT-X-TARGETDURATION');

        if (!variantBody.startsWith('#EXTM3U') || !hasExtInf) {
          return {
            isPlayable: false,
            healthStatus: 'offline',
            responseTimeMs: Date.now() - startedAt,
            httpStatus: variantRes.status,
            details: 'Variant playlist missing valid #EXTM3U / #EXTINF media segments',
            playlistInfo: { type: 'master', variants: variantUris.length, segments: 0, variantVerified: false },
          };
        }

        const totalMs = Date.now() - startedAt;
        return {
          isPlayable: true,
          healthStatus: totalMs > 3500 ? 'degraded' : 'healthy',
          responseTimeMs: totalMs,
          httpStatus: res.status,
          details: `Verified master playlist (${variantUris.length} ABR variants, ${Math.max(variantSegments.length, 1)} media segments)`,
          playlistInfo: {
            type: 'master',
            variants: variantUris.length,
            segments: variantSegments.length,
            variantVerified: true,
          },
        };
      } catch (variantErr: unknown) {
        return {
          isPlayable: false,
          healthStatus: 'offline',
          responseTimeMs: Date.now() - startedAt,
          httpStatus: res.status,
          details: `Master variant unreachable: ${variantErr instanceof Error ? variantErr.message : 'Network error'}`,
          playlistInfo: { type: 'master', variants: variantUris.length, segments: 0, variantVerified: false },
        };
      }
    }

    if (segmentUris.length > 0 || trimmed.includes('#EXT-X-TARGETDURATION')) {
      let segmentVerified = false;
      if (segmentUris.length > 0) {
        try {
          const segRes = await fetchWithTimeout(segmentUris[0], 5000, 'HEAD');
          segmentVerified = segRes.ok || segRes.status === 405;
          if (segRes.status === 405) {
            const getSeg = await fetchWithTimeout(segmentUris[0], 5000, 'GET');
            segmentVerified = getSeg.ok;
          }
        } catch {
          segmentVerified = false;
        }
      }

      if (segmentUris.length > 0 && !segmentVerified) {
        return {
          isPlayable: false,
          healthStatus: 'offline',
          responseTimeMs: Date.now() - startedAt,
          httpStatus: res.status,
          details: 'Media playlist parsed, but first media segment failed reachability check',
          playlistInfo: { type: 'media', variants: 0, segments: segmentUris.length, segmentVerified: false },
        };
      }

      const totalMs = Date.now() - startedAt;
      return {
        isPlayable: true,
        healthStatus: totalMs > 3500 ? 'degraded' : 'healthy',
        responseTimeMs: totalMs,
        httpStatus: res.status,
        details: `Verified media playlist (${segmentUris.length} segments reachable)`,
        playlistInfo: { type: 'media', variants: 0, segments: segmentUris.length, segmentVerified },
      };
    }

    return {
      isPlayable: false,
      healthStatus: 'offline',
      responseTimeMs,
      httpStatus: res.status,
      details: 'Manifest has #EXTM3U header but contains no playable variants or media segments',
      playlistInfo: { type: 'invalid', variants: 0, segments: 0 },
    };
  } catch (error: unknown) {
    return {
      isPlayable: false,
      healthStatus: 'offline',
      responseTimeMs: Date.now() - startedAt,
      httpStatus: null,
      details: error instanceof Error ? error.message : 'Stream probe timed out or failed',
      playlistInfo: { type: 'invalid', variants: 0, segments: 0 },
    };
  }
}

export async function recomputeChannelHealth(
  channelId: number
): Promise<'healthy' | 'degraded' | 'offline' | 'unknown'> {
  const streams = await db
    .select()
    .from(channelStreams)
    .where(eq(channelStreams.channelId, channelId))
    .orderBy(asc(channelStreams.priority));

  const active = streams.filter((s) => s.isActive);
  let nextStatus: 'healthy' | 'degraded' | 'offline' | 'unknown' = 'unknown';

  if (active.length === 0) {
    nextStatus = 'offline';
  } else if (active.some((s) => s.healthStatus === 'healthy')) {
    const anyFailed = active.some((s) => s.healthStatus === 'offline');
    nextStatus = anyFailed ? 'degraded' : 'healthy';
  } else if (active.some((s) => s.healthStatus === 'degraded')) {
    nextStatus = 'degraded';
  } else if (active.every((s) => s.healthStatus === 'unknown')) {
    nextStatus = 'unknown';
  } else {
    nextStatus = 'offline';
  }

  await db
    .update(channels)
    .set({
      currentHealthStatus: nextStatus,
      lastCheckedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(channels.id, channelId));

  appCache.invalidatePrefix('channels:');
  appCache.invalidatePrefix('homepage:');
  return nextStatus;
}

export async function checkAndLogStream(
  streamId: number,
  mode: 'scheduled' | 'manual_test' = 'scheduled'
) {
  const [stream] = await db.select().from(channelStreams).where(eq(channelStreams.id, streamId));
  if (!stream) {
    throw new Error('Stream not found');
  }

  const previousStatus = stream.healthStatus;
  const probe = await probePlayableHlsStream(stream.streamUrl);

  let eventType = mode === 'manual_test' ? 'manual_test' : 'checked';
  if (previousStatus !== 'offline' && probe.healthStatus === 'offline') {
    eventType = 'failed';
  } else if ((previousStatus === 'offline' || previousStatus === 'degraded') && probe.healthStatus === 'healthy') {
    eventType = 'recovered';
  }

  const consecutiveFailures = probe.isPlayable ? 0 : stream.consecutiveFailures + 1;

  const [updated] = await db
    .update(channelStreams)
    .set({
      healthStatus: probe.healthStatus,
      responseTimeMs: probe.responseTimeMs,
      lastHttpStatus: probe.httpStatus,
      lastError: probe.isPlayable ? null : probe.details,
      lastCheckedAt: new Date(),
      consecutiveFailures,
      playlistDetails: probe.playlistInfo,
      updatedAt: new Date(),
    })
    .where(eq(channelStreams.id, stream.id))
    .returning();

  const [logEntry] = await db
    .insert(streamHealthLogs)
    .values({
      channelId: stream.channelId,
      streamId: stream.id,
      eventType,
      previousStatus,
      newStatus: probe.healthStatus,
      responseTimeMs: probe.responseTimeMs,
      httpStatus: probe.httpStatus,
      isPlayableHls: probe.isPlayable,
      details: probe.details,
    })
    .returning();

  const channelStatus = await recomputeChannelHealth(stream.channelId);

  return {
    stream: updated,
    probe,
    logEntry,
    channelStatus,
  };
}

export async function runHourlyStreamHealthSweep() {
  const activeStreams = await db
    .select()
    .from(channelStreams)
    .where(eq(channelStreams.isActive, true))
    .orderBy(asc(channelStreams.channelId), asc(channelStreams.priority));

  const results = [];
  for (const stream of activeStreams) {
    try {
      const res = await checkAndLogStream(stream.id, 'scheduled');
      results.push({
        streamId: stream.id,
        channelId: stream.channelId,
        status: res.probe.healthStatus,
        responseTimeMs: res.probe.responseTimeMs,
      });
    } catch (err) {
      console.error(`Failed checking stream ${stream.id}:`, err);
    }
  }
  return {
    checkedCount: results.length,
    healthyCount: results.filter((r) => r.status === 'healthy').length,
    degradedCount: results.filter((r) => r.status === 'degraded').length,
    offlineCount: results.filter((r) => r.status === 'offline').length,
    results,
  };
}

let cronTask: ScheduledTask | null = null;

export function startStreamMonitorCron() {
  if (cronTask) return cronTask;
  cronTask = cron.schedule('0 * * * *', async () => {
    try {
      console.log('[HLS Monitor] Starting scheduled hourly stream health check...');
      const summary = await runHourlyStreamHealthSweep();
      console.log(
        `[HLS Monitor] Completed: ${summary.checkedCount} checked (${summary.healthyCount} healthy, ${summary.degradedCount} degraded, ${summary.offlineCount} offline)`
      );
    } catch (err) {
      console.error('[HLS Monitor] Hourly sweep error:', err);
    }
  });
  return cronTask;
}

export function stopStreamMonitorCron() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}
