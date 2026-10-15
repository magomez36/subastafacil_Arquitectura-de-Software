const pool = require('../config/db');

async function closeExpiredAuctions(db = pool) {
  const result = await db.query(`
    UPDATE auctions AS a
    SET status = 'closed',
        winner_id = (
          SELECT b.bidder_id
          FROM bids AS b
          WHERE b.auction_id = a.id
          ORDER BY b.amount DESC, b.created_at ASC, b.id ASC
          LIMIT 1
        ),
        closed_at = COALESCE(a.closed_at, NOW())
    WHERE a.status IN ('active', 'scheduled')
      AND a.ends_at <= NOW()
    RETURNING a.id
  `);

  await db.query(`
    UPDATE auctions
    SET status = 'active'
    WHERE status = 'scheduled'
      AND starts_at <= NOW()
      AND ends_at > NOW()
  `);

  return result.rowCount;
}

module.exports = { closeExpiredAuctions };
