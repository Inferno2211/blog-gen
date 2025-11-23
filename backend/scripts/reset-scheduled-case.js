const prisma = require('../db/prisma');
const QueueService = require('../services/queue/QueueService');

/**
 * Reset a scheduled publish case that was incorrectly cancelled
 * Usage: node scripts/reset-scheduled-case.js <versionId> <orderId> <scheduledAtISOString>
 */
(async () => {
  const versionId = process.argv[2];
  const orderId = process.argv[3];
  const scheduledAt = process.argv[4];

  if (!versionId || !orderId || !scheduledAt) {
    console.error('Usage: node reset-scheduled-case.js <versionId> <orderId> <scheduledAtISOString>');
    console.error('Example: node reset-scheduled-case.js abc123 def456 "2025-11-21T10:00:00Z"');
    process.exit(1);
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    console.error('Invalid date format. Use ISO 8601 format like "2025-11-21T10:00:00Z"');
    process.exit(1);
  }

  try {
    console.log('Resetting scheduled publish case...');
    console.log('Version ID:', versionId);
    console.log('Order ID:', orderId);
    console.log('Scheduled for:', scheduledDate.toISOString());

    // Get current state
    const version = await prisma.articleVersion.findUnique({
      where: { id: versionId },
      include: {
        article: { include: { domain: true } },
        orders: true
      }
    });

    if (!version) {
      console.error('Version not found');
      process.exit(1);
    }

    console.log('\nCurrent state:');
    console.log('- scheduled_status:', version.scheduled_status);
    console.log('- backlink_review_status:', version.backlink_review_status);
    console.log('- Order status:', version.orders.find(o => o.id === orderId)?.status);

    // Initialize queue service
    const queueService = new QueueService();

    // Remove any existing scheduled jobs first
    const existingJobId = `scheduled-publish-v${versionId}`;
    console.log('\nRemoving any existing jobs...');
    try {
      const existingJob = await queueService.scheduledPublishQueue.getJob(existingJobId);
      if (existingJob) {
        await existingJob.remove();
        console.log(`✅ Removed existing job: ${existingJobId}`);
      } else {
        console.log('No existing job found');
      }
    } catch (error) {
      console.log('No existing job to remove:', error.message);
    }

    // Reset to SCHEDULED state (admin already approved)
    await prisma.$transaction([
      prisma.articleVersion.update({
        where: { id: versionId },
        data: {
          scheduled_status: 'SCHEDULED',
          scheduled_publish_at: scheduledDate,
          scheduled_job_id: null // Will be set when job is created
        }
      }),
      prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED', // Order is completed, just waiting for publish
          scheduled_status: 'SCHEDULED',
          scheduled_publish_at: scheduledDate
        }
      })
    ]);

    // Create new scheduled job (queueService already initialized above)
    const jobData = {
      versionId,
      orderId,
      articleId: version.article_id,
      domainName: version.article.domain.slug,
      scheduledAt: scheduledDate.getTime()
    };

    const delay = scheduledDate.getTime() - Date.now();
    if (delay < 0) {
      console.warn('\n⚠️  WARNING: Scheduled time is in the past! Job will execute immediately.');
    }

    const job = await queueService.addScheduledPublishJob(jobData);
    const jobId = job.id; // Extract job ID from Bull Job object

    // Update version with job ID
    await prisma.articleVersion.update({
      where: { id: versionId },
      data: { scheduled_job_id: jobId }
    });

    console.log('\n✅ Successfully reset scheduled publish!');
    console.log('New job ID:', jobId);
    console.log('Will execute at:', scheduledDate.toISOString());
    console.log('Delay:', Math.floor(delay / 1000), 'seconds');
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting case:', error);
    process.exit(1);
  }
})();
