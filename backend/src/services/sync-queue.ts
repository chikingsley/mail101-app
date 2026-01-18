import { Queue, Worker, Job } from "bullmq";
import { redisConnection } from "./redis";
import { withRateLimit } from "./rate-limiter";
import {
  emailQueries,
  syncQueries,
  userQueries,
  MAIL_FOLDERS,
  type MailFolder,
} from "../db/db";
import {
  getDeltaEmails,
  type GraphMailFolder,
} from "./graph";
import { getMicrosoftToken } from "./clerk";

// Job types
interface SyncJobData {
  clerkUserId: string;
  userId: string;
  folder?: MailFolder;
  fullSync?: boolean;
}

interface SyncJobResult {
  inserted: number;
  updated: number;
  removed: number;
  total: number;
  byFolder?: Record<string, { inserted: number; updated: number; removed: number; total: number }>;
}

// Create the sync queue
export const syncQueue = new Queue<SyncJobData, SyncJobResult>("email-sync", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 100,
      age: 3600, // 1 hour
    },
    removeOnFail: {
      count: 50,
      age: 86400, // 24 hours
    },
  },
});

// Helper to sync a single folder
async function syncFolder(
  accessToken: string,
  userId: string,
  folder: MailFolder,
  clerkUserId: string
): Promise<{
  inserted: number;
  updated: number;
  removed: number;
  total: number;
}> {
  const syncState = await syncQueries.getByUserAndFolder(userId, folder);

  let emails: any[] = [];
  let deltaLink: string | undefined;

  // Use rate limiter for Graph API calls
  const deltaResult = await withRateLimit(clerkUserId, async () => {
    if (syncState?.delta_link) {
      return getDeltaEmails(
        accessToken,
        folder as GraphMailFolder,
        syncState.delta_link
      );
    }
    return getDeltaEmails(accessToken, folder as GraphMailFolder);
  });

  emails = deltaResult.emails;
  deltaLink = deltaResult.deltaLink;

  let inserted = 0;
  let updated = 0;
  let removed = 0;

  for (const email of emails) {
    if (email["@removed"]) {
      try {
        await emailQueries.deleteByOutlookId(userId, email.id);
        removed++;
      } catch (err) {
        console.error(`Failed to remove email ${email.id}:`, err);
      }
      continue;
    }

    try {
      const result = await emailQueries.insert(userId, {
        outlook_id: email.id,
        conversation_id: email.conversationId || undefined,
        internet_message_id: email.internetMessageId || undefined,
        folder,
        from_email: email.from?.emailAddress?.address || "",
        from_name: email.from?.emailAddress?.name || undefined,
        subject: email.subject || undefined,
        body_preview: email.bodyPreview || undefined,
        to_emails:
          email.toRecipients?.map((r: any) => r.emailAddress?.address) || [],
        cc_emails:
          email.ccRecipients?.map((r: any) => r.emailAddress?.address) || [],
        is_read: email.isRead,
        has_attachments: email.hasAttachments,
        importance: email.importance || "normal",
        received_at: email.receivedDateTime,
        sent_at: email.sentDateTime || undefined,
      });

      if (result) {
        inserted++;
      } else {
        await emailQueries.updateFromSync(userId, email.id, email.isRead);
        updated++;
      }
    } catch (err) {
      console.error(`Failed to process email ${email.id}:`, err);
    }
  }

  if (deltaLink) {
    await syncQueries.upsert(userId, folder, deltaLink);
  }

  return { inserted, updated, removed, total: emails.length };
}

// Process sync jobs
async function processSyncJob(job: Job<SyncJobData>): Promise<SyncJobResult> {
  const { clerkUserId, userId, folder, fullSync } = job.data;

  console.log(`[SyncQueue] Processing job ${job.id} for user ${clerkUserId}`);

  const accessToken = await getMicrosoftToken(clerkUserId);
  const foldersToSync = folder ? [folder] : MAIL_FOLDERS;

  const results: Record<
    string,
    { inserted: number; updated: number; removed: number; total: number }
  > = {};
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalRemoved = 0;
  let totalEmails = 0;

  for (let i = 0; i < foldersToSync.length; i++) {
    const currentFolder = foldersToSync[i];
    try {
      // Update job progress
      await job.updateProgress((i / foldersToSync.length) * 100);

      const result = await syncFolder(
        accessToken,
        userId,
        currentFolder,
        clerkUserId
      );
      results[currentFolder] = result;
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalRemoved += result.removed;
      totalEmails += result.total;

      console.log(
        `[SyncQueue] Synced ${currentFolder}: +${result.inserted} ~${result.updated} -${result.removed}`
      );
    } catch (err) {
      console.error(`[SyncQueue] Error syncing folder ${currentFolder}:`, err);
      results[currentFolder] = { inserted: 0, updated: 0, removed: 0, total: 0 };
    }
  }

  await job.updateProgress(100);

  return {
    inserted: totalInserted,
    updated: totalUpdated,
    removed: totalRemoved,
    total: totalEmails,
    byFolder: results,
  };
}

// Create the worker (call this in worker.ts)
export function createSyncWorker() {
  const worker = new Worker<SyncJobData, SyncJobResult>(
    "email-sync",
    processSyncJob,
    {
      connection: redisConnection,
      concurrency: 5, // Process up to 5 jobs concurrently
      limiter: {
        max: 10,
        duration: 1000, // Max 10 jobs per second
      },
    }
  );

  worker.on("completed", (job, result) => {
    console.log(
      `[SyncWorker] Job ${job.id} completed: +${result.inserted} ~${result.updated} -${result.removed}`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(`[SyncWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[SyncWorker] Worker error:", err);
  });

  return worker;
}

// Helper to queue a sync job
export async function queueSync(
  clerkUserId: string,
  userId: string,
  options?: { folder?: MailFolder; priority?: number }
): Promise<Job<SyncJobData, SyncJobResult>> {
  const job = await syncQueue.add(
    "sync",
    {
      clerkUserId,
      userId,
      folder: options?.folder,
    },
    {
      priority: options?.priority || 0,
      jobId: options?.folder
        ? `sync:${userId}:${options.folder}`
        : `sync:${userId}:all`,
    }
  );

  return job;
}

// Get job status
export async function getSyncJobStatus(jobId: string) {
  const job = await syncQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    result: job.returnvalue,
    failedReason: job.failedReason,
    createdAt: job.timestamp,
  };
}
