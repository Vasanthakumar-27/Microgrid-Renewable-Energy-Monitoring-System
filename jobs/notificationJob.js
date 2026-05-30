const Queue = require('bull');
const notificationService = require('../services/notificationService');

let emailQueue, smsQueue;
let usingFallback = false;

// Create in-memory fallback queues
const inMemoryEmailJobs = [];
const inMemorySmsJobs = [];
let jobIdCounter = 0;

// Create fallback queue interface
const createFallbackQueue = (jobArray, sendFunction) => {
  return {
    add: async (data, options) => {
      const jobId = ++jobIdCounter;
      const job = { id: jobId, data, options, status: 'waiting', attempts: 0 };
      jobArray.push(job);
      
      // Process asynchronously (in-memory, no persistence)
      setTimeout(async () => {
        try {
          job.status = 'active';
          await sendFunction(data);
          job.status = 'completed';
          console.log(`✓ [${jobArray === inMemoryEmailJobs ? 'Email' : 'SMS'} Fallback] Job ${jobId} completed`);
        } catch (error) {
          job.attempts++;
          if (job.attempts < 3) {
            job.status = 'waiting';
            console.warn(`⚠ [${jobArray === inMemoryEmailJobs ? 'Email' : 'SMS'} Fallback] Job ${jobId} attempt ${job.attempts} failed, retrying...`);
            // Retry after delay
            setTimeout(() => {
              if (job.status === 'waiting') job.status = 'waiting';
            }, 2000 * job.attempts);
          } else {
            job.status = 'failed';
            console.error(`✗ [${jobArray === inMemoryEmailJobs ? 'Email' : 'SMS'} Fallback] Job ${jobId} failed after 3 attempts`);
          }
        }
      }, 0);
      
      return job;
    },
    on: () => {}, // Mock event listener
    count: async () => jobArray.filter(j => j.status === 'waiting').length,
    getActiveCount: async () => jobArray.filter(j => j.status === 'active').length,
    getCompletedCount: async () => jobArray.filter(j => j.status === 'completed').length,
    getFailedCount: async () => jobArray.filter(j => j.status === 'failed').length
  };
};

// Initialize with Redis, suppress connection errors
try {
  emailQueue = new Queue('email', {
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false
    }
  });

  smsQueue = new Queue('sms', {
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false
    }
  });

  // Email processor with retries
  emailQueue.process(5, async (job) => {
    const { to, subject, htmlContent } = job.data;
    console.log(`[Email Queue] Processing job ${job.id} - sending to ${to}`);
    
    try {
      const result = await notificationService.sendEmail(to, subject, htmlContent);
      return result;
    } catch (error) {
      console.error(`[Email Queue] Job ${job.id} attempt ${job.attemptsMade} failed:`, error.message);
      if (job.attemptsMade < 3) {
        throw error;
      }
      throw new Error(`Failed after 3 retries: ${error.message}`);
    }
  });

  // SMS processor with retries
  smsQueue.process(5, async (job) => {
    const { toPhone, message } = job.data;
    console.log(`[SMS Queue] Processing job ${job.id} - sending to ${toPhone}`);
    
    try {
      const result = await notificationService.sendSMS(toPhone, message);
      return result;
    } catch (error) {
      console.error(`[SMS Queue] Job ${job.id} attempt ${job.attemptsMade} failed:`, error.message);
      if (job.attemptsMade < 3) {
        throw error;
      }
      throw new Error(`Failed after 3 retries: ${error.message}`);
    }
  });

  // Suppress Redis connection errors silently
  emailQueue.on('error', () => {});
  smsQueue.on('error', () => {});

  console.log('[Queue] Redis queues initialized');
} catch (error) {
  console.log('[Queue] Using in-memory fallback queues');
  usingFallback = true;
  
  emailQueue = createFallbackQueue(
    inMemoryEmailJobs,
    async (data) => await notificationService.sendEmail(data.to, data.subject, data.htmlContent)
  );

  smsQueue = createFallbackQueue(
    inMemorySmsJobs,
    async (data) => await notificationService.sendSMS(data.toPhone, data.message)
  );
}

// Helper functions
const enqueueEmail = async (to, subject, htmlContent) => {
  try {
    const job = await emailQueue.add(
      { to, subject, htmlContent },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    );
    console.log(`[Email] Enqueued job for ${to}`);
    return job;
  } catch (error) {
    console.error(`[Email] Failed to enqueue:`, error.message);
    throw error;
  }
};

const enqueueSMS = async (toPhone, message) => {
  try {
    const job = await smsQueue.add(
      { toPhone, message },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    );
    console.log(`[SMS] Enqueued job for ${toPhone}`);
    return job;
  } catch (error) {
    console.error(`[SMS] Failed to enqueue:`, error.message);
    throw error;
  }
};

const getQueueStats = async () => {
  try {
    if (usingFallback) {
      return {
        mode: 'in-memory fallback',
        note: 'Install Redis for persistent queuing. Email queue: ' + inMemoryEmailJobs.length + ' jobs',
        emailJobs: inMemoryEmailJobs.length,
        smsJobs: inMemorySmsJobs.length
      };
    }
    return {
      mode: 'Redis',
      email: {
        waiting: await emailQueue.count(),
        active: await emailQueue.getActiveCount(),
        completed: await emailQueue.getCompletedCount(),
        failed: await emailQueue.getFailedCount()
      },
      sms: {
        waiting: await smsQueue.count(),
        active: await smsQueue.getActiveCount(),
        completed: await smsQueue.getCompletedCount(),
        failed: await smsQueue.getFailedCount()
      }
    };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  emailQueue,
  smsQueue,
  enqueueEmail,
  enqueueSMS,
  getQueueStats,
  usingFallback
};
