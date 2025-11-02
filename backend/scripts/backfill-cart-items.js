/**
 * Backfill Script: Convert existing PurchaseSession records to use cart_items format
 * 
 * This script migrates single-article sessions to the new cart_items JSON array format
 * for backward compatibility with the multi-purchase system.
 * 
 * Run: node scripts/backfill-cart-items.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillCartItems() {
    console.log('Starting cart_items backfill migration...\n');

    try {
        // Find all sessions that have article_id but no cart_items
        const sessions = await prisma.purchaseSession.findMany({
            where: {
                AND: [
                    { article_id: { not: null } },
                    { cart_items: { equals: null } }
                ]
            },
            include: {
                article: true
            }
        });

        console.log(`Found ${sessions.length} sessions to migrate`);

        if (sessions.length === 0) {
            console.log('No sessions to migrate. Exiting.');
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const session of sessions) {
            try {
                // Convert single article to cart_items array format
                const cartItems = [{
                    articleId: session.article_id,
                    backlinkData: session.backlink_data || {}
                }];

                // Update session with cart_items
                await prisma.purchaseSession.update({
                    where: { id: session.id },
                    data: {
                        cart_items: cartItems,
                        purchase_type: session.backlink_data?.type === 'ARTICLE_GENERATION' 
                            ? 'ARTICLE_GENERATION' 
                            : 'BACKLINK'
                    }
                });

                successCount++;
                console.log(`✓ Migrated session ${session.id} (${session.email})`);
            } catch (error) {
                errorCount++;
                console.error(`✗ Failed to migrate session ${session.id}:`, error.message);
            }
        }

        console.log('\n=== Migration Complete ===');
        console.log(`Success: ${successCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log(`Total: ${sessions.length}`);

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run migration
backfillCartItems()
    .then(() => {
        console.log('\nBackfill complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\nBackfill failed:', error);
        process.exit(1);
    });
